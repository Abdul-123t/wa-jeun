export const MARKET_AREAS = [
  { id: 'ijebu-ode', name: 'Ijebu Ode', label: 'Ijebu Ode' },
  { id: 'ijagun', name: 'Ijagun', label: 'Ijagun (TASUED area)' }
] as const;

export type MarketAreaId = typeof MARKET_AREAS[number]['id'];

export function isMarketAreaId(value: unknown): value is MarketAreaId {
  return typeof value === 'string' && MARKET_AREAS.some(area => area.id === value);
}

export function canonicalMarketArea(value: string | null | undefined): MarketAreaId | null {
  if (!value) return null;
  const area = MARKET_AREAS.find(option => option.id.toLocaleLowerCase() === value.toLocaleLowerCase() || option.name.toLocaleLowerCase() === value.toLocaleLowerCase() || option.label.toLocaleLowerCase() === value.toLocaleLowerCase());
  return area?.id || null;
}
