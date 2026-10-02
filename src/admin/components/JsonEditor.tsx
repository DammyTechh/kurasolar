import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox, controlClass, Input, Textarea } from '@/components/ui/Field';
import { Card, Spinner } from '@/components/ui/Misc';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { ImagesInput } from './Resource';

export type Schema =
  | { type: 'string' | 'text' | 'color' | 'number' | 'boolean' | 'percent'; label: string; hint?: string; step?: number }
  | { type: 'image'; label: string; hint?: string }
  | { type: 'strings'; label: string; hint?: string }
  | { type: 'numbers'; label: string; hint?: string }
  | { type: 'record'; label: string; hint?: string; keyLabel?: string; valueLabel?: string; percent?: boolean }
  | { type: 'object'; label?: string; hint?: string; fields: Record<string, Schema> }
  | { type: 'list'; label: string; hint?: string; item: Record<string, Schema>; itemLabel?: string };

type Json = unknown;

function SchemaField({ schema, value, onChange }: { schema: Schema; value: Json; onChange: (v: Json) => void }) {
  switch (schema.type) {
    case 'string':
      return <Input label={schema.label} hint={schema.hint} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'text':
      return <Textarea wrapClassName="sm:col-span-2" label={schema.label} hint={schema.hint} rows={4} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return <Input label={schema.label} hint={schema.hint} type="number" step={schema.step ?? 'any'} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />;
    case 'percent':
      return <Input label={`${schema.label} (%)`} hint={schema.hint} type="number" step="0.1" value={value == null ? '' : String(Math.round(Number(value) * 10000) / 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} />;
    case 'boolean':
      return <div className="flex items-end pb-2"><Checkbox label={schema.label} hint={schema.hint} checked={Boolean(value)} onChange={onChange} /></div>;
    case 'color':
      return (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{schema.label}</span>
          <div className="flex items-center gap-2">
            <input type="color" value={String(value ?? '#000000')} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-white p-1" aria-label={schema.label} />
            <input className={cn(controlClass, 'h-10 font-mono uppercase')} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} maxLength={7} />
          </div>
        </div>
      );
    case 'image':
      return <ImagesInput label={schema.label} hint={schema.hint} folder="content" single value={value ? [String(value)] : []} onChange={(v) => onChange(v[0] ?? '')} />;
    case 'strings':
    case 'numbers':
      return (
        <Input wrapClassName="sm:col-span-2" label={schema.label} hint={schema.hint ?? 'Separate items with commas.'}
          value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={(e) => {
            const parts = e.target.value.split(',').map((s) => s.trim()).filter((s, i, arr) => s || i === arr.length - 1);
            onChange(schema.type === 'numbers' ? parts.filter(Boolean).map(Number).filter(Number.isFinite) : parts);
          }}
          onBlur={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (schema.type === 'numbers' ? Number(s) : s)))} />
      );
    case 'record': {
      const obj = (value && typeof value === 'object' ? value : {}) as Record<string, number>;
      const entries = Object.entries(obj);
      return (
        <div className="sm:col-span-2">
          <p className="text-sm font-medium">{schema.label}</p>
          {schema.hint && <p className="mt-1 text-sm text-muted">{schema.hint}</p>}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {entries.map(([k, v], i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input className={cn(controlClass, 'h-10')} aria-label={schema.keyLabel ?? 'Key'} value={k}
                  onChange={(e) => onChange(Object.fromEntries(entries.map(([kk, vv], j) => (j === i ? [e.target.value, vv] : [kk, vv]))))} />
                <input className={cn(controlClass, 'h-10')} type="number" step="any" aria-label={schema.valueLabel ?? 'Value'} value={schema.percent ? Math.round(Number(v) * 10000) / 100 : String(v)}
                  onChange={(e) => onChange({ ...obj, [k]: schema.percent ? Number(e.target.value) / 100 : Number(e.target.value) })} />
                <button type="button" className="grid size-10 place-items-center text-muted hover:text-danger" onClick={() => { const n = { ...obj }; delete n[k]; onChange(n); }} aria-label="Remove"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2" icon={<Plus className="size-4" />} onClick={() => onChange({ ...obj, [`NEW${entries.length + 1}`]: 0 })}>Add</Button>
        </div>
      );
    }
    case 'object': {
      const obj = (value && typeof value === 'object' ? value : {}) as Record<string, Json>;
      return (
        <div className="sm:col-span-2">
          {schema.label && <p className="text-sm font-medium">{schema.label}</p>}
          {schema.hint && <p className="mt-1 text-sm text-muted">{schema.hint}</p>}
          <div className={cn('grid gap-4 sm:grid-cols-2', schema.label && 'mt-3 rounded-2xl bg-surface p-4')}>
            {Object.entries(schema.fields).map(([k, s]) => <SchemaField key={k} schema={s} value={obj[k]} onChange={(v) => onChange({ ...obj, [k]: v })} />)}
          </div>
        </div>
      );
    }
    case 'list': {
      const list = Array.isArray(value) ? (value as Record<string, Json>[]) : [];
      const move = (i: number, d: number) => { const n = [...list]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x!); onChange(n); };
      return (
        <div className="sm:col-span-2">
          <p className="text-sm font-medium">{schema.label}</p>
          {schema.hint && <p className="mt-1 text-sm text-muted">{schema.hint}</p>}
          <div className="mt-3 space-y-3">
            {list.map((item, i) => (
              <div key={i} className="rounded-2xl border border-line p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-muted">{schema.itemLabel ?? 'Item'} {i + 1}</span>
                  <div className="flex">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-8 place-items-center text-muted disabled:opacity-30" aria-label="Move up"><ArrowUp className="size-4" /></button>
                    <button type="button" disabled={i === list.length - 1} onClick={() => move(i, 1)} className="grid size-8 place-items-center text-muted disabled:opacity-30" aria-label="Move down"><ArrowDown className="size-4" /></button>
                    <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="grid size-8 place-items-center text-muted hover:text-danger" aria-label="Remove"><Trash2 className="size-4" /></button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {Object.entries(schema.item).map(([k, s]) => <SchemaField key={k} schema={s} value={item[k]} onChange={(v) => onChange(list.map((x, j) => (j === i ? { ...x, [k]: v } : x)))} />)}
                </div>
              </div>
            ))}
          </div>
          <Button size="sm" variant="secondary" className="mt-3" icon={<Plus className="size-4" />} onClick={() => onChange([...list, {}])}>Add {(schema.itemLabel ?? 'item').toLowerCase()}</Button>
        </div>
      );
    }
  }
}

/** Edits one row of site_settings or site_content against a schema. */
export function JsonDocEditor({ table, docKey, title, description, schema }: { table: 'site_settings' | 'site_content'; docKey: string; title: string; description?: string; schema: Record<string, Schema> }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['admin', table, docKey],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select('value, updated_at').eq('key', docKey).maybeSingle();
      if (error) throw error;
      return data as { value: Record<string, Json>; updated_at: string } | null;
    },
  });
  const [value, setValue] = useState<Record<string, Json>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setValue(q.data.value ?? {}); }, [q.data]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from(table).upsert({ key: docKey, value, updated_by: user?.id });
    setBusy(false);
    if (error) return toast(errorMessage(error), 'error');
    toast('Saved. Changes are live.');
    qc.invalidateQueries({ queryKey: ['site'] });
    qc.invalidateQueries({ queryKey: ['admin', table, docKey] });
  };

  if (q.isLoading) return <Spinner />;
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
        </div>
        <Button onClick={save} loading={busy}>Save</Button>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {Object.entries(schema).map(([k, s]) => <SchemaField key={k} schema={s} value={value[k]} onChange={(v) => setValue((x) => ({ ...x, [k]: v }))} />)}
      </div>
    </Card>
  );
}
