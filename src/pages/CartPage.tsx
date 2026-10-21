import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../services/CartContext';
import { api, type PublicVendorBusiness } from '../services/api';
import { getPublicStoreAvailability } from '../services/storeHours';
import { formatNaira } from '../utils/currency';
import { normalizeEmail, normalizeNigerianPhone } from '../server/validation';
import { checkoutIntentFingerprint, clearCheckoutAttempt, persistCheckoutAttempt, readCheckoutAttempt } from '../services/checkoutAttempt';
import { findCartPriceChanges, type CartPriceChange } from '../services/cartPricing';

export const CartPage: React.FC = () => {
  const { cart, setQuantity, removeItem, syncLine, clearCart } = useCart();
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<PublicVendorBusiness | null>(null);
  const [menuError, setMenuError] = useState('');
  const [loading, setLoading] = useState(Boolean(cart));
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'vendor_delivery'>('pickup');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [priceChanges, setPriceChanges] = useState<CartPriceChange[]>([]);
  const [priceChangesConfirmed, setPriceChangesConfirmed] = useState(true);
  const [menuReload, setMenuReload] = useState(0);

  useEffect(() => {
    if (!cart?.vendorId) { setVendor(null); setLoading(false); return; }
    let active = true;
    setLoading(true); setMenuError('');
    api.getPublicVendorMenu(cart.vendorId).then(result => {
      if (!active) return;
      const changes = findCartPriceChanges(cart.lines, result.vendor.menu);
      setPriceChanges(changes);
      setPriceChangesConfirmed(changes.length === 0);
      setVendor(result.vendor);
      result.vendor.menu.forEach(syncLine);
      const pickup = ['pickup_only', 'pickup_and_delivery'].includes(result.vendor.fulfillment_options);
      const canDeliver = ['vendor_delivery', 'pickup_and_delivery'].includes(result.vendor.fulfillment_options) && result.vendor.delivery_fee_ngn !== null && Number.isFinite(Number(result.vendor.delivery_fee_ngn));
      setFulfillment(pickup || !canDeliver ? 'pickup' : 'vendor_delivery');
    }).catch(reason => { if (active) setMenuError(reason instanceof Error ? reason.message : 'This business is no longer available.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cart?.vendorId, menuReload]);

  useEffect(() => { if (!customerName && user) setCustomerName(String(user.user_metadata?.full_name || '')); }, [user]);
  useEffect(() => { if (!customerEmail && user?.email) setCustomerEmail(user.email); }, [user]);

  const currentItems = useMemo(() => cart?.lines.map(line => ({ line, current: vendor?.menu.find(item => item.id === line.menuItemId) || null })) || [], [cart, vendor]);
  const subtotal = currentItems.reduce((sum, item) => sum + (item.current ? Number(item.current.price_ngn) * item.line.quantity : 0), 0);
  const deliveryFee = fulfillment === 'vendor_delivery' ? vendor?.delivery_fee_ngn ?? null : 0;
  const total = subtotal + (deliveryFee ?? 0);
  const availability = vendor ? getPublicStoreAvailability(vendor) : null;
  const hasUnavailable = currentItems.some(item => !item.current);
  const supportsPickup = ['pickup_only', 'pickup_and_delivery'].includes(vendor?.fulfillment_options || '');
  const supportsDelivery = ['vendor_delivery', 'pickup_and_delivery'].includes(vendor?.fulfillment_options || '') && vendor?.delivery_fee_ngn !== null && vendor?.delivery_fee_ngn !== undefined && Number.isFinite(Number(vendor.delivery_fee_ngn)) && Number(vendor.delivery_fee_ngn) >= 0;
  const checkoutEnabled = !import.meta.env.PROD;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!session?.access_token || !user || !cart || !vendor || !availability?.open || hasUnavailable) return;
    if (fulfillment === 'vendor_delivery' && deliveryFee === null) { setError('This business has not configured a delivery fee. Choose pickup or contact the business.'); return; }
    setSubmitting(true);
    try {
      const phone = normalizeNigerianPhone(customerPhone);
      if (!phone) { setError('Enter a valid Nigerian phone number.'); return; }
      const email = normalizeEmail(customerEmail);
      if (!email) { setError('Enter a valid email address for Flutterwave test checkout.'); return; }
      const intent = { customerId: user!.id, customerName: customerName.trim().replace(/\s+/g, ' '), customerPhone: phone,
        fulfillmentMethod: fulfillment, deliveryAddress: fulfillment === 'vendor_delivery' ? address.trim().replace(/\s+/g, ' ') : null,
        expectedDeliveryFeeNgn: fulfillment === 'vendor_delivery' ? Number(deliveryFee) : null,
        items: cart.lines.map(line => ({ menuItemId: line.menuItemId, quantity: line.quantity, expectedPriceNgn: Number(currentItems.find(entry => entry.line.menuItemId === line.menuItemId)?.current?.price_ngn) })) } as const;
      const fingerprint = await checkoutIntentFingerprint(intent);
      let attempt = readCheckoutAttempt(user!.id);
      if (attempt && attempt.fingerprint !== fingerprint) {
        try {
          const previous = await api.getCustomerOrderAttempt(session.access_token, attempt.idempotencyKey);
          clearCart(); clearCheckoutAttempt(user!.id, attempt.idempotencyKey);
          navigate(`/orders?placed=${encodeURIComponent(previous.order.orderReference)}`);
          return;
        } catch (lookupError) {
          if (!(lookupError instanceof Error && 'status' in lookupError && (lookupError as { status?: number }).status === 404)) throw new Error('We could not confirm the earlier checkout. Check your order history or retry that attempt before starting another.');
          // Keep the same key after a 404. An earlier request may still be finishing;
          // reusing this key lets the database unique constraint serialize both requests.
        }
      }
      const key = attempt?.idempotencyKey || crypto.randomUUID();
      persistCheckoutAttempt(user!.id, { idempotencyKey: key, fingerprint });
      const result = await api.startFlutterwaveTestCheckout(session.access_token, {
        customerName, customerPhone, customerEmail: email, fulfillmentMethod: fulfillment, deliveryAddress: fulfillment === 'vendor_delivery' ? address : null,
        items: intent.items.map(line => ({ ...line })), expectedDeliveryFeeNgn: intent.expectedDeliveryFeeNgn, idempotencyKey: key
      });
      window.location.assign(result.checkoutUrl);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'We could not start the test checkout. Retry this same checkout; its saved attempt key will prevent a duplicate.';
      setError(message);
      if (/price (has )?changed|menu item.*unavailable|vendor.*not accepting/i.test(message)) setMenuReload(value => value + 1);
    }
    finally { setSubmitting(false); }
  };

  return <main className="min-h-[70vh] bg-[#FFF8E9] px-4 py-8 sm:px-6 sm:py-12"><div className="mx-auto max-w-4xl">
    <Link to="/explore" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#123B2A]"><ArrowLeft className="h-4 w-4"/>Continue browsing</Link>
    <header className="mt-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#123B2A]/55">Your basket</p><h1 className="mt-1 font-display text-3xl font-bold text-[#123B2A]">Cart and checkout</h1></header>
    {!cart?.lines.length ? <section className="mt-6 rounded-3xl border border-[#123B2A]/10 bg-white px-5 py-14 text-center"><ShoppingBag className="mx-auto h-10 w-10 text-[#123B2A]/55"/><h2 className="mt-4 font-display text-xl font-bold text-[#123B2A]">Your cart is empty</h2><p className="mt-2 text-sm text-[#20231F]/70">Choose dishes from one food business to begin.</p><Link to="/explore" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#123B2A] px-5 text-sm font-bold text-white">Explore food</Link></section> : <>
      {loading && <p role="status" className="mt-5 rounded-xl bg-white p-4 text-sm text-[#123B2A]/70">Refreshing menu and prices…</p>}
      {menuError && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{menuError} <button onClick={clearCart} className="font-bold underline">Clear cart</button></p>}
      {priceChanges.length > 0 && !priceChangesConfirmed && <section role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><h2 className="font-bold">Menu prices changed</h2><p className="mt-1">Review the current prices before continuing. Your total uses the current menu prices.</p><ul className="mt-2 list-inside list-disc">{priceChanges.map(change => <li key={change.menuItemId}>{change.name}: {formatNaira(change.previousPriceNgn)} → {formatNaira(change.currentPriceNgn)}</li>)}</ul><button type="button" onClick={() => setPriceChangesConfirmed(true)} className="mt-3 min-h-10 rounded-lg bg-[#123B2A] px-3 font-semibold text-white">I’ve reviewed the updated prices</button></section>}
      {cart && <section className="mt-5 rounded-2xl border border-[#123B2A]/10 bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-[#123B2A]">{vendor?.business_name || cart.vendorName}</h2><p className="text-sm text-[#20231F]/60">{vendor?.neighborhood || 'Ijebu Ode'}</p></div><button type="button" onClick={clearCart} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#123B2A]/15 px-3 text-xs font-semibold text-[#123B2A]"><Trash2 className="h-4 w-4"/>Clear cart</button></div>
        <ul className="mt-5 divide-y divide-[#123B2A]/10">{currentItems.map(({ line, current }) => <li key={line.menuItemId} className="flex flex-wrap items-center gap-3 py-4"><div className="min-w-40 flex-1"><p className="font-semibold text-[#123B2A]">{current?.name || line.name}</p><p className="text-sm text-[#20231F]/60">{current ? formatNaira(current.price_ngn) : 'No longer available'}</p></div><div className="flex items-center gap-2"><button aria-label={`Decrease ${line.name} quantity`} disabled={line.quantity <= 1} onClick={() => setQuantity(line.menuItemId, line.quantity - 1)} className="grid size-9 place-items-center rounded-lg border border-[#123B2A]/20 disabled:opacity-40"><Minus className="h-4 w-4"/></button><span aria-live="polite" className="w-6 text-center text-sm font-semibold">{line.quantity}</span><button aria-label={`Increase ${line.name} quantity`} disabled={line.quantity >= 99} onClick={() => setQuantity(line.menuItemId, line.quantity + 1)} className="grid size-9 place-items-center rounded-lg border border-[#123B2A]/20 disabled:opacity-40"><Plus className="h-4 w-4"/></button><button aria-label={`Remove ${line.name}`} onClick={() => removeItem(line.menuItemId)} className="ml-1 grid size-9 place-items-center rounded-lg text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4"/></button></div><strong className="w-full text-right text-sm text-[#123B2A] sm:w-28">{current ? formatNaira(Number(current.price_ngn) * line.quantity) : '—'}</strong></li>)}</ul>
      </section>}

      {vendor && <form onSubmit={submit} className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]"><section className="rounded-2xl border border-[#123B2A]/10 bg-white p-5 sm:p-7"><h2 className="font-display text-xl font-bold text-[#123B2A]">Checkout details</h2><label className="mt-4 block text-sm font-semibold text-[#123B2A]">Your name<input required minLength={2} maxLength={120} autoComplete="name" value={customerName} onChange={event => setCustomerName(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#123B2A]/15 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#123B2A]/20"/></label><label className="mt-3 block text-sm font-semibold text-[#123B2A]">Email for test receipt<input required type="email" autoComplete="email" maxLength={254} value={customerEmail} onChange={event => setCustomerEmail(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#123B2A]/15 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#123B2A]/20"/></label><label className="mt-3 block text-sm font-semibold text-[#123B2A]">Phone number<input required type="tel" autoComplete="tel" placeholder="080… or +234…" value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#123B2A]/15 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#123B2A]/20"/></label>
        <fieldset className="mt-5"><legend className="text-sm font-semibold text-[#123B2A]">How would you receive this order?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{supportsPickup && <label className="flex min-h-12 items-center gap-2 rounded-xl border border-[#123B2A]/15 p-3 text-sm"><input type="radio" name="fulfillment" value="pickup" checked={fulfillment === 'pickup'} onChange={() => setFulfillment('pickup')}/>Customer pickup</label>}{supportsDelivery && <label className="flex min-h-12 items-center gap-2 rounded-xl border border-[#123B2A]/15 p-3 text-sm"><input type="radio" name="fulfillment" value="vendor_delivery" checked={fulfillment === 'vendor_delivery'} onChange={() => setFulfillment('vendor_delivery')}/>Vendor-managed delivery</label>}</div></fieldset>
        {fulfillment === 'vendor_delivery' && <label className="mt-3 block text-sm font-semibold text-[#123B2A]">Delivery address or landmark<textarea required minLength={3} maxLength={300} value={address} onChange={event => setAddress(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-[#123B2A]/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123B2A]/20" placeholder="Street, area, or clear landmark"/><span className="mt-1 block text-xs font-normal text-[#20231F]/55">The vendor uses its own delivery arrangements; there is no rider tracking.</span></label>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </section>
      <aside className="h-fit rounded-2xl border border-[#123B2A]/10 bg-white p-5 sm:p-6"><h2 className="font-display text-lg font-bold text-[#123B2A]">Order total</h2><div className="mt-4 space-y-3 text-sm"><p className="flex justify-between gap-3"><span>Items</span><strong>{formatNaira(subtotal)}</strong></p><p className="flex justify-between gap-3"><span>Delivery</span><strong>{fulfillment === 'pickup' ? '—' : deliveryFee === null ? 'Not configured' : formatNaira(deliveryFee)}</strong></p><div className="border-t border-[#123B2A]/10 pt-3"><p className="flex justify-between gap-3 font-bold text-[#123B2A]"><span>Total</span><strong>{formatNaira(total)}</strong></p></div></div>
        {fulfillment === 'vendor_delivery' && deliveryFee === null && <p className="mt-3 text-xs leading-5 text-amber-800">Delivery fee is unknown. This business must configure it before delivery checkout can continue.</p>}
        <p className="mt-4 rounded-xl bg-[#FFF8E9] p-3 text-xs leading-5 text-[#20231F]/70">Flutterwave hosted TEST MODE only. No live payment is collected; this development test order is excluded from production vendor workflows.</p>
        {!checkoutEnabled && <p className="mt-3 text-xs leading-5 text-[#20231F]/70">Checkout is disabled until payment, settlement, refund, and collection decisions are configured.</p>}
        <button type="submit" disabled={submitting || loading || !checkoutEnabled || !session?.access_token || !user || !vendor || (!supportsPickup && !supportsDelivery) || !availability?.open || hasUnavailable || !priceChangesConfirmed || (fulfillment === 'vendor_delivery' && deliveryFee === null)} className="mt-4 min-h-12 w-full rounded-xl bg-[#123B2A] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">{submitting ? 'Starting test checkout…' : 'Continue to Flutterwave test checkout'}</button>
        {!availability?.open && <p className="mt-2 text-xs text-amber-800">This business is not currently open.</p>}
      </aside></form>}
    </>}
  </div></main>;
};
