import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronRight, ClipboardList, Loader2, LogOut, Search, ShieldCheck, Store, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/api';
import { MARKET_AREAS } from '../data/marketAreas';

type VendorSummary = {
  id: string;
  business_name: string;
  market_area: string;
  neighborhood: string;
  street_address: string | null;
  nearby_landmark: string | null;
  delivery_coverage: string[];
  business_type: string;
  status: string;
  created_at: string;
};
type VendorDetails = VendorSummary & {
  contact_name: string;
  phone: string;
  email: string | null;
  current_ordering_methods: string[];
  fulfillment_options: string;
  delivery_fee_ngn: number | null;
  message: string | null;
  consent_accepted: boolean;
  user_id: string | null;
};
type AuditEvent = {
  id: string;
  action: string;
  previous_status: string;
  new_status: string;
  reason: string | null;
  actor_user_id: string;
  created_at: string;
};
type ReviewAction = 'under_review' | 'approve' | 'reject' | 'request_information';

const statuses = [
  { value: 'pending_review', label: 'Pending review' },
  { value: 'under_review', label: 'Under review' },
  { value: 'contacted', label: 'More information requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' }
];
const statusLabel = (value: string) => statuses.find(status => status.value === value)?.label || value.replaceAll('_', ' ');
const marketAreaLabel = (value: string) => MARKET_AREAS.find(area => area.id === value)?.label || value;
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const AdminPage: React.FC = () => {
  const { session, user, signOut } = useAuth();
  const navigate = useNavigate();
  const token = session?.access_token || '';
  const [applications, setApplications] = useState<VendorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<VendorDetails | null>(null);
  const [history, setHistory] = useState<AuditEvent[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const loadApplications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.getAdminVendorApplications(token);
      setApplications(result.applications);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Vendor applications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadApplications(); }, [loadApplications]);

  const visibleApplications = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return applications.filter(application =>
      (statusFilter === 'all' || application.status === statusFilter) &&
      (!normalizedSearch || `${application.business_name} ${application.business_type} ${application.neighborhood}`.toLocaleLowerCase().includes(normalizedSearch))
    );
  }, [applications, search, statusFilter]);

  const counts = useMemo(() => applications.reduce<Record<string, number>>((result, application) => {
    result[application.status] = (result[application.status] || 0) + 1;
    return result;
  }, {}), [applications]);

  const openDetails = async (application: VendorSummary) => {
    if (!token) return;
    setSelected(null);
    setHistory([]);
    setDetailsLoading(true);
    setError('');
    try {
      const result = await api.getAdminVendorApplication(token, application.id);
      setSelected(result.application as VendorDetails);
      setHistory(result.history as AuditEvent[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Application details could not be loaded.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const submitReview = async () => {
    if (!token || !selected || !action) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.reviewAdminVendorApplication(token, selected.id, action, reason.trim());
      setSuccess(`Application ${action === 'approve' ? 'approved' : action === 'reject' ? 'declined' : action === 'request_information' ? 'marked for more information' : 'moved under review'}.`);
      setAction(null);
      setReason('');
      await loadApplications();
      await openDetails({ ...selected, status: action === 'approve' ? 'approved' : action === 'reject' ? 'declined' : action === 'request_information' ? 'contacted' : 'under_review' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The application could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);
    if (result.error) setError(result.error);
    else navigate('/', { replace: true });
  };

  const requiredReason = action === 'reject' || action === 'request_information';

  return (
    <main className="min-h-[75vh] bg-[#FFF8E9] px-3 py-6 sm:px-6 sm:py-9">
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-3xl border border-[#123B2A]/10 bg-white shadow-sm lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-b border-[#123B2A]/10 bg-[#123B2A] p-5 text-white lg:border-b-0 lg:border-r lg:p-6">
          <div className="flex items-center justify-between gap-3 lg:block">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#B8D94B]">wá jẹun</p>
              <h1 className="mt-1 font-display text-xl font-bold">Super Admin</h1>
            </div>
            <button type="button" onClick={handleSignOut} disabled={signingOut} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D94B] disabled:opacity-60 lg:mt-8">
              {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Sign out
            </button>
          </div>
          <nav aria-label="Admin navigation" className="mt-5 flex gap-2 overflow-x-auto lg:mt-10 lg:flex-col">
            <a href="#overview" className="inline-flex min-h-10 shrink-0 items-center gap-3 rounded-xl bg-white/10 px-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D94B]"><ShieldCheck className="h-4 w-4 text-[#B8D94B]" /> Overview</a>
            <a href="#applications" className="inline-flex min-h-10 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D94B]"><ClipboardList className="h-4 w-4" /> Applications</a>
          </nav>
          <div className="mt-7 hidden rounded-2xl border border-white/15 p-4 lg:block">
            <p className="text-xs text-white/60">Signed in as</p>
            <p className="mt-1 break-all text-sm font-medium">{user?.email || 'Administrator'}</p>
          </div>
        </aside>

        <section className="min-w-0 p-4 sm:p-7 lg:p-9">
          <div id="overview" className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#123B2A]/55">Vendor review</p>
              <h2 className="mt-1 font-display text-3xl font-bold text-[#123B2A]">Application overview</h2>
              <p className="mt-2 text-sm text-[#20231F]/65">Review real food businesses applying to join wá jẹun.</p>
            </div>
            <button type="button" onClick={() => void loadApplications()} className="min-h-10 rounded-xl border border-[#123B2A]/15 px-4 text-sm font-semibold text-[#123B2A] hover:bg-[#123B2A]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Refresh</button>
          </div>

          {error && <p role="alert" className="mt-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
          {success && <p role="status" className="mt-5 flex gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900"><Check className="h-4 w-4 shrink-0" />{success}</p>}

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <StatusCard label="All applications" count={applications.length} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            {statuses.map(status => <StatusCard key={status.value} label={status.label} count={counts[status.value] || 0} active={statusFilter === status.value} onClick={() => setStatusFilter(status.value)} />)}
          </div>

          <section id="applications" className="mt-9 scroll-mt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-[#123B2A]"><Store className="h-5 w-5" /><h3 className="font-display text-xl font-bold">Vendor applications</h3></div>
              <label className="relative block sm:w-72">
                <span className="sr-only">Search applications</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#123B2A]/45" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search business or area" className="min-h-11 w-full rounded-xl border border-[#123B2A]/15 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#123B2A] focus:ring-2 focus:ring-[#123B2A]/15" />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-[#20231F]/60">{loading ? 'Loading applications…' : `${visibleApplications.length} ${visibleApplications.length === 1 ? 'application' : 'applications'}`}</p>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#20231F]/65">Status
                <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="min-h-10 rounded-lg border border-[#123B2A]/15 bg-white px-2 text-sm text-[#123B2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">
                  <option value="all">All statuses</option>
                  {statuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-3 overflow-x-auto rounded-2xl border border-[#123B2A]/10">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-[#FFF8E9] text-xs uppercase tracking-wide text-[#20231F]/60"><tr><th className="px-4 py-3 font-semibold">Business</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Neighborhood</th><th className="px-4 py-3 font-semibold">Submitted</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3"><span className="sr-only">Open</span></th></tr></thead>
                <tbody className="divide-y divide-[#123B2A]/10">
                  {visibleApplications.map(application => <tr key={application.id} className="hover:bg-[#FFF8E9]/55">
                    <td className="px-4 py-4 font-semibold text-[#123B2A]">{application.business_name}</td>
                    <td className="px-4 py-4 capitalize text-[#20231F]/75">{application.business_type.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-4 text-[#20231F]/75">{marketAreaLabel(application.market_area)} · {application.neighborhood}</td>
                    <td className="px-4 py-4 text-[#20231F]/65">{dateLabel(application.created_at)}</td>
                    <td className="px-4 py-4"><StatusBadge status={application.status} /></td>
                    <td className="px-4 py-4"><button type="button" onClick={() => void openDetails(application)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 font-semibold text-[#123B2A] hover:bg-[#123B2A]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Review <ChevronRight className="h-4 w-4" /></button></td>
                  </tr>)}
                  {!loading && !error && visibleApplications.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#20231F]/60">{applications.length === 0 ? 'No vendor applications have been submitted yet.' : 'No applications match these filters.'}</td></tr>}
                  {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#20231F]/60"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading real applications…</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>

      {detailsLoading && <div className="fixed inset-0 z-40 grid place-items-center bg-[#20231F]/45 p-4" role="status"><div className="rounded-2xl bg-white p-6 text-sm text-[#123B2A]"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading application details…</div></div>}
      {selected && <div className="fixed inset-0 z-40 overflow-y-auto bg-[#20231F]/55 p-3 sm:grid sm:place-items-center sm:p-6" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !action) setSelected(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="application-detail-heading" className="mx-auto my-4 max-w-3xl rounded-3xl bg-white p-5 shadow-2xl sm:my-8 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#123B2A]/55">Application details</p><h2 id="application-detail-heading" className="mt-1 font-display text-2xl font-bold text-[#123B2A]">{selected.business_name}</h2><div className="mt-2"><StatusBadge status={selected.status} /></div></div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#123B2A] hover:bg-[#123B2A]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Detail label="Contact person" value={selected.contact_name} />
            <Detail label="Phone" value={selected.phone} />
            <Detail label="Email" value={selected.email || 'Not provided'} />
            <Detail label="Business type" value={selected.business_type.replaceAll('_', ' ')} />
            <Detail label="Neighborhood" value={selected.neighborhood} />
            <Detail label="Market area" value={marketAreaLabel(selected.market_area)} />
            <Detail label="Street / business address" value={selected.street_address || 'Not provided'} />
            <Detail label="Nearby landmark" value={selected.nearby_landmark || 'Not provided'} />
            <Detail label="Fulfillment" value={selected.fulfillment_options.replaceAll('_', ' ')} />
            <Detail label="Pickup" value={['pickup_only', 'pickup_and_delivery'].includes(selected.fulfillment_options) ? 'Available' : 'Not offered'} />
            <Detail label="Delivery coverage" value={selected.delivery_coverage.map(marketAreaLabel).join(', ') || 'Not provided'} />
            <Detail label="Delivery fee" value={selected.delivery_fee_ngn === null ? 'Not configured' : `₦${Number(selected.delivery_fee_ngn).toLocaleString('en-NG')}`} />
            <Detail label="Ordering methods" value={selected.current_ordering_methods.map(method => method.replaceAll('_', ' ')).join(', ') || 'Not provided'} />
            <Detail label="Submitted" value={dateLabel(selected.created_at)} />
            {selected.message && <div className="sm:col-span-2"><Detail label="Applicant notes" value={selected.message} /></div>}
            <div className="sm:col-span-2"><Detail label="Consent" value={selected.consent_accepted ? 'Consent recorded' : 'Consent not recorded'} /></div>
          </div>
          <div className="mt-7 border-t border-[#123B2A]/10 pt-6">
            <h3 className="font-display text-lg font-bold text-[#123B2A]">Review history</h3>
            {history.length === 0 ? <p className="mt-2 text-sm text-[#20231F]/60">No review actions have been recorded.</p> : <ol className="mt-3 space-y-3">{history.map(event => <li key={event.id} className="rounded-xl bg-[#FFF8E9] p-3 text-sm"><p className="font-semibold capitalize text-[#123B2A]">{event.action.replaceAll('_', ' ')} · {statusLabel(event.previous_status)} → {statusLabel(event.new_status)}</p>{event.reason && <p className="mt-1 text-[#20231F]/75">{event.reason}</p>}<p className="mt-2 break-all text-xs text-[#20231F]/55">{dateLabel(event.created_at)} · Admin user ID {event.actor_user_id}</p></li>)}</ol>}
          </div>
          <div className="mt-7 flex flex-wrap gap-2 border-t border-[#123B2A]/10 pt-6">
            <button type="button" onClick={() => setAction('under_review')} className="min-h-10 rounded-xl border border-[#123B2A]/20 px-3 text-sm font-semibold text-[#123B2A] hover:bg-[#123B2A]/5">Mark under review</button>
            <button type="button" onClick={() => setAction('request_information')} className="min-h-10 rounded-xl border border-[#123B2A]/20 px-3 text-sm font-semibold text-[#123B2A] hover:bg-[#123B2A]/5">Request more information</button>
            <button type="button" onClick={() => setAction('reject')} className="min-h-10 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-800 hover:bg-red-50">Decline</button>
            <button type="button" onClick={() => setAction('approve')} className="min-h-10 rounded-xl bg-[#123B2A] px-4 text-sm font-semibold text-white hover:bg-[#0b2b1e]">Approve</button>
          </div>
        </section>
      </div>}

      {action && selected && <div className="fixed inset-0 z-50 grid place-items-center bg-[#20231F]/65 p-4">
        <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-review-heading" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <h2 id="confirm-review-heading" className="font-display text-xl font-bold text-[#123B2A]">Confirm {action === 'approve' ? 'approval' : action === 'reject' ? 'decline' : action === 'request_information' ? 'information request' : 'review status'}</h2>
          <p className="mt-2 text-sm leading-6 text-[#20231F]/75">You are about to {action.replaceAll('_', ' ')} <strong>{selected.business_name}</strong>. This change will be saved and added to the review history.</p>
          <label className="mt-4 block text-sm font-semibold text-[#20231F]">{requiredReason ? 'Reason (required)' : 'Review note (optional)'}
            <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={3} placeholder={action === 'request_information' ? 'Explain what information is needed.' : action === 'reject' ? 'Explain why this application is declined.' : 'Add a note for the review record.'} className="mt-2 w-full rounded-xl border border-[#123B2A]/20 p-3 text-sm font-normal outline-none focus:border-[#123B2A] focus:ring-2 focus:ring-[#123B2A]/15" />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => { setAction(null); setReason(''); }} disabled={saving} className="min-h-10 rounded-xl border border-[#123B2A]/15 px-4 text-sm font-semibold text-[#123B2A]">Cancel</button>
            <button type="button" onClick={() => void submitReview()} disabled={saving || (requiredReason && !reason.trim())} className="min-h-10 rounded-xl bg-[#123B2A] px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm and save'}</button>
          </div>
        </section>
      </div>}
    </main>
  );
};

function StatusCard({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] ${active ? 'border-[#123B2A] bg-[#123B2A] text-white' : 'border-[#123B2A]/10 bg-white text-[#123B2A] hover:bg-[#FFF8E9]'}`}><span className={`block text-xs ${active ? 'text-white/70' : 'text-[#20231F]/60'}`}>{label}</span><span className="mt-1 block text-2xl font-bold">{count}</span></button>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className="inline-flex rounded-full bg-[#B8D94B]/30 px-3 py-1 text-xs font-semibold capitalize text-[#123B2A]">{statusLabel(status)}</span>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-[#20231F]/50">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#20231F]">{value}</p></div>;
}
