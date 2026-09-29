import type { ApplianceInput, GridAvailability } from '@engine';
import { useCallback, useEffect, useState } from 'react';

export interface LocationDraft {
  country: string;
  state: string;
  city: string;
  postcode: string;
  propertyType: string;
  gridAvailability: GridAvailability;
  /** null = use the default for the grid condition. */
  backupHours: number | null;
  isDiaspora: boolean;
  recipient: { name: string; phone: string; location: string; relationship: string };
}

export interface CalculatorDraft {
  step: number;
  location: LocationDraft;
  appliances: ApplianceInput[];
  /** Server id once calculated; re-running updates the same unpaid assessment. */
  assessmentId: string | null;
  updatedAt: number;
}

const KEY = 'ks.calculator.v1';

export const EMPTY_DRAFT: CalculatorDraft = {
  step: 0,
  location: {
    country: 'Nigeria', state: '', city: '', postcode: '', propertyType: 'residential', gridAvailability: 'intermittent',
    backupHours: null, isDiaspora: false, recipient: { name: '', phone: '', location: '', relationship: '' },
  },
  appliances: [],
  assessmentId: null,
  updatedAt: 0,
};

function load(): CalculatorDraft {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return EMPTY_DRAFT;
    return {
      ...EMPTY_DRAFT,
      ...raw,
      location: { ...EMPTY_DRAFT.location, ...raw.location, recipient: { ...EMPTY_DRAFT.location.recipient, ...raw.location?.recipient } },
      appliances: Array.isArray(raw.appliances) ? raw.appliances : [],
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

/** Calculator state, saved to the device so customers can leave and come back. */
export function useDraft() {
  const [draft, setDraft] = useState<CalculatorDraft>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      /* ignore quota errors */
    }
  }, [draft]);

  const update = useCallback((patch: Partial<CalculatorDraft>) => setDraft((d) => ({ ...d, ...patch, updatedAt: Date.now() })), []);
  const setLocation = useCallback((patch: Partial<LocationDraft>) => setDraft((d) => ({ ...d, location: { ...d.location, ...patch }, updatedAt: Date.now() })), []);
  const setAppliances = useCallback((fn: (list: ApplianceInput[]) => ApplianceInput[]) => setDraft((d) => ({ ...d, appliances: fn(d.appliances), updatedAt: Date.now() })), []);
  const reset = useCallback(() => setDraft({ ...EMPTY_DRAFT, updatedAt: Date.now() }), []);

  return { draft, update, setLocation, setAppliances, reset };
}

/** Lets other pages (e.g. saved appliance sets) seed the calculator. */
export function seedDraft(appliances: ApplianceInput[]) {
  const current = load();
  localStorage.setItem(KEY, JSON.stringify({ ...current, appliances, step: 1, assessmentId: null, updatedAt: Date.now() }));
}
