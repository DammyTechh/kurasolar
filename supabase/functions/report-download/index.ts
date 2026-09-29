/**
 * POST /functions/v1/report-download   { assessment_id }
 * Returns a short-lived signed URL to the PDF. The report is generated on the
 * server on first request and cached in the private "reports" bucket.
 */
import { admin, requireCaller } from '../_shared/db.ts';
import type { SizingResult } from '../_shared/engine/index.ts';
import { appUrl } from '../_shared/env.ts';
import { handler, HttpError, json, readJson } from '../_shared/http.ts';
import { buildReport } from '../_shared/pdf/report.ts';
import type { Recommendation } from '../_shared/recommend.ts';
import { getContent, getSettings } from '../_shared/settings.ts';

async function loadLogo(url: string | undefined) {
  if (!url) return null;
  const absolute = url.startsWith('http') ? url : `${appUrl()}${url.startsWith('/') ? '' : '/'}${url}`;
  try {
    const res = await fetch(absolute);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    return isPng ? { bytes, type: 'png' as const } : isJpg ? { bytes, type: 'jpg' as const } : null;
  } catch {
    return null;
  }
}

Deno.serve(handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const caller = await requireCaller(req);
  const { assessment_id } = await readJson<{ assessment_id?: string }>(req);
  const db = admin();

  const { data: a } = await db.from('assessments').select('*').eq('id', String(assessment_id ?? '')).maybeSingle();
  if (!a || (a.user_id !== caller.user.id && caller.role !== 'admin')) throw new HttpError(404, 'Assessment not found.');
  if (a.status !== 'paid' && caller.role !== 'admin') throw new HttpError(402, 'Pay the consultation fee to unlock this report.');

  const { data: res } = await db.from('assessment_results').select('*').eq('assessment_id', a.id).single();
  if (!res) throw new HttpError(404, 'This assessment has no calculation yet.');

  let path: string = res.report_path;
  if (!path) {
    const [{ company, brand }, disclaimer, appliancesRes] = await Promise.all([
      getSettings('company', 'brand'),
      getContent<{ text: string }>('disclaimer'),
      db.from('assessment_appliances').select('name, quantity, rated_watts, hours_per_day, cycles_per_day, category, daily_kwh, priority')
        .eq('assessment_id', a.id).order('position'),
    ]);
    const recommendation = res.recommended_products as Recommendation | null;
    const pdf = await buildReport({
      company: company as never,
      brand: brand as never,
      logo: await loadLogo(company.logoUrl),
      assessment: a,
      appliances: (appliancesRes.data ?? []).map((x) => ({
        ...x,
        hours_per_day: Math.min(24, Number(x.hours_per_day) * (x.category === 'washing_machine' ? Number(x.cycles_per_day) : 1)),
      })),
      result: res.result as SizingResult,
      products: recommendation?.items ?? [],
      disclaimer: disclaimer?.text ?? '',
    });

    path = `${a.id}/${a.code}.pdf`;
    const { error: upErr } = await db.storage.from('reports').upload(path, pdf, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw upErr;
    await db.from('assessment_results').update({ report_path: path, report_generated_at: new Date().toISOString() }).eq('assessment_id', a.id);
  }

  const { data: signed, error } = await db.storage.from('reports').createSignedUrl(path, 300, { download: `${a.code}.pdf` });
  if (error || !signed) throw new HttpError(500, 'Could not prepare the download. Please try again.');
  return json(req, { url: signed.signedUrl, filename: `${a.code}.pdf`, expires_in: 300 });
}));
