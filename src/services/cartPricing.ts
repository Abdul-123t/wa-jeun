import type { CartLine } from './CartContext';
import type { PublicMenuItem } from './api';

export type CartPriceChange = {
  menuItemId: string;
  name: string;
  previousPriceNgn: number;
  currentPriceNgn: number;
};

/** Compare the cart's last-seen price with the latest available menu response. */
export function findCartPriceChanges(lines: CartLine[], menu: PublicMenuItem[]): CartPriceChange[] {
  const menuById = new Map(menu.map(item => [item.id, item]));
  return lines.flatMap(line => {
    const current = menuById.get(line.menuItemId);
    if (!current) return [];
    const previousPriceNgn = Math.round(Number(line.priceNgn) * 100) / 100;
    const currentPriceNgn = Math.round(Number(current.price_ngn) * 100) / 100;
    return previousPriceNgn === currentPriceNgn ? [] : [{ menuItemId: line.menuItemId, name: current.name, previousPriceNgn, currentPriceNgn }];
  });
}
