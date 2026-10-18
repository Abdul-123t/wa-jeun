export type OrderIntentLine = {
  menuItemId: string;
  quantity: number;
  expectedPriceNgn: number;
};

export type OrderIntent = {
  customerId: string;
  customerName: string;
  customerPhone: string;
  fulfillmentMethod: 'pickup' | 'vendor_delivery';
  deliveryAddress: string | null;
  expectedDeliveryFeeNgn: number | null;
  items: OrderIntentLine[];
};

function toMinorUnits(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) throw new Error('Order amounts must be finite numbers.');
  return Math.round(value * 100);
}

export function canonicalOrderIntent(intent: OrderIntent): string {
  const items = intent.items.map(item => ({
    menuItemId: item.menuItemId.toLowerCase(),
    quantity: item.quantity,
    expectedPriceMinor: toMinorUnits(item.expectedPriceNgn)
  })).sort((left, right) => left.menuItemId.localeCompare(right.menuItemId));

  return JSON.stringify({
    customerId: intent.customerId.toLowerCase(),
    customerName: intent.customerName.trim().replace(/\s+/g, ' '),
    customerPhone: intent.customerPhone,
    fulfillmentMethod: intent.fulfillmentMethod,
    deliveryAddress: intent.fulfillmentMethod === 'pickup' ? null : intent.deliveryAddress?.trim().replace(/\s+/g, ' ') || null,
    expectedDeliveryFeeMinor: intent.fulfillmentMethod === 'pickup' ? null : toMinorUnits(intent.expectedDeliveryFeeNgn),
    items
  });
}
