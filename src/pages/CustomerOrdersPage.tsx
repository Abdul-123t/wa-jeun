import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, PackageCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { api, type CustomerOrder } from '../services/api';
import { formatNaira } from '../utils/currency';

const statusText: Record<string, string> = { placed: 'Waiting for the business', accepted: 'Accepted', rejected: 'Declined', preparing: 'Being prepared', ready_for_pickup: 'Ready for pickup', out_for_delivery: 'With the business delivery driver', completed: 'Completed' };

export const CustomerOrdersPage: React.FC = () => {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const reference = params.get('placed');
  useEffect(() => {
    let active = true;
    if (!session?.access_token) { setLoading(false); return; }
    api.getCustomerOrders(session.access_token).then(result => { if (active) { setOrders(result.orders); setError(''); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Your order history is unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    const timer = window.setInterval(() => {
      api.getCustomerOrders(session.access_token).then(result => { if (active) { setOrders(result.orders); setError(''); } }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Order status could not be refreshed. Use Refresh to try again.'); });
    }, 20000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session?.access_token, refreshCount]);
  return <main className="min-h-[70vh] bg-[#FFF8E9] px-4 py-8 sm:px-6 sm:py-12"><div className="mx-auto max-w-4xl"><Link to="/explore" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#123B2A]"><ArrowLeft className="h-4 w-4"/>Explore food</Link><header className="mt-5 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#123B2A]/55">Your account</p><h1 className="mt-1 font-display text-3xl font-bold text-[#123B2A]">Your orders</h1></div><button type="button" onClick={() => setRefreshCount(value => value + 1)} aria-label="Refresh order statuses" className="grid size-10 place-items-center rounded-xl border border-[#123B2A]/20 text-[#123B2A]"><RefreshCw className="h-4 w-4"/></button></header>
    {reference && <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Development test order <strong>{reference}</strong> saved. It is unpaid and is not a real-world fulfillment request.</p>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading ? <p role="status" className="mt-6 rounded-xl bg-white p-6 text-sm text-[#20231F]/65">Loading your orders…</p> : !error && orders.length === 0 ? <section className="mt-6 rounded-2xl border border-[#123B2A]/10 bg-white p-8 text-center"><PackageCheck className="mx-auto h-9 w-9 text-[#123B2A]/55"/><h2 className="mt-3 font-display text-xl font-bold text-[#123B2A]">No orders yet</h2><p className="mt-2 text-sm text-[#20231F]/70">Orders you place will appear here.</p><Link to="/explore" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#123B2A] px-5 text-sm font-bold text-white">Explore food</Link></section> : <div className="mt-6 space-y-4">{orders.map(order => <article key={order.id} className="rounded-2xl border border-[#123B2A]/10 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-[#123B2A]">{order.order_reference}{order.is_test_order && <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-[10px] uppercase tracking-wide text-amber-900">Development test</span>}</p><p className="mt-1 text-xs text-[#20231F]/60">{order.vendor?.business_name || 'Food business'} · {new Date(order.created_at).toLocaleString('en-NG')}</p></div><strong className="text-sm text-[#123B2A]">{formatNaira(order.total_ngn)}</strong></div><div className="mt-4 grid gap-4 border-t border-[#123B2A]/10 pt-4 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wide text-[#20231F]/50">Order status</p><p className="mt-1 text-sm font-semibold capitalize text-[#123B2A]">{statusText[order.status] || order.status.replaceAll('_', ' ')}</p><p className="mt-2 text-xs capitalize text-[#20231F]/65">{order.fulfillment_method === 'pickup' ? 'Customer pickup' : 'Vendor-managed delivery'}{order.delivery_address ? ` · ${order.delivery_address}` : ''}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-[#20231F]/50">Payment status</p><p className="mt-1 text-sm font-semibold capitalize text-[#123B2A]">{order.payment_status.replaceAll('_', ' ')}</p>{order.is_test_order && <p className="mt-1 text-xs text-amber-800">Unpaid test order. No payment has been collected.</p>}</div></div><ul className="mt-4 space-y-2 border-t border-[#123B2A]/10 pt-4 text-sm text-[#20231F]/75">{order.items.map(item => <li key={item.id} className="flex justify-between gap-3"><span>{item.quantity} × {item.item_name}</span><span className="shrink-0">{formatNaira(item.line_total_ngn)}</span></li>)}</ul><div className="mt-3 space-y-1 border-t border-[#123B2A]/10 pt-3 text-xs text-[#20231F]/60"><p className="flex justify-between"><span>Items</span><span>{formatNaira(order.subtotal_ngn)}</span></p>{order.delivery_fee_ngn !== null && <p className="flex justify-between"><span>Vendor delivery fee</span><span>{formatNaira(order.delivery_fee_ngn)}</span></p>}<p className="flex justify-between font-bold text-[#123B2A]"><span>Total</span><span>{formatNaira(order.total_ngn)}</span></p></div></article>)}</div>}
  </div></main>;
};
