import { useEffect, useSyncExternalStore } from 'react';

/** Lets any page set the message the floating WhatsApp button will pre-fill. */
let message: string | null = null;
const listeners = new Set<() => void>();

function set(next: string | null) {
  message = next;
  listeners.forEach((l) => l());
}

export function useWhatsappMessage() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => message,
  );
}

export function useContextualWhatsapp(next: string | null | undefined) {
  useEffect(() => {
    if (!next) return;
    set(next);
    return () => set(null);
  }, [next]);
}
