import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, ImagePlus, Loader2, LogOut, Plus, Save, Store, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, type CustomerOrder, type VendorBusiness, type VendorMenuInput, type VendorMenuItem } from '../services/api';
import { MARKET_AREAS } from '../data/marketAreas';

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const categories = ['rice', 'swallow', 'soup', 'grills', 'fast_food', 'snacks', 'drinks', 'other'];
const businessTypes = ['restaurant', 'local_buka', 'fast_food', 'grill_shawarma', 'bakery_snacks', 'other'];
const emptyHours = Object.fromEntries(days.map(day => [day, { open: '09:00', close: '18:00', closed: false }])) as NonNullable<VendorBusiness['opening_hours']>;
const emptyItem: VendorMenuInput = { name: '', description: '', priceNgn: 0, category: 'rice', imageUrl: null, available: true };
const fieldClass = 'mt-1 w-full rounded-xl border border-[#123B2A]/15 bg-white px-3 py-2.5 text-sm text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A]/20';
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#123B2A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194D37] disabled:cursor-not-allowed disabled:opacity-50';

export const VendorDashboardPage: React.FC = () => {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const token = session?.access_token || '';
  const [businesses, setBusinesses] = useState<VendorBusiness[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [description, setDescription] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('other');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [marketArea, setMarketArea] = useState('ijebu-ode');
  const [streetAddress, setStreetAddress] = useState('');
  const [nearbyLandmark, setNearbyLandmark] = useState('');
  const [deliveryCoverage, setDeliveryCoverage] = useState<string[]>([]);
  const [hours, setHours] = useState(emptyHours);
  const [fulfillmentOptions, setFulfillmentOptions] = useState('pickup_only');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [itemDraft, setItemDraft] = useState<VendorMenuInput>(emptyItem);
  const [editingId, setEditingId] = useState('');

  const business = businesses.find(item => item.id === selectedId) || businesses[0];
  const approved = business?.status === 'approved';
  const setupComplete = Boolean(description.trim().length >= 20 && business?.opening_hours && business.menu.some(item => item.available));
  const steps = useMemo(() => [
    { label: 'Business profile and hours', done: Boolean(description.trim().length >= 20 && business?.opening_hours) },
    { label: 'At least one available menu item', done: Boolean(business?.menu.some(item => item.available)) },
    { label: 'Application approved', done: approved }
  ], [description, business, approved]);

  const refresh = async () => {
    if (!token) return;
    const result = await api.getVendorDashboard(token);
    setBusinesses(result.businesses);
    const next = result.businesses.find(entry => entry.id === selectedId) || result.businesses[0];
    if (next) {
      setSelectedId(next.id);
      setDescription(next.description || '');
      setBusinessName(next.business_name); setBusinessType(next.business_type); setContactName(next.contact_name); setPhone(next.phone); setEmail(next.email || '');
      setNeighborhood(next.neighborhood || '');
      setMarketArea(next.market_area || 'ijebu-ode'); setStreetAddress(next.street_address || ''); setNearbyLandmark(next.nearby_landmark || ''); setDeliveryCoverage(next.delivery_coverage || []);
      setHours(next.opening_hours || emptyHours);
      setFulfillmentOptions(next.fulfillment_options || 'pickup_only');
      setDeliveryFee(next.delivery_fee_ngn === null ? '' : String(next.delivery_fee_ngn));
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getVendorDashboard(token).then(result => {
      if (!active) return;
      setBusinesses(result.businesses);
      const first = result.businesses[0];
      if (first) {
        setSelectedId(first.id); setDescription(first.description || ''); setBusinessName(first.business_name); setBusinessType(first.business_type); setContactName(first.contact_name); setPhone(first.phone); setEmail(first.email || ''); setNeighborhood(first.neighborhood || '');
        setMarketArea(first.market_area || 'ijebu-ode'); setStreetAddress(first.street_address || ''); setNearbyLandmark(first.nearby_landmark || ''); setDeliveryCoverage(first.delivery_coverage || []);
        setHours(first.opening_hours || emptyHours); setFulfillmentOptions(first.fulfillment_options || 'pickup_only');
        setDeliveryFee(first.delivery_fee_ngn === null ? '' : String(first.delivery_fee_ngn));
      }
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load your dashboard.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const perform = async (action: () => Promise<unknown>, message: string) => {
    setSaving(true); setError(''); setNotice('');
    try { await action(); await refresh(); setNotice(message); }
    catch (err) { setError(err instanceof Error ? err.message : 'The change could not be saved.'); }
    finally { setSaving(false); }
  };

  const saveProfile = () => business && void perform(() => api.updateVendorProfile(token, business.id, {
    businessName, businessType, contactName, phone, email: email.trim() || null,
    description, marketArea, neighborhood, streetAddress, nearbyLandmark, deliveryCoverage, openingHours: hours, fulfillmentOptions, deliveryFeeNgn: deliveryFee.trim() === '' ? null : Number(deliveryFee)
  }), 'Business details saved.');

  const saveMenuItem = () => business && void perform(async () => {
    await api.saveVendorMenuItem(token, business.id, itemDraft, editingId || undefined);
    setItemDraft(emptyItem); setEditingId('');
  }, editingId ? 'Menu item updated.' : 'Menu item added.');

  const editItem = (item: VendorMenuItem) => {
    setEditingId(item.id);
    setItemDraft({ name: item.name, description: item.description, priceNgn: item.price_ngn, category: item.category, imageUrl: item.image_url, available: item.available });
    document.getElementById('menu-editor')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSignOut = async () => { await signOut(); navigate('/', { replace: true }); };
  const chooseBusiness = (id: string) => {
    const selected = businesses.find(entry => entry.id === id);
    if (!selected) return;
    setSelectedId(selected.id); setDescription(selected.description || ''); setBusinessName(selected.business_name); setBusinessType(selected.business_type); setContactName(selected.contact_name); setPhone(selected.phone); setEmail(selected.email || ''); setNeighborhood(selected.neighborhood || '');
    setHours(selected.opening_hours || emptyHours); setFulfillmentOptions(selected.fulfillment_options || 'pickup_only');
    setDeliveryFee(selected.delivery_fee_ngn === null ? '' : String(selected.delivery_fee_ngn));
    setEditingId(''); setItemDraft(emptyItem); setError(''); setNotice('');
  };

  if (loading) return <main className="grid min-h-[60vh] place-items-center text-sm text-[#123B2A]/70"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading your vendor dashboard…</main>;

  return <main className="min-h-screen bg-[#FFF8E9] px-4 py-8 sm:px-6 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-4 rounded-3xl bg-[#123B2A] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-white/60">wá jẹun · vendor workspace</p><h1 className="mt-2 font-display text-3xl font-bold">Your business dashboard</h1><p className="mt-2 text-sm text-white/75">Signed in as {user?.email || 'your account'}</p></div>
        <div className="flex gap-2"><Link to="/account" className="inline-flex min-h-10 items-center rounded-xl border border-white/25 px-4 text-sm font-semibold hover:bg-white/10">Account</Link><button onClick={handleSignOut} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#123B2A]"><LogOut className="h-4 w-4"/>Sign out</button></div>
      </header>

      {error && <p role="alert" className="mt-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
      {!business ? <section className="mt-6 rounded-2xl bg-white p-8 text-center"><Store className="mx-auto h-8 w-8 text-[#123B2A]"/><h2 className="mt-3 text-xl font-bold text-[#123B2A]">No application linked to this account</h2><p className="mt-2 text-sm text-[#20231F]/70">Sign in before submitting your vendor application so it appears here.</p><Link className="mt-4 inline-flex font-semibold text-[#123B2A] underline" to="/vendor-register">Start vendor application</Link></section> : <>
        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_330px]">
          <div className="rounded-2xl border border-[#123B2A]/10 bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#123B2A]/55">Application status</p>{businesses.length > 1 ? <select aria-label="Choose your business" className="mt-1 rounded-lg border border-[#123B2A]/15 bg-white px-2 py-1 font-display text-xl font-bold text-[#123B2A]" value={business.id} onChange={event => chooseBusiness(event.target.value)}>{businesses.map(entry => <option key={entry.id} value={entry.id}>{entry.business_name}</option>)}</select> : <h2 className="mt-1 font-display text-2xl font-bold text-[#123B2A]">{business.business_name}</h2>}<p className="mt-1 text-sm capitalize text-[#20231F]/65">{business.neighborhood} · {business.business_type.replaceAll('_', ' ')}</p></div><span className="rounded-full bg-[#B8D94B]/30 px-3 py-1 text-sm font-bold capitalize text-[#123B2A]">{business.status === 'declined' ? 'Rejected' : business.status.replaceAll('_', ' ')}</span></div>
            <p className="mt-4 text-sm leading-6 text-[#20231F]/75">{business.status === 'approved' ? 'Your application is approved. Complete your storefront and menu before opening ordering.' : business.status === 'declined' ? 'This application was rejected. Contact the onboarding team for permitted next steps.' : business.status === 'suspended' ? 'Selling privileges are suspended. Contact the wá jẹun team for assistance.' : 'Your application is awaiting review. You can complete the business information below while it is being reviewed.'}</p>
            {business.review_reason && <p className="mt-3 rounded-xl bg-[#FFF8E9] p-3 text-sm text-[#20231F]/75"><strong>Review note:</strong> {business.review_reason}</p>}
            {business.status === 'declined' && <Link className="mt-3 inline-flex text-sm font-semibold text-[#123B2A] underline" to="/legal?tab=contact">Contact the onboarding team</Link>}
          </div>
          <aside className="rounded-2xl border border-[#123B2A]/10 bg-white p-5"><h2 className="font-display text-lg font-bold text-[#123B2A]">Setup progress</h2><div className="mt-4 space-y-3">{steps.map(step => <p key={step.label} className="flex items-center gap-2 text-sm text-[#20231F]/75"><CheckCircle2 className={`h-4 w-4 ${step.done ? 'text-green-700' : 'text-[#20231F]/25'}`}/>{step.label}</p>)}</div><p className="mt-4 text-xs leading-5 text-[#20231F]/55">Your business appears in the public directory only when approved, set up, carrying an available menu item, and accepting orders.</p></aside>
        </section>

        <section className="mt-6 rounded-2xl border border-[#123B2A]/10 bg-white p-5 sm:p-7">
          <h2 className="font-display text-xl font-bold text-[#123B2A]">Business profile and hours</h2><p className="mt-1 text-sm text-[#20231F]/65">These details are used to prepare your public storefront.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#123B2A]">Business name<input className={fieldClass} maxLength={200} value={businessName} onChange={e => setBusinessName(e.target.value)}/></label><label className="text-sm font-semibold text-[#123B2A]">Business category<select className={fieldClass} value={businessType} onChange={e => setBusinessType(e.target.value)}>{businessTypes.map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label><label className="text-sm font-semibold text-[#123B2A]">Owner or contact name<input className={fieldClass} maxLength={150} value={contactName} onChange={e => setContactName(e.target.value)}/></label><label className="text-sm font-semibold text-[#123B2A]">Business phone<input className={fieldClass} type="tel" value={phone} onChange={e => setPhone(e.target.value)}/></label><label className="text-sm font-semibold text-[#123B2A]">Business email (optional)<input className={fieldClass} type="email" value={email} onChange={e => setEmail(e.target.value)}/></label></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#123B2A]">Market area<select className={fieldClass} value={marketArea} onChange={e => setMarketArea(e.target.value)}>{MARKET_AREAS.map(area => <option key={area.id} value={area.id}>{area.label}</option>)}</select></label><label className="text-sm font-semibold text-[#123B2A]">Neighborhood or locality<input className={fieldClass} maxLength={150} value={neighborhood} onChange={e => setNeighborhood(e.target.value)}/></label><label className="text-sm font-semibold text-[#123B2A]">Street or business address<input className={fieldClass} maxLength={250} value={streetAddress} onChange={e => setStreetAddress(e.target.value)} placeholder="Street, road, or building address"/></label><label className="text-sm font-semibold text-[#123B2A]">Nearby landmark<input className={fieldClass} maxLength={250} value={nearbyLandmark} onChange={e => setNearbyLandmark(e.target.value)} placeholder="Real nearby landmark"/></label><label className="text-sm font-semibold text-[#123B2A]">Fulfillment<select className={fieldClass} value={fulfillmentOptions} onChange={e => setFulfillmentOptions(e.target.value)}><option value="pickup_only">Customer pickup</option><option value="vendor_delivery">Vendor-managed delivery</option><option value="pickup_and_delivery">Pickup and vendor delivery</option><option value="delivery_varies">Variable delivery (not available for checkout)</option></select><span className="mt-1 block text-xs font-normal text-[#20231F]/50">Variable delivery is not offered to customers yet. Choose pickup or set one clear delivery fee.</span></label>{['vendor_delivery', 'pickup_and_delivery'].includes(fulfillmentOptions) && <fieldset className="rounded-xl border border-[#123B2A]/10 bg-[#FFF8E9] p-3 sm:col-span-2"><legend className="px-1 text-sm font-semibold text-[#123B2A]">Actual delivery coverage</legend><p className="text-xs text-[#20231F]/60">Select only areas your business currently delivers to.</p><div className="mt-2 flex flex-wrap gap-3">{MARKET_AREAS.map(area => <label key={area.id} className="flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm"><input type="checkbox" checked={deliveryCoverage.includes(area.id)} onChange={e => setDeliveryCoverage(current => e.target.checked ? [...current, area.id] : current.filter(value => value !== area.id))}/>{area.label}</label>)}</div></fieldset>}<label className="text-sm font-semibold text-[#123B2A]">Delivery fee (NGN)<input className={fieldClass} type="number" min="0" max="10000000" step="0.01" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} placeholder="Not configured"/><span className="mt-1 block text-xs font-normal text-[#20231F]/50">A fixed fee is required before customer delivery can be offered.</span></label><label className="text-sm font-semibold text-[#123B2A] sm:col-span-2">Business description<textarea className={fieldClass} rows={3} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your real business and the food you prepare."/><span className="mt-1 block text-xs font-normal text-[#20231F]/50">At least 20 characters.</span></label></div>
          <div className="mt-5"><h3 className="text-sm font-bold text-[#123B2A]">Opening hours</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{days.map(day => <div key={day} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FFF8E9] p-3 text-sm"><span className="w-24 capitalize font-medium">{day}</span><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={hours[day].closed} onChange={e => setHours(current => ({ ...current, [day]: { ...current[day], closed: e.target.checked } }))}/>Closed</label>{!hours[day].closed && <><input aria-label={`${day} opening time`} type="time" value={hours[day].open} onChange={e => setHours(current => ({ ...current, [day]: { ...current[day], open: e.target.value } }))}/><span>to</span><input aria-label={`${day} closing time`} type="time" value={hours[day].close} onChange={e => setHours(current => ({ ...current, [day]: { ...current[day], close: e.target.value } }))}/></>}</div>)}</div></div>
          <button className={`${buttonClass} mt-5`} disabled={saving || ['declined', 'suspended'].includes(business.status)} onClick={saveProfile}><Save className="h-4 w-4"/>{saving ? 'Saving…' : 'Save business details'}</button>
        </section>

        <section className="mt-6 rounded-2xl border border-[#123B2A]/10 bg-white p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-[#123B2A]">Menu management</h2><p className="mt-1 text-sm text-[#20231F]/65">Add your actual dishes and prices. Prices are entered in Nigerian naira.</p></div><span className="rounded-full bg-[#FFF8E9] px-3 py-1 text-xs font-semibold text-[#123B2A]">{business.menu.length} {business.menu.length === 1 ? 'item' : 'items'}</span></div>
          {!approved && <p className="mt-4 rounded-xl bg-[#FFF8E9] p-3 text-sm text-[#20231F]/70">Menu publishing and editing are available after approval. Your setup progress will appear here.</p>}
          {approved && <>{business.accepting_orders && <Link className="mt-4 inline-flex text-sm font-semibold text-[#123B2A] underline" to={`/vendors/${encodeURIComponent(business.id)}/menu`}>View live customer storefront</Link>}<div className="mt-5 divide-y divide-[#123B2A]/10">{business.menu.map(item => <article key={item.id} className="flex flex-wrap items-center gap-3 py-4"><div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#FFF8E9]">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover"/> : <Store className="h-5 w-5 text-[#123B2A]/35"/>}</div><div className="min-w-40 flex-1"><h3 className="font-semibold text-[#123B2A]">{item.name}</h3><p className="text-xs capitalize text-[#20231F]/55">{item.category.replaceAll('_', ' ')} · ₦{Number(item.price_ngn).toLocaleString('en-NG')}</p><p className="mt-1 text-xs text-[#20231F]/65">{item.available ? 'Available' : 'Unavailable'}</p></div><button className="rounded-lg border border-[#123B2A]/15 px-3 py-2 text-xs font-semibold" onClick={() => editItem(item)}>Edit</button><button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700" onClick={() => { if (window.confirm(`Remove ${item.name} from your menu?`)) void perform(() => api.deleteVendorMenuItem(token, business.id, item.id), 'Menu item removed.'); }} aria-label={`Remove ${item.name} from menu`}><Trash2 className="h-4 w-4"/></button></article>)}</div></>}

          {approved && <div id="menu-editor" className="mt-5 rounded-2xl bg-[#FFF8E9] p-4 sm:p-5"><h3 className="font-display text-lg font-bold text-[#123B2A]">{editingId ? 'Edit menu item' : 'Add a menu item'}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-[#123B2A]">Item name<input className={fieldClass} maxLength={120} value={itemDraft.name} onChange={e => setItemDraft({ ...itemDraft, name: e.target.value })}/></label><label className="text-sm font-semibold text-[#123B2A]">Price (NGN)<input className={fieldClass} type="number" min="0.01" max="10000000" step="0.01" value={itemDraft.priceNgn || ''} onChange={e => setItemDraft({ ...itemDraft, priceNgn: Number(e.target.value) })}/></label><label className="text-sm font-semibold text-[#123B2A]">Category<select className={fieldClass} value={itemDraft.category} onChange={e => setItemDraft({ ...itemDraft, category: e.target.value })}>{categories.map(category => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></label><label className="text-sm font-semibold text-[#123B2A]">Availability<select className={fieldClass} value={String(itemDraft.available)} onChange={e => setItemDraft({ ...itemDraft, available: e.target.value === 'true' })}><option value="true">Available</option><option value="false">Unavailable</option></select></label><label className="text-sm font-semibold text-[#123B2A] sm:col-span-2">Description<textarea className={fieldClass} rows={2} maxLength={1000} value={itemDraft.description} onChange={e => setItemDraft({ ...itemDraft, description: e.target.value })}/></label><label className="flex items-center gap-2 text-sm font-semibold text-[#123B2A] sm:col-span-2"><ImagePlus className="h-4 w-4"/>Food image<input className="text-xs" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file && business) void perform(async () => { const result = await api.uploadVendorMenuImage(token, business.id, file); setItemDraft(current => ({ ...current, imageUrl: result.imageUrl })); }, 'Food image uploaded.'); }}/></label>{itemDraft.imageUrl && <p className="text-xs text-green-800 sm:col-span-2">Image ready to save with menu item.</p>}</div>{itemDraft.name.trim() && <article aria-label="Menu item preview" className="mt-4 flex gap-3 rounded-xl border border-[#123B2A]/10 bg-white p-3"><div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#FFF8E9]">{itemDraft.imageUrl ? <img src={itemDraft.imageUrl} alt={`Preview of ${itemDraft.name}`} className="h-full w-full object-cover"/> : <Store aria-hidden="true" className="h-5 w-5 text-[#123B2A]/35"/>}</div><div><p className="text-xs font-bold uppercase tracking-wide text-[#123B2A]/50">Customer item preview</p><h4 className="mt-1 font-semibold text-[#123B2A]">{itemDraft.name}</h4><p className="text-xs text-[#20231F]/65">{itemDraft.description || 'Add a description to show customers what this dish includes.'}</p><p className="mt-2 text-sm font-bold text-[#123B2A]">₦{Number(itemDraft.priceNgn || 0).toLocaleString('en-NG')}</p></div></article>}<div className="mt-4 flex flex-wrap gap-2"><button className={buttonClass} disabled={saving} onClick={saveMenuItem}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>}{editingId ? 'Save item' : 'Add item'}</button>{editingId && <button className="min-h-10 rounded-xl border border-[#123B2A]/20 px-4 text-sm font-semibold" onClick={() => { setEditingId(''); setItemDraft(emptyItem); }}>Cancel edit</button>}</div></div>}
        </section>

        <section className="mt-6 flex flex-col gap-4 rounded-2xl bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"><div><h2 className="font-display text-xl font-bold text-[#123B2A]">Store availability</h2><p className="mt-1 text-sm text-[#20231F]/65">Opening your store requires approval, a complete profile and hours, and at least one available menu item.</p></div><button className={business.accepting_orders ? 'min-h-11 rounded-xl border border-[#123B2A]/20 px-4 text-sm font-semibold text-[#123B2A]' : buttonClass} disabled={saving || !approved || !setupComplete} onClick={() => void perform(() => api.setVendorAvailability(token, business.id, !business.accepting_orders), business.accepting_orders ? 'Store is not accepting orders.' : 'Store is accepting orders.')}>{business.accepting_orders ? 'Pause store' : 'Open store'}</button></section>

        <VendorOrdersPanel token={token} businessId={business.id}/>
        {!approved && <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#20231F]/55"><Clock3 className="mt-0.5 h-4 w-4 shrink-0"/>Your selling controls remain unavailable until your application is approved.</p>}
      </>}
    </div>
  </main>;
};

const VendorOrdersPanel: React.FC<{ token: string; businessId: string }> = ({ token, businessId }) => {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = async () => { const result = await api.getVendorOrders(token, businessId); setOrders(result.orders); };
  useEffect(() => {
    let active = true;
    api.getVendorOrders(token, businessId).then(result => { if (active) setOrders(result.orders); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Vendor orders are unavailable.'); }).finally(() => { if (active) setLoading(false); });
    const timer = window.setInterval(() => { api.getVendorOrders(token, businessId).then(result => { if (active) { setOrders(result.orders); setError(''); } }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Order inbox could not be refreshed. Use Refresh to try again.'); }); }, 20000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token, businessId]);
  const changeStatus = async (order: CustomerOrder, status: string) => {
    setBusy(order.id); setError(''); setNotice('');
    try { await api.updateVendorOrderStatus(token, order.id, status); await refresh(); setNotice(`Order ${order.order_reference} updated.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update order.'); }
    finally { setBusy(''); }
  };
  const actions = (order: CustomerOrder) => order.status === 'placed' ? [['accepted', 'Accept'], ['rejected', 'Reject']] : order.status === 'accepted' ? [['preparing', 'Start preparing']] : order.status === 'preparing' ? [[order.fulfillment_method === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery', order.fulfillment_method === 'pickup' ? 'Ready for pickup' : 'Out for delivery']] : ['ready_for_pickup', 'out_for_delivery'].includes(order.status) ? [['completed', 'Mark completed']] : [];
  return <section className="mt-6 rounded-2xl border border-[#123B2A]/10 bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-[#123B2A]">Order inbox</h2><p className="mt-1 text-sm text-[#20231F]/65">Orders placed for this business. Test orders are clearly marked and unpaid.</p></div><button onClick={() => void refresh().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not refresh orders.'))} className="min-h-10 rounded-lg border border-[#123B2A]/15 px-3 text-xs font-semibold text-[#123B2A]">Refresh</button></div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
    {loading ? <p role="status" className="mt-5 text-sm text-[#20231F]/60">Loading orders…</p> : orders.length === 0 ? <p className="mt-5 rounded-xl bg-[#FFF8E9] p-5 text-sm text-[#20231F]/70">No customer orders yet.</p> : <div className="mt-5 space-y-4">{orders.map(order => <article key={order.id} className="rounded-2xl border border-[#123B2A]/10 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-[#123B2A]">{order.order_reference} {order.is_test_order && <span className="ml-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] uppercase tracking-wide text-amber-900">Development test · unpaid</span>}</p><p className="mt-1 text-xs capitalize text-[#20231F]/60">{order.status.replaceAll('_', ' ')} · {order.fulfillment_method.replaceAll('_', ' ')} · {new Date(order.created_at).toLocaleString('en-NG')}</p></div><strong className="text-sm text-[#123B2A]">{formatNaira(order.total_ngn)}</strong></div><p className="mt-3 text-sm font-semibold text-[#20231F]">{order.customer_name} · <a className="text-[#123B2A] underline" href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></p>{order.delivery_address && <p className="mt-1 text-sm text-[#20231F]/70">Drop-off: {order.delivery_address}</p>}<ul className="mt-3 space-y-1 text-sm text-[#20231F]/70">{order.items.map(item => <li key={item.id}>{item.quantity} × {item.item_name} · {formatNaira(item.line_total_ngn)}</li>)}</ul><p className="mt-3 text-xs text-amber-800">Payment: {order.payment_status.replaceAll('_', ' ')}. Do not treat this as paid.</p>{actions(order).length > 0 && <div className="mt-4 flex flex-wrap gap-2">{actions(order).map(([status, label]) => <button key={status} disabled={busy === order.id} onClick={() => void changeStatus(order, status)} className={`min-h-10 rounded-xl px-4 text-xs font-bold ${status === 'rejected' ? 'border border-red-200 text-red-800' : 'bg-[#123B2A] text-white'} disabled:opacity-50`}>{busy === order.id ? 'Saving…' : label}</button>)}</div>}</article>)}</div>}
  </section>;
};

function formatNaira(value: number) { return `₦${Number(value).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
