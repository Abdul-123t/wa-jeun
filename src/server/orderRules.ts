import { normalizeNigerianPhone } from './validation';

export type CheckoutLine = { menuItemId: string; quantity: number };
export type FulfillmentMethod = 'pickup' | 'vendor_delivery';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCheckoutLines(value: unknown): { success: true; lines: CheckoutLine[] } | { success: false; error: string } {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) return { success: false, error: 'Your cart must contain between 1 and 30 different items.' };
  const lines: CheckoutLine[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return { success: false, error: 'Your cart contains an invalid item.' };
    const line = raw as Record<string, unknown>;
    if (typeof line.menuItemId !== 'string' || !UUID.test(line.menuItemId) || seen.has(line.menuItemId)) return { success: false, error: 'Your cart contains an invalid or duplicate item.' };
    if (!Number.isInteger(line.quantity) || Number(line.quantity) < 1 || Number(line.quantity) > 99) return { success: false, error: 'Each item quantity must be between 1 and 99.' };
    seen.add(line.menuItemId);
    lines.push({ menuItemId: line.menuItemId, quantity: Number(line.quantity) });
  }
  return { success: true, lines };
}

export function validateCheckoutContact(name: unknown, phone: unknown) {
  const customerName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  const customerPhone = typeof phone === 'string' ? normalizeNigerianPhone(phone) : null;
  if (customerName.length < 2 || customerName.length > 120) return { success: false as const, error: 'Enter a name between 2 and 120 characters.' };
  if (!customerPhone) return { success: false as const, error: 'Enter a valid Nigerian phone number.' };
  return { success: true as const, customerName, customerPhone };
}

export function validateFulfillment(value: unknown, address: unknown, allowed: string[]) {
  if (value !== 'pickup' && value !== 'vendor_delivery') return { success: false as const, error: 'Choose pickup or vendor-managed delivery.' };
  const options = allowed;
  if (value === 'pickup' && !options.includes('pickup_only') && !options.includes('pickup_and_delivery')) return { success: false as const, error: 'This business does not offer pickup.' };
  if (value === 'vendor_delivery' && !options.includes('vendor_delivery') && !options.includes('pickup_and_delivery') && !options.includes('delivery_varies')) return { success: false as const, error: 'This business does not offer vendor-managed delivery.' };
  if (value === 'pickup') return { success: true as const, fulfillmentMethod: value, deliveryAddress: null };
  const deliveryAddress = typeof address === 'string' ? address.trim().replace(/\s+/g, ' ') : '';
  if (deliveryAddress.length < 3 || deliveryAddress.length > 300) return { success: false as const, error: 'Enter a delivery address or clear landmark between 3 and 300 characters.' };
  return { success: true as const, fulfillmentMethod: value, deliveryAddress };
}

export function calculateOrderTotals(items: Array<{ price_ngn: number; quantity: number }>, deliveryFeeNgn: number | null) {
  const subtotal = items.reduce((total, item) => total + Math.round(item.price_ngn * 100) * item.quantity, 0);
  const deliveryFee = deliveryFeeNgn === null ? null : Math.round(deliveryFeeNgn * 100);
  const total = subtotal + (deliveryFee || 0);
  return { subtotalNgn: subtotal / 100, deliveryFeeNgn: deliveryFee === null ? null : deliveryFee / 100, totalNgn: total / 100 };
}

export function resolveAvailableOrderItems(lines: CheckoutLine[], menuRows: Array<{ id: string; vendor_interest_id: string; price_ngn: number; available: boolean }>) {
  if (menuRows.length !== lines.length || menuRows.some(row => !row.available)) return { success: false as const, error: 'One or more items are no longer available.' };
  const vendorIds = new Set(menuRows.map(row => row.vendor_interest_id));
  if (vendorIds.size !== 1) return { success: false as const, error: 'A cart can contain items from only one business.' };
  const menuById = new Map(menuRows.map(row => [row.id, row]));
  const items = lines.map(line => {
    const row = menuById.get(line.menuItemId)!;
    return { menuItemId: row.id, vendorId: row.vendor_interest_id, quantity: line.quantity, priceNgn: Number(row.price_ngn) };
  });
  if (items.some(item => !Number.isFinite(item.priceNgn) || item.priceNgn <= 0)) return { success: false as const, error: 'A current menu price is invalid.' };
  return { success: true as const, vendorId: items[0].vendorId, items };
}

export type OrderStatus = 'placed' | 'accepted' | 'rejected' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'completed';
export function canTransitionOrder(current: OrderStatus, next: OrderStatus, fulfillment: FulfillmentMethod) {
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    placed: ['accepted', 'rejected'], accepted: ['preparing'], rejected: [], preparing: [fulfillment === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery'],
    ready_for_pickup: ['completed'], out_for_delivery: ['completed'], completed: []
  };
  return transitions[current].includes(next);
}
