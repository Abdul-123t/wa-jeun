import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Clock3, MapPin, MessageSquarePlus, Search, Store, UtensilsCrossed, X } from 'lucide-react';
import { FOOD_CATEGORIES, IJEBU_ODE_AREAS } from '../data/categories';
import { api, type PublicVendorBusiness } from '../services/api';
import { getPublicStoreAvailability } from '../services/storeHours';
import { FoodPhoto } from '../components/FoodPhoto';
import { ScrollReveal } from '../components/ScrollReveal';
import { formatNaira } from '../utils/currency';
import { EXPLORE_CATEGORY_API_CATEGORIES, readExploreFilters, updateExploreFilter } from '../utils/exploreFilters';
import { MARKET_AREAS } from '../data/marketAreas';

const marketAreaLabel = (value: string) => MARKET_AREAS.find(area => area.id === value)?.label || value;

export const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readExploreFilters(searchParams);
  const { category: selectedCategory, search: searchTerm, marketArea, neighborhood: selectedArea, fulfillment: fulfillmentFilter } = filters;
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const [vendors, setVendors] = useState<PublicVendorBusiness[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [vendorLoadError, setVendorLoadError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let current = true;
    setIsLoading(true);
    setVendorLoadError('');
    api.getVendors({
      categories: selectedCategory === 'all' ? undefined : EXPLORE_CATEGORY_API_CATEGORIES[selectedCategory],
      search: debouncedSearch || undefined,
      marketArea: marketArea === 'all' ? undefined : marketArea,
      neighborhood: selectedArea === 'all' ? undefined : selectedArea,
      fulfillment: fulfillmentFilter === 'all' ? undefined : fulfillmentFilter
    }).then(response => {
      if (current) setVendors(response.vendors);
    }).catch(error => {
      if (!current) return;
      setVendors([]);
      setVendorLoadError(error instanceof Error ? error.message : 'The live food directory is temporarily unavailable.');
    }).finally(() => { if (current) setIsLoading(false); });
    return () => { current = false; };
  }, [selectedCategory, debouncedSearch, marketArea, selectedArea, fulfillmentFilter, reloadCount]);

  const currentCategoryData = FOOD_CATEGORIES.find(category => category.id === selectedCategory);
  const hasActiveFilters = Boolean(searchTerm || selectedCategory !== 'all' || marketArea !== 'all' || selectedArea !== 'all' || fulfillmentFilter !== 'all');
  const resultLabel = useMemo(() => vendors.length === 1 ? '1 food business' : `${vendors.length} food businesses`, [vendors.length]);
  const setFilter = (key: 'category' | 'search' | 'marketArea' | 'neighborhood' | 'fulfillment', value: string, replace = false) => {
    setSearchParams(updateExploreFilter(searchParams, key, value), { replace });
  };
  const clearFilters = () => setSearchParams({}, { replace: true });

  return <main className="min-h-screen bg-[#FFF8E9] pb-16">
    <section className="border-b border-[#123B2A]/10 bg-white py-8 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-5 px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#20231F]/60"><Link to="/" className="rounded-sm hover:text-[#123B2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Home</Link><span aria-hidden="true">/</span><span className="font-semibold text-[#123B2A]">Explore food</span>{currentCategoryData && <><span aria-hidden="true">/</span><span className="font-semibold text-[#123B2A]">{currentCategoryData.name}</span></>}</nav>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div className="max-w-3xl"><p className="inline-flex items-center gap-1.5 rounded-full bg-[#123B2A]/5 px-3 py-1 text-xs font-semibold text-[#123B2A]"><MapPin className="h-3.5 w-3.5" aria-hidden="true"/>{marketArea === 'all' ? 'Ijebu Ode and Ijagun' : marketAreaLabel(marketArea)} · Ogun State</p><h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-[#123B2A] sm:text-4xl">Find food around you</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#20231F]/70 sm:text-base">Explore real local food businesses, see what’s on their menus, and check when they’re open.</p></div><Link to="/customer-register" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#B8D94B] px-5 text-sm font-bold text-[#123B2A] transition-colors hover:bg-[#a7c93e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">Join the launch list <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></div>
        <div className="max-w-2xl"><label htmlFor="food-search" className="sr-only">Search businesses or menu items</label><div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#123B2A]/45" aria-hidden="true"/><input id="food-search" type="search" value={searchTerm} onChange={event => setFilter('search', event.target.value, true)} placeholder="Search food businesses or meals" className="min-h-12 w-full rounded-xl border border-[#123B2A]/15 bg-[#FFF8E9]/50 pl-12 pr-11 text-sm text-[#20231F] placeholder:text-[#20231F]/45 focus:border-[#123B2A]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#123B2A]/15"/>{searchTerm && <button type="button" onClick={() => setFilter('search', '', true)} aria-label="Clear search" className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[#20231F]/60 hover:bg-[#123B2A]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"><X className="h-4 w-4" aria-hidden="true"/></button>}</div><p className="mt-2 text-xs text-[#20231F]/55">Search names and menu items. Use filters to narrow by neighborhood or pickup and delivery.</p>{searchTerm !== debouncedSearch && <p role="status" className="mt-1 text-xs font-medium text-[#123B2A]/70">Updating results…</p>}</div>
      </div>
    </section>

    <div className="mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6 lg:px-8">
      <section id="food-categories" aria-label="Filter food businesses" className="scroll-mt-24 space-y-4"><div><div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-xs font-bold uppercase tracking-[.12em] text-[#123B2A]">Food category</h2>{selectedCategory !== 'all' && <button type="button" onClick={() => setFilter('category', '')} className="min-h-9 rounded px-2 text-xs font-semibold text-[#123B2A] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Show all</button>}</div><div className="flex gap-2 overflow-x-auto pb-2"><CategoryButton active={selectedCategory === 'all'} onClick={() => setFilter('category', 'all')}>All food</CategoryButton>{FOOD_CATEGORIES.map(category => <CategoryButton key={category.id} active={selectedCategory === category.id} onClick={() => setFilter('category', category.id)}>{category.name}</CategoryButton>)}</div></div>
        <div className="flex flex-col gap-3 rounded-2xl border border-[#123B2A]/10 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center"><label className="flex min-h-10 flex-1 flex-col justify-center gap-1 text-xs font-semibold text-[#20231F]/65 sm:min-w-56 sm:flex-row sm:items-center"><span className="shrink-0">Neighborhood</span><select value={selectedArea} onChange={event => setFilter('neighborhood', event.target.value)} className="min-h-10 w-full rounded-lg border border-[#123B2A]/15 bg-[#FFF8E9]/60 px-3 text-sm font-medium text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A]/20 sm:max-w-xs"><option value="all">All neighborhoods</option>{IJEBU_ODE_AREAS.map(area => <option key={area} value={area}>{area}</option>)}</select></label><label className="flex min-h-10 flex-1 flex-col justify-center gap-1 text-xs font-semibold text-[#20231F]/65 sm:min-w-56 sm:flex-row sm:items-center"><span className="shrink-0">Fulfillment</span><select value={fulfillmentFilter} onChange={event => setFilter('fulfillment', event.target.value)} className="min-h-10 w-full rounded-lg border border-[#123B2A]/15 bg-[#FFF8E9]/60 px-3 text-sm font-medium text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A]/20 sm:max-w-xs"><option value="all">Pickup or delivery</option><option value="pickup">Customer pickup</option><option value="delivery">Vendor-managed delivery</option></select></label>{hasActiveFilters && <button type="button" onClick={clearFilters} className="min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold text-[#123B2A] hover:bg-[#123B2A]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Clear filters</button>}</div>
      </section>

      {currentCategoryData && <section className="grid gap-4 overflow-hidden rounded-2xl border border-[#123B2A]/10 bg-white p-4 sm:grid-cols-[180px_1fr] sm:items-center sm:p-5"><img src={currentCategoryData.image} alt="" width="768" height="573" loading="lazy" decoding="async" className="h-36 w-full rounded-xl object-cover sm:h-32"/><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#123B2A]/60">Selected category</p><h2 className="mt-1 font-display text-xl font-bold text-[#123B2A]">{currentCategoryData.name}</h2><p className="mt-1 text-sm leading-6 text-[#20231F]/70">{currentCategoryData.description}</p></div></section>}

      <label className="flex max-w-xl flex-col gap-1 rounded-xl border border-[#123B2A]/10 bg-white p-4 text-xs font-semibold text-[#20231F]/65 sm:flex-row sm:items-center sm:gap-3"><span>Market area</span><select value={marketArea} onChange={event => { const next = updateExploreFilter(searchParams, 'marketArea', event.target.value); if (event.target.value === 'ijagun') next.delete('neighborhood'); setSearchParams(next); }} className="min-h-10 w-full rounded-lg border border-[#123B2A]/15 bg-[#FFF8E9]/60 px-3 text-sm font-medium text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A]/20 sm:max-w-xs"><option value="all">All supported areas</option>{MARKET_AREAS.map(area => <option key={area.id} value={area.id}>{area.label}</option>)}</select></label>

      <section aria-label="Available food businesses" aria-busy={isLoading}><div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-display text-xl font-bold text-[#123B2A]">Local kitchens</h2>{!isLoading && !vendorLoadError && <p role="status" aria-live="polite" aria-atomic="true" className="text-xs font-medium text-[#20231F]/55">{resultLabel}</p>}</div>
        {isLoading ? <div role="status" aria-label="Loading food businesses" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><span className="sr-only">Loading food businesses…</span>{[0, 1, 2].map(index => <div key={index} aria-hidden="true" className="overflow-hidden rounded-2xl border border-[#123B2A]/10 bg-white"><div className="h-44 animate-pulse bg-[#123B2A]/[.07] motion-reduce:animate-none"/><div className="space-y-3 p-5"><div className="h-3 w-1/3 animate-pulse rounded bg-[#123B2A]/[.08] motion-reduce:animate-none"/><div className="h-5 w-2/3 animate-pulse rounded bg-[#123B2A]/[.08] motion-reduce:animate-none"/><div className="h-3 w-full animate-pulse rounded bg-[#123B2A]/[.06] motion-reduce:animate-none"/><div className="h-10 animate-pulse rounded-xl bg-[#123B2A]/[.06] motion-reduce:animate-none"/></div></div>)}</div>
          : vendorLoadError ? <div className="rounded-2xl border border-red-200 bg-white p-7 text-center sm:p-10"><h3 className="font-display text-xl font-bold text-[#123B2A]">We couldn’t load the food directory</h3><p role="alert" className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#20231F]/70">{vendorLoadError}</p><button type="button" onClick={() => setReloadCount(value => value + 1)} className="mt-5 min-h-11 rounded-xl bg-[#123B2A] px-5 text-sm font-semibold text-white hover:bg-[#194d37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">Try again</button></div>
            : vendors.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{vendors.map((vendor, index) => <VendorCard key={vendor.id} vendor={vendor} revealDelayMs={Math.min(index * 40, 120)}/>)}</div>
              : <div className="rounded-2xl border border-[#123B2A]/10 bg-white px-5 py-10 text-center sm:px-10"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#FFF8E9] text-[#123B2A]"><UtensilsCrossed className="h-7 w-7" aria-hidden="true"/></div><h3 className="mt-4 font-display text-xl font-bold text-[#123B2A]">{hasActiveFilters ? 'No kitchens match those filters' : 'Local kitchens are joining wá jẹun'}</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#20231F]/70">{hasActiveFilters ? 'Try a different dish, category, neighborhood, or fulfillment option.' : 'Approved food businesses will appear here when their storefronts are complete, their menus have available items, and they are accepting orders.'}</p><div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row"><Link to="/customer-register" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#B8D94B] px-4 text-sm font-bold text-[#123B2A] hover:bg-[#a7c93e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Join the launch list <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link><Link to="/legal?tab=contact" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#123B2A]/15 px-4 text-sm font-semibold text-[#123B2A] hover:bg-[#FFF8E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"><MessageSquarePlus className="h-4 w-4" aria-hidden="true"/>Suggest a food business</Link></div></div>}
      </section>
    </div>
  </main>;
};

const CategoryButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => <button type="button" onClick={onClick} aria-pressed={active} className={`min-h-10 shrink-0 rounded-xl px-4 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] ${active ? 'bg-[#123B2A] text-white' : 'border border-[#123B2A]/15 bg-white text-[#20231F] hover:border-[#123B2A]/40'}`}>{children}</button>;

const VendorCard: React.FC<{ vendor: PublicVendorBusiness; revealDelayMs?: number }> = ({ vendor, revealDelayMs = 0 }) => {
  const availability = getPublicStoreAvailability(vendor);
  const featuredItem = vendor.menu.find(item => item.image_url);
  const categories = [...new Set(vendor.menu.map(item => item.category.replaceAll('_', ' ')))];
  const fulfillment = vendor.fulfillment_options === 'pickup_only' ? 'Customer pickup' : vendor.fulfillment_options === 'vendor_delivery' ? 'Vendor-managed delivery' : vendor.fulfillment_options === 'pickup_and_delivery' ? 'Pickup & delivery' : 'Delivery varies';
  return <ScrollReveal delayMs={revealDelayMs} className="h-full"><article className="food-card-hover h-full overflow-hidden rounded-2xl border border-[#123B2A]/10 bg-white shadow-[0_5px_18px_-14px_rgba(18,59,42,.45)] transition-shadow hover:shadow-[0_12px_28px_-18px_rgba(18,59,42,.5)]"><FoodPhoto src={featuredItem?.image_url || null} alt={featuredItem?.name || ''} className="food-card-image h-48 w-full"/><div className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-xs text-[#20231F]/60"><MapPin className="h-3.5 w-3.5 text-[#123B2A]" aria-hidden="true"/>{marketAreaLabel(vendor.market_area)} · {vendor.neighborhood}</p><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${availability.open ? 'bg-[#B8D94B]/25 text-[#123B2A]' : 'bg-[#20231F]/5 text-[#20231F]/65'}`}><span className={`size-1.5 rounded-full ${availability.open ? 'bg-[#567517]' : 'bg-[#20231F]/35'}`} aria-hidden="true"/>{availability.open ? 'Open' : 'Closed'}</span></div><h3 className="mt-2 font-display text-xl font-bold leading-tight text-[#123B2A]">{vendor.business_name}</h3><p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-[#20231F]/70">{vendor.description}</p><p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#20231F]/60"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#123B2A]/60" aria-hidden="true"/>{availability.label}</p><p className="mt-1 text-xs leading-5 text-[#20231F]/60">{vendor.street_address || vendor.nearby_landmark ? [vendor.street_address, vendor.nearby_landmark].filter(Boolean).join(" · ") : "Location details will be confirmed by this business."}</p><p className="mt-1 flex items-start gap-2 text-xs leading-5 text-[#20231F]/60"><Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#123B2A]/60" aria-hidden="true"/>{fulfillment}</p><div className="mt-3 flex flex-wrap gap-1.5">{categories.slice(0, 3).map(category => <span key={category} className="rounded-full bg-[#FFF8E9] px-2.5 py-1 text-[10px] font-semibold capitalize text-[#123B2A]">{category}</span>)}</div><ul className="mt-4 space-y-2 border-t border-[#123B2A]/10 pt-3">{vendor.menu.slice(0, 2).map(item => <li key={item.id} className="flex items-start justify-between gap-3 text-sm"><span className="line-clamp-1 text-[#20231F]/80">{item.name}</span><strong className="shrink-0 font-semibold text-[#123B2A]">{formatNaira(item.price_ngn)}</strong></li>)}</ul><Link to={`/vendors/${encodeURIComponent(vendor.id)}/menu`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#123B2A]/20 text-sm font-bold text-[#123B2A] transition-colors hover:bg-[#123B2A] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">View menu <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></div></article></ScrollReveal>;
};
