import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export const AccountPage: React.FC = () => {
  const { user, vendorApplications, vendorApplicationError, permissionsLoading, retryPermissionCheck, signOut } = useAuth();
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);
    if (result.error) setSignOutError(result.error);
    else navigate('/', { replace: true });
  };

  return (
    <main className="min-h-[70vh] bg-[#FFF8E9] px-4 py-12 sm:px-6 sm:py-16">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#123B2A]/10 bg-white p-6 shadow-sm sm:p-9" aria-labelledby="account-heading">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#123B2A]/55">wá jẹun account</p>
            <h1 id="account-heading" className="mt-2 font-display text-3xl font-bold text-[#123B2A]">Your account</h1>
            <p className="mt-2 text-sm text-[#20231F]/70">Signed in as {user?.email || 'your account'}.</p>
          </div>
          <div className="flex gap-2"><Link to="/orders" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#B8D94B] px-4 text-sm font-semibold text-[#123B2A]">Your orders</Link><button type="button" onClick={handleSignOut} disabled={signingOut} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#123B2A]/20 px-4 text-sm font-semibold text-[#123B2A] hover:bg-[#123B2A]/5 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">
            {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Sign out
          </button></div>
        </div>

        {signOutError && <p role="alert" className="mt-6 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="h-4 w-4 shrink-0" />{signOutError}</p>}

        <div className="mt-8 border-t border-[#123B2A]/10 pt-6">
          <div className="flex items-center gap-2 text-[#123B2A]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <h2 className="font-display text-xl font-bold">Vendor applications</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#20231F]/70">Applications submitted while signed in are linked to this account. Applications submitted anonymously are not automatically linked.</p>

          {permissionsLoading && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-[#123B2A]/65"><Loader2 className="h-4 w-4 animate-spin" />Loading your applications…</p>}
          {!permissionsLoading && vendorApplicationError && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p role="alert">{vendorApplicationError}</p><button type="button" onClick={retryPermissionCheck} className="mt-3 min-h-10 rounded-lg border border-red-300 px-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Try again</button></div>}
          {!permissionsLoading && !vendorApplicationError && vendorApplications.length === 0 && <div className="mt-5 rounded-xl bg-[#FFF8E9] p-5 text-sm text-[#20231F]/75">
            <p>You do not have a vendor application linked to this account.</p>
            <Link to="/vendor-register" className="mt-3 inline-flex font-semibold text-[#123B2A] underline underline-offset-2">List Your Food Business</Link>
          </div>}
          {!permissionsLoading && !vendorApplicationError && vendorApplications.length > 0 && <ul className="mt-5 space-y-3">
            {vendorApplications.map(application => <li key={application.id} className="rounded-xl border border-[#123B2A]/10 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-[#123B2A]">{application.business_name}</h3>
                  <p className="mt-1 text-xs text-[#20231F]/65">{application.neighborhood} · {application.business_type.replaceAll('_', ' ')}</p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-[#B8D94B]/25 px-3 py-1 text-xs font-semibold capitalize text-[#123B2A]">{application.status.replaceAll('_', ' ')}</span>
              </div>
              <p className="mt-3 text-xs text-[#20231F]/55">Submitted {new Date(application.created_at).toLocaleDateString()}</p>
              <p className="mt-2 text-xs text-[#20231F]/65">
                {application.status === 'approved'
                  ? 'This application has been approved.'
                  : application.status === 'declined'
                    ? 'This application has been declined. Review the note below for the decision reason.'
                    : application.status === 'contacted'
                      ? 'The review team has requested more information. Review the note below for details.'
                      : 'This application is awaiting review. Submission does not mean the business has been approved.'}
              </p>
              {application.review_reason && <p className="mt-2 rounded-lg bg-[#FFF8E9] p-3 text-xs leading-5 text-[#20231F]/75"><strong>Review note:</strong> {application.review_reason}</p>}
            </li>)}
          </ul>}
        </div>
      </section>
    </main>
  );
};
