import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox, controlClass, Input, Select, Textarea } from '@/components/ui/Field';
import { EmptyState, Skeleton } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Modal';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { mediaUrl, supabase, uploadImage } from '@/lib/supabase';
import { useToast } from '@/providers/ToastProvider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any> & { id?: string };

export type FieldDef =
  | { key: string; label: string; type: 'text' | 'textarea' | 'markdown' | 'email' | 'url' | 'date'; required?: boolean; hint?: string; full?: boolean }
  | { key: string; label: string; type: 'number'; required?: boolean; hint?: string; step?: number; full?: boolean; nullable?: boolean }
  | { key: string; label: string; type: 'boolean'; hint?: string; full?: boolean }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; required?: boolean; hint?: string; full?: boolean; nullable?: boolean }
  | { key: string; label: string; type: 'tags'; hint?: string; full?: boolean }
  | { key: string; label: string; type: 'keyvalue'; hint?: string; full?: boolean }
  | { key: string; label: string; type: 'image'; folder: string; hint?: string; full?: boolean }
  | { key: string; label: string; type: 'images'; folder: string; hint?: string; full?: boolean };

export interface Column {
  key: string;
  label: string;
  render?: (row: Row) => ReactNode;
  className?: string;
}

export interface ResourceConfig {
  table: string;
  title: string;
  description?: string;
  select?: string;
  columns: Column[];
  fields?: FieldDef[];
  order?: { column: string; ascending?: boolean };
  search?: string[];
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  defaults?: Row;
  /** Adjust values before insert/update (e.g. slug generation). */
  beforeSave?: (values: Row, isNew: boolean) => Row;
  canCreate?: boolean;
  canDelete?: boolean;
  /** Extra buttons per row. */
  rowActions?: (row: Row, refresh: () => void) => ReactNode;
  /** Custom detail view instead of the edit form. */
  detail?: (row: Row, close: () => void, refresh: () => void) => ReactNode;
  pageSize?: number;
  /** Primary key column; defaults to "id". */
  idKey?: string;
}

export function Resource({ config }: { config: ResourceConfig }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ row: Row; isNew: boolean } | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const size = config.pageSize ?? 25;
  const key = ['admin', config.table, search, filters, page];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      let query = supabase.from(config.table).select(config.select ?? '*', { count: 'exact' });
      for (const [k, v] of Object.entries(filters)) if (v) query = query.eq(k, v);
      const s = search.replace(/[%,()]/g, ' ').trim();
      if (s && config.search?.length) query = query.or(config.search.map((c) => `${c}.ilike.%${s}%`).join(','));
      if (config.order) query = query.order(config.order.column, { ascending: config.order.ascending ?? true });
      query = query.range(page * size, page * size + size - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as Row[], count: count ?? 0 };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', config.table] });

  const remove = async (row: Row) => {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    const idKey = config.idKey ?? 'id';
    const { error } = await supabase.from(config.table).delete().eq(idKey, row[idKey] as string);
    if (error) return toast(errorMessage(error), 'error');
    toast('Deleted');
    refresh();
    qc.invalidateQueries({ queryKey: ['public'] });
  };

  const rows = q.data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((q.data?.count ?? 0) / size));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl">{config.title}</h1>
          {config.description && <p className="mt-2 max-w-2xl text-sm text-muted">{config.description}</p>}
        </div>
        {config.canCreate !== false && config.fields && (
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing({ row: { ...(config.defaults ?? {}) }, isNew: true })}>Add new</Button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {config.search?.length ? (
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input className={cn(controlClass, 'h-10 pl-10')} placeholder="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} aria-label="Search" />
          </div>
        ) : null}
        {config.filters?.map((f) => (
          <select key={f.key} className={cn(controlClass, 'h-10 w-auto')} value={filters[f.key] ?? ''} onChange={(e) => { setFilters((x) => ({ ...x, [f.key]: e.target.value })); setPage(0); }} aria-label={f.label}>
            <option value="">{f.label}: all</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white">
        {q.isLoading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : q.error ? (
          <p className="p-6 text-sm text-danger">{errorMessage(q.error)}</p>
        ) : rows.length === 0 ? (
          <div className="p-4"><EmptyState title="Nothing here yet" /></div>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                {config.columns.map((c) => <th key={c.key} className={cn('px-4 py-3 font-normal', c.className)}>{c.label}</th>)}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id ?? row.key ?? row.code)} className="border-b border-line/70 last:border-0 hover:bg-surface/50">
                  {config.columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>{c.render ? c.render(row) : String(row[c.key] ?? '—')}</td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {config.rowActions?.(row, refresh)}
                      {config.detail && <Button size="sm" variant="ghost" onClick={() => setViewing(row)}>Open</Button>}
                      {config.fields && !config.detail && (
                        <button type="button" className="grid size-8 place-items-center rounded-full text-muted hover:bg-tint hover:text-primary" onClick={() => setEditing({ row, isNew: false })} aria-label="Edit"><Pencil className="size-4" /></button>
                      )}
                      {config.canDelete !== false && config.fields && (
                        <button type="button" className="grid size-8 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" onClick={() => remove(row)} aria-label="Delete"><Trash2 className="size-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{q.data?.count} items</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="num">{page + 1} / {pages}</span>
            <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {config.fields && (
        <ResourceForm
          open={Boolean(editing)}
          config={config}
          row={editing?.row ?? null}
          isNew={editing?.isNew ?? true}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); qc.invalidateQueries({ queryKey: ['public'] }); }}
        />
      )}
      {config.detail && (
        <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} size="xl" title={String(viewing?.code ?? viewing?.company_name ?? viewing?.full_name ?? 'Details')}>
          {viewing && config.detail(viewing, () => setViewing(null), () => { refresh(); setViewing(null); })}
        </Modal>
      )}
    </div>
  );
}

function ResourceForm({ open, config, row, isNew, onClose, onSaved }: { open: boolean; config: ResourceConfig; row: Row | null; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState<Row>({});
  const [busy, setBusy] = useState(false);
  const [lastRow, setLastRow] = useState<Row | null>(null);
  if (row !== lastRow) {
    setLastRow(row);
    setValues(row ? { ...row } : {});
  }

  const set = (k: string, v: unknown) => setValues((x) => ({ ...x, [k]: v }));

  const save = async () => {
    for (const f of config.fields!) {
      if ('required' in f && f.required && (values[f.key] === '' || values[f.key] == null)) return toast(`${f.label} is required.`, 'error');
    }
    setBusy(true);
    const payload: Row = {};
    for (const f of config.fields!) {
      let v = values[f.key];
      if (f.type === 'number') v = v === '' || v == null ? (f.nullable ? null : 0) : Number(v);
      if ((f.type === 'text' || f.type === 'textarea' || f.type === 'markdown' || f.type === 'url' || f.type === 'email' || f.type === 'date') && v === '') v = null;
      if (f.type === 'select' && v === '' && f.nullable) v = null;
      payload[f.key] = v;
    }
    const final = config.beforeSave ? config.beforeSave(payload, isNew) : payload;
    const res = isNew ? await supabase.from(config.table).insert(final) : await supabase.from(config.table).update(final).eq(config.idKey ?? 'id', row![config.idKey ?? 'id'] as string);
    setBusy(false);
    if (res.error) return toast(errorMessage(res.error), 'error');
    toast(isNew ? 'Created' : 'Saved');
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={isNew ? `Add to ${config.title.toLowerCase()}` : 'Edit'}
      footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{isNew ? 'Create' : 'Save changes'}</Button></div>}>
      <div className="grid gap-6 sm:grid-cols-2">
        {config.fields!.map((f) => <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />)}
      </div>
    </Modal>
  );
}

export function FieldInput({ field: f, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const full = f.full || f.type === 'textarea' || f.type === 'markdown' || f.type === 'images' || f.type === 'keyvalue' || f.type === 'tags';
  const wrap = full ? 'sm:col-span-2' : undefined;
  const str = value == null ? '' : String(value);
  switch (f.type) {
    case 'textarea':
    case 'markdown':
      return <Textarea wrapClassName={wrap} label={f.label} hint={f.hint ?? (f.type === 'markdown' ? 'Supports Markdown: ## headings, **bold**, lists and links.' : undefined)} rows={f.type === 'markdown' ? 12 : 4} value={str} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return <Input wrapClassName={wrap} label={f.label} hint={f.hint} type="number" step={f.step ?? 'any'} value={str} onChange={(e) => onChange(e.target.value)} />;
    case 'boolean':
      return <div className={cn('flex items-end pb-2', wrap)}><Checkbox label={f.label} hint={f.hint} checked={Boolean(value)} onChange={onChange} /></div>;
    case 'select':
      return <Select wrapClassName={wrap} label={f.label} hint={f.hint} value={str} placeholder={f.nullable ? 'None' : undefined} options={f.options} onChange={(e) => onChange(e.target.value)} />;
    case 'tags':
      return <TagsInput label={f.label} hint={f.hint} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />;
    case 'keyvalue':
      return <KeyValueInput label={f.label} hint={f.hint} value={(value as Record<string, string>) ?? {}} onChange={onChange} />;
    case 'image':
      return <ImagesInput label={f.label} hint={f.hint} folder={f.folder} single value={str ? [str] : []} onChange={(v) => onChange(v[0] ?? null)} />;
    case 'images':
      return <ImagesInput label={f.label} hint={f.hint} folder={f.folder} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />;
    default:
      return <Input wrapClassName={wrap} label={f.label} hint={f.hint} type={f.type === 'text' ? 'text' : f.type} value={f.type === 'date' ? str.slice(0, 10) : str} onChange={(e) => onChange(e.target.value)} />;
  }
}

function TagsInput({ label, hint, value, onChange }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
    setDraft('');
  };
  return (
    <div className="sm:col-span-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2 rounded-[var(--radius-control)] border border-line p-2">
        {value.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-tint py-1 pr-2 pl-3 text-sm text-primary">
            {t}<button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X className="size-3.5" /></button>
          </span>
        ))}
        <input className="min-w-40 flex-1 px-2 py-1 text-sm focus:outline-none" value={draft} placeholder="Type and press Enter" onChange={(e) => setDraft(e.target.value)} onBlur={add} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} />
      </div>
      {hint && <p className="mt-2 text-sm text-muted">{hint}</p>}
    </div>
  );
}

function KeyValueInput({ label, hint, value, onChange }: { label: string; hint?: string; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const entries = useMemo(() => Object.entries(value ?? {}), [value]);
  const update = (list: [string, string][]) => onChange(Object.fromEntries(list.filter(([k]) => k.trim())));
  const [rows, setRows] = useState<[string, string][]>(entries.length ? entries.map(([k, v]) => [k, String(v)]) : [['', '']]);
  const change = (i: number, idx: 0 | 1, v: string) => {
    const next = rows.map((r, j) => (j === i ? (idx === 0 ? [v, r[1]] : [r[0], v]) : r)) as [string, string][];
    setRows(next);
    update(next);
  };
  return (
    <div className="sm:col-span-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 space-y-2">
        {rows.map(([k, v], i) => (
          <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
            <input className={cn(controlClass, 'h-10')} placeholder="Name" value={k} onChange={(e) => change(i, 0, e.target.value)} />
            <input className={cn(controlClass, 'h-10')} placeholder="Value" value={v} onChange={(e) => change(i, 1, e.target.value)} />
            <button type="button" className="grid size-10 place-items-center rounded-full text-muted hover:text-danger" onClick={() => { const next = rows.filter((_, j) => j !== i); setRows(next.length ? next : [['', '']]); update(next); }} aria-label="Remove row"><X className="size-4" /></button>
          </div>
        ))}
        <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => setRows([...rows, ['', '']])}>Add row</Button>
      </div>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function ImagesInput({ label, hint, folder, value, onChange, single }: { label: string; hint?: string; folder: string; value: string[]; onChange: (v: string[]) => void; single?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const file of Array.from(files).slice(0, single ? 1 : 8)) paths.push(await uploadImage(file, folder));
      onChange(single ? paths : [...value, ...paths]);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sm:col-span-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {value.map((src, i) => (
          <div key={src} className="group relative size-24 overflow-hidden rounded-xl border border-line bg-surface">
            <img src={mediaUrl(src)} alt="" className="size-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-white/90 text-danger" aria-label="Remove image"><X className="size-3.5" /></button>
          </div>
        ))}
        {(!single || value.length === 0) && (
          <label className="grid size-24 cursor-pointer place-items-center rounded-xl border border-dashed border-line text-muted hover:border-primary hover:text-primary">
            <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="size-5" />{busy ? 'Uploading…' : 'Upload'}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple={!single} className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy} />
          </label>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">{hint ?? 'PNG, JPG, WebP or GIF up to 5 MB.'}</p>
    </div>
  );
}
