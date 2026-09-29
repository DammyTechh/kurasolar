import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CartLine {
  product_id: string;
  slug: string;
  name: string;
  price: number;
  image?: string | null;
  role?: string | null;
  quantity: number;
  maxQuantity?: number;
}

interface CartValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const KEY = 'ks.cart.v1';
const CartContext = createContext<CartValue | null>(null);

function read(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((l) => l && typeof l.product_id === 'string' && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(read);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage full or disabled: cart still works for this session */
    }
  }, [lines]);

  const clampQty = (q: number, max?: number) => Math.max(1, Math.min(max && max > 0 ? max : 999, Math.round(q)));

  const add = useCallback<CartValue['add']>((line, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.product_id === line.product_id);
      if (existing) {
        return prev.map((l) => (l.product_id === line.product_id ? { ...l, ...line, quantity: clampQty(l.quantity + quantity, line.maxQuantity) } : l));
      }
      return [...prev, { ...line, quantity: clampQty(quantity, line.maxQuantity) }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((prev) => prev.map((l) => (l.product_id === productId ? { ...l, quantity: clampQty(quantity, l.maxQuantity) } : l)));
  }, []);

  const remove = useCallback((productId: string) => setLines((prev) => prev.filter((l) => l.product_id !== productId)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartValue>(() => ({
    lines,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal: lines.reduce((s, l) => s + l.price * l.quantity, 0),
    open, setOpen, add, setQuantity, remove, clear,
  }), [lines, open, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
