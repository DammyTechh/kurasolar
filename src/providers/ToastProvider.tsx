import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Tone = 'success' | 'error' | 'info';
interface Toast { id: number; tone: Tone; message: string }

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((message: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, tone, message }]);
    setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
  }, [dismiss]);

  const value = useMemo(() => push, [push]);
  const Icon = { success: CheckCircle2, error: CircleAlert, info: Info };
  const color = { success: 'text-success', error: 'text-danger', info: 'text-primary' };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const I = Icon[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-white p-4 text-sm shadow-lift"
                role={t.tone === 'error' ? 'alert' : 'status'}
              >
                <I className={`mt-1 size-5 shrink-0 ${color[t.tone]}`} aria-hidden />
                <p className="flex-1 leading-snug text-ink">{t.message}</p>
                <button type="button" onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="Dismiss">
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
