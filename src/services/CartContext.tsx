import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PublicMenuItem, PublicVendorBusiness } from './api';

export type CartLine = { menuItemId: string; name: string; description: string; category: string; priceNgn: number; imageUrl: string | null; quantity: number };
export type CartState = { vendorId: string; vendorName: string; lines: CartLine[] };
type CartContextValue = { cart: CartState | null; addItem: (vendor: PublicVendorBusiness, item: PublicMenuItem) => 'added' | 'different_vendor'; replaceCartWithItem: (vendor: PublicVendorBusiness, item: PublicMenuItem) => void; setQuantity: (menuItemId: string, quantity: number) => void; removeItem: (menuItemId: string) => void; syncLine: (item: PublicMenuItem) => void; clearCart: () => void };
const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'wa-jeun-cart-v1';

export const CartProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [cart, setCart] = useState<CartState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try { const stored = localStorage.getItem(STORAGE_KEY); if (stored) setCart(JSON.parse(stored) as CartState); } catch { localStorage.removeItem(STORAGE_KEY); }
    finally { setHydrated(true); }
  }, []);
  useEffect(() => { if (!hydrated) return; if (cart) localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); else localStorage.removeItem(STORAGE_KEY); }, [cart, hydrated]);
  const value = useMemo<CartContextValue>(() => ({
    cart,
    addItem: (vendor, item) => {
      if (cart && cart.vendorId !== vendor.id) return 'different_vendor';
      setCart(current => {
        const base = current || { vendorId: vendor.id, vendorName: vendor.business_name, lines: [] };
        const exists = base.lines.find(line => line.menuItemId === item.id);
        const line: CartLine = { menuItemId: item.id, name: item.name, description: item.description, category: item.category, priceNgn: Number(item.price_ngn), imageUrl: item.image_url, quantity: exists ? Math.min(99, exists.quantity + 1) : 1 };
        return { ...base, vendorName: vendor.business_name, lines: exists ? base.lines.map(old => old.menuItemId === item.id ? line : old) : [...base.lines, line] };
      });
      return 'added';
    },
    replaceCartWithItem: (vendor, item) => setCart({
      vendorId: vendor.id,
      vendorName: vendor.business_name,
      lines: [{ menuItemId: item.id, name: item.name, description: item.description, category: item.category, priceNgn: Number(item.price_ngn), imageUrl: item.image_url, quantity: 1 }]
    }),
    setQuantity: (menuItemId, quantity) => setCart(current => !current ? current : ({ ...current, lines: current.lines.map(line => line.menuItemId === menuItemId ? { ...line, quantity: Math.max(1, Math.min(99, Math.floor(quantity))) } : line) })),
    removeItem: menuItemId => setCart(current => { if (!current) return current; const lines = current.lines.filter(line => line.menuItemId !== menuItemId); return lines.length ? { ...current, lines } : null; }),
    syncLine: item => setCart(current => current ? ({ ...current, lines: current.lines.map(line => line.menuItemId === item.id ? { ...line, name: item.name, description: item.description, category: item.category, priceNgn: Number(item.price_ngn), imageUrl: item.image_url } : line) }) : current),
    clearCart: () => setCart(null)
  }), [cart]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart() { const context = useContext(CartContext); if (!context) throw new Error('useCart must be used inside CartProvider.'); return context; }
