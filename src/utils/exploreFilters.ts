import { IJEBU_ODE_AREAS } from '../data/ijebuAreas';
import { canonicalMarketArea } from '../data/marketAreas';

export const EXPLORE_CATEGORY_API_CATEGORIES: Record<string, string[]> = {
  'rice-dishes': ['rice'],
  'swallow-soups': ['swallow', 'soup'],
  'buka-meals': ['rice', 'swallow', 'soup', 'other'],
  'street-food': ['grills', 'snacks', 'other'],
  'grills-shawarma': ['grills'],
  'fast-food': ['fast_food'],
  'snacks-pastries': ['snacks'],
  'drinks-beverages': ['drinks']
};

export type ExploreFilters = {
  category: string;
  search: string;
  marketArea: string;
  neighborhood: string;
  fulfillment: 'all' | 'pickup' | 'delivery';
};

export function readExploreFilters(params: URLSearchParams): ExploreFilters {
  const requestedCategory = params.get('category') || 'all';
  const canonicalCategory = Object.keys(EXPLORE_CATEGORY_API_CATEGORIES).find(value => value.toLocaleLowerCase() === requestedCategory.toLocaleLowerCase());
  const category = requestedCategory.toLocaleLowerCase() === 'all' ? 'all' : canonicalCategory || 'all';
  const requestedNeighborhood = params.get('neighborhood') || 'all';
  const canonicalNeighborhood = IJEBU_ODE_AREAS.find(value => value.toLocaleLowerCase() === requestedNeighborhood.toLocaleLowerCase());
  const neighborhood = requestedNeighborhood.toLocaleLowerCase() === 'all' ? 'all' : canonicalNeighborhood || 'all';
  const requestedFulfillment = params.get('fulfillment');
  const fulfillment = requestedFulfillment === 'pickup' || requestedFulfillment === 'delivery'
    ? requestedFulfillment
    : 'all';

  return {
    category,
    search: (params.get('search') || '').trim(),
    marketArea: canonicalMarketArea(params.get('marketArea')) || 'all',
    neighborhood,
    fulfillment
  };
}

export function updateExploreFilter(params: URLSearchParams, key: keyof ExploreFilters, value: string): URLSearchParams {
  const next = new URLSearchParams(params);
  if (!value || value === 'all') next.delete(key);
  else next.set(key, value.trim());
  return next;
}
