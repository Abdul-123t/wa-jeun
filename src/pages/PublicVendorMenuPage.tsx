import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock3, MapPin, ShoppingBag, Store, UtensilsCrossed } from 'lucide-react';
import { FoodPhoto } from '../components/FoodPhoto';
import { api, type PublicMenuItem, type PublicVendorBusiness } from '../services/api';
import { useCart } from '../services/CartContext';
import { getPublicStoreAvailability } from '../services/storeHours';
import { formatNaira } from '../utils/currency';

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export const PublicVendorMenuPage: React.FC = () => {
  const { businessId = '' } = useParams();
  const [vendor, setVendor] = useState<PublicVendorBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartMessage, setCartMessage] = useState('');
  const [pendingCartItem, setPendingCartItem] = useState<PublicMenuItem | null>(null);
  const { cart, addItem, replaceCartWithItem } = useCart();

  useEffect(() => {
    let active = true;
    setVendor(null);
    setError('');
    setLoading(true);
    api.getPublicVendorMenu(businessId)
      .then(result => { if (active) setVendor(result.vendor); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'This food business is not currently available.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId]);

  const availability = vendor ? getPublicStoreAvailability(vendor) : null;
  const fulfillment = vendor?.fulfillment_options === 'pickup_only' ? ['Customer pickup']
    : vendor?.fulfillment_options === 'vendor_delivery' ? ['Vendor-managed delivery']
      : vendor?.fulfillment_options === 'pickup_and_delivery' ? ['Customer pickup', 'Vendor-managed delivery'] : [];
  const cartItemCount = cart?.lines.reduce((total, line) => total + line.quantity, 0) || 0;
  const addMenuItem = (item: PublicMenuItem) => {
    if (!vendor) return;
    const result = addItem(vendor, item);
    if (result === 'different_vendor') {
      setPendingCartItem(item);
      setCartMessage(`Your cart has items from ${cart?.vendorName || 'another business'}. Choose whether to clear it before adding from ${vendor.business_name}.`);
      return;
    }
    setPendingCartItem(null);
    setCartMessage(`${item.name} added to your cart.`);
  };

  return <main className="min-h-[70vh] bg-[#FFF8E9] px-4 py-8 sm:px-6 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <Link to="/explore" className="inline-flex min-h-10 items-center gap-2 rounded-lg pr-2 text-sm font-semibold text-[#123B2A] hover:text-[#315f43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"><ArrowLeft className="h-4 w-4" aria-hidden="true"/>Back to food discovery</Link>
      {loading ? <div role="status" className="mt-8 grid min-h-72 place-items-center rounded-3xl border border-[#123B2A]/10 bg-white p-8 text-center text-sm text-[#123B2A]/70"><span className="size-7 animate-spin rounded-full border-2 border-[#123B2A]/15 border-t-[#123B2A]" aria-hidden="true"/>Loading this kitchen’s menu…</div>
        : error ? <section className="mt-6 rounded-3xl border border-[#123B2A]/10 bg-white px-5 py-12 text-center sm:px-10"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#FFF8E9] text-[#123B2A]"><Store className="h-7 w-7" aria-hidden="true"/></div><h1 className="mt-4 font-display text-2xl font-bold text-[#123B2A]">This menu isn’t available</h1><p role="alert" className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#20231F]/70">{error}</p><Link to="/explore" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#123B2A] px-5 text-sm font-semibold text-white hover:bg-[#194d37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">Browse available kitchens</Link></section>
          : vendor && availability && <>
            <header className="mt-5 overflow-hidden rounded-3xl bg-[#123B2A] text-white">
              <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(300px,.82fr)]">
                <div className="p-6 sm:p-8 lg:p-10">
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-[#B8D94B]">Ijebu Ode · Local kitchen</p>
                  <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">{vendor.business_name}</h1>
                  <p className="mt-3 flex items-center gap-2 text-sm text-white/75"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true"/>{vendor.neighborhood}</p>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-white/80">{vendor.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">{fulfillment?.map(option => <span key={option} className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90">{option}</span>)}</div>
                  <p className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${availability.open ? 'bg-[#B8D94B] text-[#123B2A]' : 'bg-white/10 text-white/85'}`}><span className={`size-2 rounded-full ${availability.open ? 'bg-[#123B2A]' : 'bg-white/50'}`} aria-hidden="true"/>{availability.label}</p>
                  <p className="mt-4 text-xs text-white/65">Browse this kitchen’s current menu and opening hours.</p>
                </div>
                <div className="min-h-56 md:min-h-full"><FoodPhoto src={vendor.menu.find(item => item.image_url)?.image_url || null} alt={vendor.menu.find(item => item.image_url)?.name || ''} className="h-full min-h-56 w-full bg-white/10"/></div>
              </div>
            </header>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p role="status" aria-live="polite" className="text-sm font-medium text-[#123B2A]">{cartMessage}</p>
              {cartItemCount > 0 && <Link to="/cart" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#123B2A] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2"><ShoppingBag className="h-4 w-4" aria-hidden="true"/>View cart · {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}</Link>}
            </div>
            {pendingCartItem && cart && <div className="mt-3 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"><p>Clear the {cart.vendorName} cart and start a new cart for {vendor.business_name}?</p><div className="flex gap-2"><button type="button" onClick={() => { replaceCartWithItem(vendor, pendingCartItem); setCartMessage(`${pendingCartItem.name} added to your new cart.`); setPendingCartItem(null); }} className="min-h-10 rounded-lg bg-[#123B2A] px-3 font-semibold text-white">Clear cart and add</button><button type="button" onClick={() => setPendingCartItem(null)} className="min-h-10 rounded-lg border border-[#123B2A]/20 px-3 font-semibold text-[#123B2A]">Keep current cart</button></div></div>}

            <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div>
                <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#123B2A]/60">Prepared by this kitchen</p><h2 className="mt-1 font-display text-2xl font-bold text-[#123B2A]">Available menu</h2></div><span className="text-xs font-medium text-[#20231F]/55">{vendor.menu.length} {vendor.menu.length === 1 ? 'item' : 'items'}</span></div>
                {vendor.menu.length ? <div className="grid gap-4 sm:grid-cols-2">{vendor.menu.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-[#123B2A]/10 bg-white shadow-[0_5px_18px_-14px_rgba(18,59,42,.45)]"><FoodPhoto src={item.image_url} alt={item.name} className="h-48 w-full"/><div className="p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-display text-lg font-bold leading-snug text-[#123B2A]">{item.name}</h3><strong className="shrink-0 text-sm font-bold text-[#123B2A]">{formatNaira(item.price_ngn)}</strong></div>{item.description && <p className="mt-2 text-sm leading-6 text-[#20231F]/70">{item.description}</p>}<div className="mt-4 flex items-center justify-between gap-3 border-t border-[#123B2A]/10 pt-3"><span className="inline-flex items-center gap-1.5 text-xs capitalize text-[#20231F]/55"><UtensilsCrossed className="h-3.5 w-3.5" aria-hidden="true"/>{item.category.replaceAll('_', ' ')}</span><span className="rounded-full bg-[#B8D94B]/25 px-2.5 py-1 text-[10px] font-bold text-[#123B2A]">Available</span></div><button type="button" disabled={!availability.open} onClick={() => addMenuItem(item)} className="mt-4 min-h-11 w-full rounded-xl bg-[#123B2A] px-4 text-sm font-bold text-white hover:bg-[#194d37] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">{availability.open ? 'Add to cart' : 'Unavailable while closed'}</button></div></article>)}</div>
                  : <div className="rounded-2xl border border-[#123B2A]/10 bg-white p-8 text-sm text-[#20231F]/70">There are no menu items currently available from this kitchen.</div>}
              </div>

              <aside className="h-fit rounded-2xl border border-[#123B2A]/10 bg-white p-5 sm:p-6"><h2 className="font-display text-lg font-bold text-[#123B2A]">Opening hours</h2><p className="mt-1 text-xs text-[#20231F]/55">Local time · Ijebu Ode (WAT)</p><ul className="mt-4 space-y-2">{weekdays.map(day => { const hours = vendor.opening_hours![day]; return <li key={day} className="flex items-center justify-between gap-3 border-b border-[#123B2A]/5 pb-2 text-xs"><span className="capitalize font-medium text-[#20231F]/70">{day}</span><span className="text-right text-[#20231F]/65">{hours.closed ? 'Closed' : `${hours.open} – ${hours.close}`}</span></li>; })}</ul><div className="mt-4 rounded-xl bg-[#FFF8E9] p-3"><p className="flex items-center gap-2 text-xs font-bold text-[#123B2A]"><Clock3 className="h-4 w-4" aria-hidden="true"/>Store availability</p><p className="mt-1 text-xs leading-5 text-[#20231F]/70">{availability.label}</p></div><p className="mt-4 text-xs leading-5 text-[#20231F]/55">This business manages its own delivery. Confirm delivery coverage with the kitchen when ordering becomes available.</p></aside>
            </section>
          </>}
    </div>
  </main>;
};
