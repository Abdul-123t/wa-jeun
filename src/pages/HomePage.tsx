import React, { useEffect, useState } from 'react';
import { ArrowRight, Clock3, MapPin, Search, Store, UtensilsCrossed } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import heroImage from '../assets/images/hero_nigerian_jollof_feast_1792169660639-optimized.jpg';
import { FOOD_CATEGORIES } from '../data/categories';
import { FoodPhoto } from '../components/FoodPhoto';
import { ScrollReveal } from '../components/ScrollReveal';
import { api, type PublicVendorBusiness } from '../services/api';
import { getPublicStoreAvailability } from '../services/storeHours';
import { formatNaira } from '../utils/currency';
import { MARKET_AREAS } from '../data/marketAreas';

const marketAreaLabel = (value: string) => MARKET_AREAS.find(area => area.id === value)?.label || value;

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [vendors, setVendors] = useState<PublicVendorBusiness[]>([]);
  const [directoryState, setDirectoryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let active = true;
    setDirectoryState('loading');
    api.getVendors().then(response => {
      if (!active) return;
      setVendors(response.vendors);
      setDirectoryState('ready');
    }).catch(() => {
      if (!active) return;
      setVendors([]);
      setDirectoryState('error');
    });
    return () => { active = false; };
  }, [reloadCount]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const search = searchTerm.trim();
    navigate(search ? `/explore?search=${encodeURIComponent(search)}` : '/explore');
  };

  return <main className="bg-[#FFF8E9]">
    <section className="overflow-hidden border-b border-[#123B2A]/10">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-12 lg:px-8 lg:py-14">
        <div className="relative z-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#123B2A]/10 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#123B2A]"><MapPin className="h-3.5 w-3.5" aria-hidden="true"/>Ijebu Ode and Ijagun, Ogun State</p>
          <h1 className="mt-5 max-w-xl font-display text-[2.55rem] font-extrabold leading-[1.04] tracking-tight text-[#123B2A] sm:text-5xl lg:text-[3.7rem]">Discover food in Ijebu Ode and Ijagun.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#20231F]/75 sm:text-lg">Find local restaurants, bukas and the meals they serve — all in one place.</p>
          <form onSubmit={submitSearch} role="search" className="mt-6 flex flex-col gap-2 rounded-2xl border border-[#123B2A]/10 bg-white p-2 shadow-[0_12px_35px_-28px_rgba(18,59,42,.55)] sm:flex-row sm:items-center">
            <label htmlFor="home-food-search" className="sr-only">Search food businesses and meals</label>
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2"><Search className="h-5 w-5 shrink-0 text-[#123B2A]/55" aria-hidden="true"/><input id="home-food-search" type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="What are you hungry for?" className="min-h-11 w-full min-w-0 bg-transparent text-sm text-[#20231F] placeholder:text-[#20231F]/45 focus:outline-none"/></div>
            <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#123B2A] px-5 text-sm font-bold text-white transition-colors hover:bg-[#194d37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">Search food <ArrowRight className="h-4 w-4" aria-hidden="true"/></button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#20231F]/60"><span className="font-semibold text-[#123B2A]">Browse:</span>{FOOD_CATEGORIES.slice(0, 4).map((category, index) => <React.Fragment key={category.id}><Link className="rounded-sm underline decoration-[#123B2A]/25 underline-offset-2 hover:text-[#123B2A] hover:decoration-[#123B2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]" to={`/explore?category=${encodeURIComponent(category.id)}`}>{category.name}</Link>{index < 3 && <span aria-hidden="true">·</span>}</React.Fragment>)}</div>
          <p className="mt-5 inline-flex items-start gap-2 rounded-lg bg-[#123B2A]/[.045] px-3 py-2 text-xs font-medium leading-5 text-[#123B2A]"><UtensilsCrossed className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/>Browse approved local food businesses. Ordering has not launched yet.</p>
        </div>
        <ScrollReveal className="min-w-0">
          <figure className="food-card-hover relative overflow-hidden rounded-[1.6rem] border border-[#123B2A]/10 bg-white shadow-[0_24px_70px_-42px_rgba(18,59,42,.55)]">
            <img src={heroImage} alt="A Nigerian jollof meal served with grilled chicken and plantain" width="1100" height="614" fetchPriority="high" decoding="async" className="food-card-image aspect-[1.55] w-full object-cover sm:aspect-[1.65]"/>
            <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-5 pb-5 pt-16 text-white sm:px-7 sm:pb-7">
              <div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#D7EF83]">Built in Ijebu. Made for Ijebu.</p><p className="mt-1 font-display text-lg font-bold sm:text-xl">Your city. Your food.</p></div>
              <Link to="/explore" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-[#123B2A] transition-colors hover:bg-[#B8D94B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#123B2A]">Explore <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
            </figcaption>
          </figure>
        </ScrollReveal>
      </div>
    </section>

    <section aria-labelledby="market-area-heading" className="border-b border-[#123B2A]/10 bg-[#FFF8E9] py-7">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div><h2 id="market-area-heading" className="font-display text-lg font-bold text-[#123B2A]">Choose your area</h2><p className="mt-1 text-xs text-[#20231F]/65">See approved food businesses serving your part of town.</p></div>
        <div className="flex flex-wrap gap-2">{MARKET_AREAS.map(area => <Link key={area.id} to={`/explore?marketArea=${encodeURIComponent(area.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#123B2A]/15 bg-white px-4 text-sm font-semibold text-[#123B2A] hover:border-[#123B2A]/40 hover:bg-[#123B2A]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">{area.label}<ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>)}</div>
      </div>
    </section>

    <section id="food-categories" className="scroll-mt-24 bg-white py-11 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#123B2A]/55">Follow your craving</p><h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#123B2A] sm:text-3xl">What are you in the mood for?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#20231F]/65">Choose a food category to see matching menus from approved businesses in Ijebu Ode and Ijagun.</p></div><Link to="/explore" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-[#123B2A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">All food categories <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {FOOD_CATEGORIES.map((category, index) => <ScrollReveal key={category.id} delayMs={Math.min(index * 25, 100)} className="h-full"><Link to={`/explore?category=${encodeURIComponent(category.id)}`} className="group food-card-hover block h-full overflow-hidden rounded-2xl border border-[#123B2A]/10 bg-[#FFF8E9] transition-colors hover:border-[#123B2A]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">
            <div className="overflow-hidden"><img src={category.image} alt="" width="768" height="573" loading="lazy" decoding="async" className="food-card-image aspect-[1.5] w-full object-cover"/></div>
            <div className="flex min-h-[4.5rem] items-center justify-between gap-2 px-3 py-3 sm:px-4"><h3 className="font-display text-sm font-bold leading-snug text-[#123B2A] sm:text-base">{category.name}</h3><ArrowRight className="h-4 w-4 shrink-0 text-[#123B2A]/55 transition-transform group-hover:translate-x-0.5 group-hover:text-[#123B2A] motion-reduce:transition-none" aria-hidden="true"/></div>
          </Link></ScrollReveal>)}
        </div>
      </div>
    </section>

    <section className="py-11 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#123B2A]/55">Real local listings</p><h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#123B2A] sm:text-3xl">Food businesses in Ijebu Ode and Ijagun</h2><p className="mt-2 text-sm leading-6 text-[#20231F]/65">Menus come from the businesses listed here. No sample restaurants or made-up ratings.</p></div><Link to="/explore" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-[#123B2A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Explore the directory <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></div>
        {directoryState === 'loading' ? <div role="status" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><span className="sr-only">Loading local food businesses…</span>{[0, 1, 2].map(item => <div key={item} aria-hidden="true" className="overflow-hidden rounded-2xl border border-[#123B2A]/10 bg-white"><div className="aspect-[1.7] animate-pulse bg-[#123B2A]/[.07] motion-reduce:animate-none"/><div className="space-y-3 p-5"><div className="h-4 w-2/3 animate-pulse rounded bg-[#123B2A]/[.08] motion-reduce:animate-none"/><div className="h-3 w-full animate-pulse rounded bg-[#123B2A]/[.06] motion-reduce:animate-none"/><div className="h-10 animate-pulse rounded-xl bg-[#123B2A]/[.06] motion-reduce:animate-none"/></div></div>)}</div>
          : directoryState === 'error' ? <div className="mt-6 rounded-2xl border border-red-200 bg-white p-6 sm:p-8"><h3 className="font-display text-lg font-bold text-[#123B2A]">The food directory could not load</h3><p role="alert" className="mt-2 max-w-2xl text-sm leading-6 text-[#20231F]/70">Please check your connection and try again. We don’t want to show an empty directory when the service is unavailable.</p><button type="button" onClick={() => setReloadCount(count => count + 1)} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#123B2A] px-4 text-sm font-bold text-white hover:bg-[#194d37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">Try again</button></div>
            : vendors.length > 0 ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{vendors.slice(0, 3).map((vendor, index) => <HomeVendorCard key={vendor.id} vendor={vendor} delayMs={index * 35}/>)}</div>
              : <div className="mt-6 rounded-2xl border border-[#123B2A]/10 bg-white p-6 sm:p-8"><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#123B2A]/60"><Store className="h-4 w-4" aria-hidden="true"/>A directory that grows with the city</p><h3 className="mt-2 font-display text-xl font-bold text-[#123B2A]">Local kitchens are joining wá jẹun</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[#20231F]/70">There are no approved, order-ready food businesses to display yet. Join the launch list for updates, or tell us which local kitchen you’d like to discover here.</p><div className="mt-5 flex flex-col gap-2 sm:flex-row"><Link to="/customer-register" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#B8D94B] px-4 text-sm font-bold text-[#123B2A] hover:bg-[#a7c93e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Join the customer launch list</Link><Link to="/legal?tab=contact" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#123B2A]/15 px-4 text-sm font-semibold text-[#123B2A] hover:bg-[#FFF8E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Suggest a food business</Link></div></div>}
      </div>
    </section>

    <section className="border-y border-[#123B2A]/10 bg-white py-11 sm:py-14">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-[1fr_auto] md:items-center lg:px-8"><div><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[#123B2A]/55"><Store className="h-4 w-4" aria-hidden="true"/>For Ijebu food businesses</p><h2 className="mt-2 max-w-2xl font-display text-2xl font-bold text-[#123B2A] sm:text-3xl">Make your menu easier for your neighbours to find.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#20231F]/70">Apply to bring your real food business and menu to Wá Jẹun. Applications are reviewed before a storefront can appear in public discovery.</p></div><Link to="/vendor-register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#123B2A] px-5 text-sm font-bold text-white hover:bg-[#194d37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">Register your food business <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></div>
    </section>
  </main>;
};

function HomeVendorCard({ vendor, delayMs }: { vendor: PublicVendorBusiness; delayMs: number }) {
  const firstMeal = vendor.menu[0];
  const availability = getPublicStoreAvailability(vendor);
  return <ScrollReveal delayMs={delayMs} className="h-full"><article className="food-card-hover h-full overflow-hidden rounded-2xl border border-[#123B2A]/10 bg-white shadow-[0_5px_18px_-14px_rgba(18,59,42,.45)]"><FoodPhoto src={firstMeal?.image_url || null} alt={firstMeal?.name || ''} className="food-card-image aspect-[1.7] w-full"/><div className="p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-display text-lg font-bold leading-snug text-[#123B2A]">{vendor.business_name}</h3><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${availability.open ? 'bg-[#B8D94B]/25 text-[#123B2A]' : 'bg-[#20231F]/5 text-[#20231F]/65'}`}>{availability.open ? 'Open' : 'Closed'}</span></div><p className="mt-1 flex items-center gap-1.5 text-xs text-[#20231F]/60"><MapPin className="h-3.5 w-3.5 text-[#123B2A]" aria-hidden="true"/>{marketAreaLabel(vendor.market_area)} · {vendor.neighborhood}</p><p className="mt-2 text-xs text-[#20231F]/60">{vendor.street_address || vendor.nearby_landmark ? [vendor.street_address, vendor.nearby_landmark].filter(Boolean).join(" · ") : "Location details will be confirmed by this business."}</p><p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-[#20231F]/70">{vendor.description}</p><p className="mt-2 text-xs leading-5 text-[#20231F]/60">{vendor.fulfillment_options === 'pickup_only' ? 'Customer pickup' : vendor.fulfillment_options === 'vendor_delivery' ? 'Vendor-managed delivery' : 'Customer pickup and vendor-managed delivery'}{vendor.delivery_coverage.length > 0 ? ` · Delivery to ${vendor.delivery_coverage.map(marketAreaLabel).join(', ')}` : ''}</p>{firstMeal && <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#123B2A]/10 pt-3 text-sm"><span className="line-clamp-1 text-[#20231F]/75">{firstMeal.name}</span><strong className="shrink-0 text-[#123B2A]">{formatNaira(firstMeal.price_ngn)}</strong></div>}<p className="mt-3 flex items-center gap-2 text-xs text-[#20231F]/55"><Clock3 className="h-3.5 w-3.5" aria-hidden="true"/>{availability.label}</p><Link to={`/vendors/${encodeURIComponent(vendor.id)}/menu`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#123B2A]/20 text-sm font-bold text-[#123B2A] hover:bg-[#123B2A] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">View menu <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></div></article></ScrollReveal>;
}
