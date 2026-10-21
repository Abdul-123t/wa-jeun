import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Menu, Store, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getRoleAwareNavigation } from '../auth/authRules';

const publicLinks = [
  { label: 'Explore Food', to: '/explore' },
  { label: 'Food categories', to: '/explore#food-categories' },
  { label: 'About', to: '/about' },
] as const;

function isCurrentLink(pathname: string, search: string, hash: string, to: string) {
  const [pathAndQuery, hashPart] = to.split('#');
  const [path, query = ''] = pathAndQuery.split('?');
  const targetHash = hashPart ? `#${hashPart}` : '';
  if (path === '/' && !targetHash) return pathname === '/' && !hash;
  return pathname === path && (!query || search === `?${query}`) && (!targetHash || hash === targetHash);
}

export const Navbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const { user, loading, permissionsLoading, adminUserId, vendorApplications, vendorApplicationError, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (wasOpenRef.current) toggleRef.current?.focus();
    setMenuOpen(false);
    wasOpenRef.current = false;
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        wasOpenRef.current = false;
        toggleRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !toggleRef.current?.contains(target)) {
        setMenuOpen(false);
        wasOpenRef.current = false;
      }
    };
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    wasOpenRef.current = false;
    toggleRef.current?.focus();
  };

  const handleSignOut = async () => {
    setSignOutError('');
    const result = await signOut();
    if (!result.error) {
      closeMenu();
      navigate('/', { replace: true });
    } else setSignOutError(result.error);
  };

  const desktopLinkClass = (active: boolean) => [
    'group relative inline-flex min-h-11 items-center whitespace-nowrap px-1 text-[13px] font-semibold transition-colors motion-reduce:transition-none',
    'focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-4',
    active ? 'text-[#123B2A]' : 'text-[#20231F]/75 hover:text-[#123B2A]',
  ].join(' ');

  const mobileLinkClass = (active: boolean) => [
    'flex min-h-12 items-center justify-between border-b border-[#123B2A]/10 px-1 text-[15px] font-semibold transition-colors motion-reduce:transition-none',
    'focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]',
    active ? 'text-[#123B2A]' : 'text-[#20231F] hover:text-[#123B2A]',
  ].join(' ');

  const renderLink = (item: { label: string; to: string }, mobile = false) => {
    const active = isCurrentLink(location.pathname, location.search, location.hash, item.to);
    return <Link
      key={item.to}
      to={item.to}
      onClick={mobile ? closeMenu : undefined}
      aria-current={active ? 'page' : undefined}
      className={mobile ? mobileLinkClass(active) : desktopLinkClass(active)}
    >
      <span>{item.label}</span>
      {active && <span className="absolute inset-x-1 bottom-1 h-0.5 bg-[#B8D94B]" aria-hidden="true" />}
    </Link>;
  };

  const navigation = getRoleAwareNavigation({
    userId: user?.id,
    authLoading: loading,
    permissionsLoading,
    vendorApplications,
    vendorApplicationError,
    adminUserId
  });

  return <header className="sticky top-0 z-40 border-b border-[#123B2A]/10 bg-[#FFF8E9] shadow-[0_3px_16px_-12px_rgba(18,59,42,.28)]" role="banner">
    <div className="mx-auto flex h-[64px] max-w-[1400px] items-center justify-between gap-3 px-4 sm:h-[70px] sm:px-6 lg:px-8">
      <Link to="/" aria-label="wá jẹun — Home" className="group flex min-w-0 shrink-0 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-4">
        <img src="/brand/wa-jeun-icon-64.png" alt="" aria-hidden="true" className="size-9 shrink-0 object-contain sm:size-10" />
        <span className="flex flex-col justify-center">
          <span className="font-display text-[25px] font-extrabold leading-none tracking-[-.055em] text-[#123B2A] transition-opacity group-hover:opacity-80 sm:text-[27px]">wá jẹun</span>
          <span className="mt-1 hidden text-[9px] font-bold uppercase tracking-[.13em] text-[#123B2A]/55 min-[360px]:block">Your City. Your Food.</span>
        </span>
      </Link>

      <nav className="hidden items-center gap-4 min-[1360px]:flex 2xl:gap-6" aria-label="Primary navigation">
        {publicLinks.map(item => renderLink(item))}
      </nav>

      <div className="hidden shrink-0 items-center gap-2 min-[1360px]:flex">
        {navigation.accountLinks.map(item => {
          const active = isCurrentLink(location.pathname, location.search, location.hash, item.to);
          return <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} className="rounded-md px-2.5 py-2 text-[13px] font-semibold text-[#123B2A] transition-colors hover:bg-[#123B2A]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">{item.label}</Link>;
        })}
        {user && <button type="button" onClick={() => void handleSignOut()} className="rounded-md px-2 py-2 text-[13px] font-semibold text-[#20231F]/65 transition-colors hover:text-[#123B2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Sign out</button>}
        {signOutError && <span role="alert" className="max-w-40 text-xs text-red-800">{signOutError}</span>}
        {!loading && navigation.showVendorApplication && <Link to="/vendor-register" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#123B2A]/20 px-3 text-[13px] font-bold text-[#123B2A] transition-colors hover:border-[#123B2A]/50 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Become a Vendor</Link>}
        {!loading && navigation.showCustomerLaunchList && <Link to="/customer-register" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#B8D94B] px-3.5 text-[13px] font-bold text-[#123B2A] shadow-sm transition-colors hover:bg-[#a9cc38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">Notify Me When Ordering Opens <ArrowRight size={15}/></Link>}
      </div>

      <div className="flex shrink-0 items-center gap-1 min-[1360px]:hidden">
        <button ref={toggleRef} type="button" onClick={() => { wasOpenRef.current = !menuOpen; setMenuOpen(open => !open); }} aria-expanded={menuOpen} aria-controls="mobile-navigation-panel" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} className="grid size-11 place-items-center rounded-lg text-[#123B2A] transition-colors hover:bg-[#123B2A]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">
          {menuOpen ? <X size={22} strokeWidth={2}/> : <Menu size={22} strokeWidth={2}/>}
        </button>
      </div>
    </div>

    {menuOpen && <div id="mobile-navigation-panel" ref={panelRef} className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-[#123B2A]/10 bg-[#FFF8E9] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_18px_32px_-18px_rgba(18,59,42,.35)] sm:px-8 min-[1360px]:hidden" aria-label="Mobile navigation">
      <nav aria-label="Mobile primary navigation">
        <div className="flex items-center justify-between pb-1 pt-2"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#123B2A]/50">Explore wá jẹun</p><button type="button" onClick={closeMenu} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[#123B2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"><X size={15}/>Close</button></div>
        {renderLink({ label: 'Home', to: '/' }, true)}
        {publicLinks.map(item => renderLink(item, true))}
        <div className="pb-2 pt-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#123B2A]/50">Your workspace</p></div>
        {navigation.accountLinks.map(item => renderLink(item, true))}
        {user && <button type="button" onClick={() => void handleSignOut()} className="flex min-h-12 w-full items-center border-b border-[#123B2A]/10 px-1 text-left text-[15px] font-semibold text-[#20231F] hover:text-[#123B2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Sign out</button>}
        {signOutError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{signOutError}</p>}
        {!loading && (navigation.showVendorApplication || navigation.showCustomerLaunchList) && <div className="grid gap-2.5 pt-5">
          {navigation.showVendorApplication && <Link to="/vendor-register" onClick={closeMenu} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#123B2A]/20 bg-white px-4 text-sm font-bold text-[#123B2A] transition-colors hover:border-[#123B2A]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"><Store size={17}/>Become a Vendor</Link>}
          {navigation.showCustomerLaunchList && <Link to="/customer-register" onClick={closeMenu} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#B8D94B] px-4 text-sm font-bold text-[#123B2A] shadow-sm transition-colors hover:bg-[#a9cc38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Notify Me When Ordering Opens <ArrowRight size={16}/></Link>}
        </div>}
      </nav>
    </div>}
  </header>;
};
