/**
 * Navbar — Premium Glassmorphic Navigation for wá jẹun
 *
 * Features:
 * - Scroll-aware glass effect: transparent at top → more opaque + blurred on scroll
 * - Desktop: logo left · nav centre · actions right
 * - Animated underline active-indicator on nav links
 * - Subtle hover micro-interactions (underline slide-in, CTA lift)
 * - Mobile: glass drawer with grouped sections, animated toggle icon
 * - Escape-key + click-outside dismissal
 * - aria-expanded / aria-controls for accessibility
 * - prefers-reduced-motion respected via CSS and conditional transitions
 * - Backdrop-filter fallback for unsupported browsers
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Share2, Store } from 'lucide-react';

interface NavbarProps {
  onOpenShare?: () => void;
}

// ─── Route-aware active detection ─────────────────────────────────────────────
function useIsActive() {
  const location = useLocation();
  return useCallback(
    (path: string): boolean => {
      if (path.startsWith('/#')) {
        return location.pathname === '/' && location.hash === path.substring(1);
      }
      if (path.includes('?')) {
        const [p, search] = path.split('?');
        return location.pathname === p && location.search === `?${search}`;
      }
      return location.pathname === path;
    },
    [location]
  );
}

// ─── Scroll-aware glass state ──────────────────────────────────────────────────
function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > threshold);
    };
    // Set initial state
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return scrolled;
}

// ─── Primary nav links ─────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: 'Explore Food',        path: '/explore' },
  { label: 'How It Works',        path: '/#how-it-works' },
  { label: 'For Food Businesses', path: '/vendor-register' },
  { label: 'About',               path: '/about' },
  { label: 'Contact',             path: '/legal?tab=contact' },
] as const;

// ─── Desktop NavLink with animated underline ───────────────────────────────────
interface NavLinkProps {
  label: string;
  path: string;
  active: boolean;
  isVendor?: boolean;
  onClick?: () => void;
}

const DesktopNavLink: React.FC<NavLinkProps> = ({ label, path, active, isVendor, onClick }) => {
  const isHash = path.startsWith('/#');
  const sharedClass = [
    'relative group/link py-1 whitespace-nowrap shrink-0',
    'text-sm font-semibold transition-colors duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2 rounded-sm',
    'motion-reduce:transition-none',
    active
      ? 'text-[#123B2A] font-bold'
      : isVendor
        ? 'text-[#123B2A] hover:text-[#123B2A]/80'
        : 'text-[#20231F]/75 hover:text-[#123B2A]',
  ].join(' ');

  const underline = (
    <span
      className={[
        'absolute bottom-0 left-0 h-[2px] rounded-full bg-[#B8D94B]',
        'transition-all duration-250 ease-out motion-reduce:transition-none',
        active
          ? 'w-full opacity-100'
          : 'w-0 opacity-0 group-hover/link:w-full group-hover/link:opacity-100',
      ].join(' ')}
      aria-hidden="true"
    />
  );

  if (isHash) {
    return (
      <a href={path} className={sharedClass} onClick={onClick}>
        {label}
        {underline}
      </a>
    );
  }
  return (
    <Link to={path} className={sharedClass} onClick={onClick}>
      {label}
      {underline}
    </Link>
  );
};

// ─── Mobile nav row link ───────────────────────────────────────────────────────
interface MobileNavRowProps {
  label: string;
  path: string;
  active: boolean;
  badge?: string;
  onClick: () => void;
}

const MobileNavRow: React.FC<MobileNavRowProps> = ({ label, path, active, badge, onClick }) => {
  const isHash = path.startsWith('/#');
  const sharedClass = [
    'flex items-center justify-between w-full px-3.5 py-3',
    'text-sm font-semibold rounded-xl transition-colors duration-150 min-h-[48px]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]',
    active
      ? 'bg-[#123B2A] text-white'
      : 'text-[#20231F] hover:bg-[#123B2A]/6',
  ].join(' ');

  const inner = (
    <>
      <span>{label}</span>
      {badge && (
        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-[#B8D94B]/30 text-[#123B2A] px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </>
  );

  if (isHash) {
    return (
      <a href={path} className={sharedClass} onClick={onClick}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={path} className={sharedClass} onClick={onClick}>
      {inner}
    </Link>
  );
};

// ─── Animated hamburger / close icon ──────────────────────────────────────────
const MenuIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <span className="relative flex flex-col justify-center items-center w-6 h-6" aria-hidden="true">
    <span
      className={[
        'absolute block h-[2px] w-5 bg-[#123B2A] rounded-full origin-center',
        'transition-all duration-250 ease-out motion-reduce:transition-none',
        open ? 'rotate-45 translate-y-0' : '-translate-y-1.5',
      ].join(' ')}
    />
    <span
      className={[
        'absolute block h-[2px] w-5 bg-[#123B2A] rounded-full',
        'transition-all duration-200 ease-out motion-reduce:transition-none',
        open ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100',
      ].join(' ')}
    />
    <span
      className={[
        'absolute block h-[2px] w-5 bg-[#123B2A] rounded-full origin-center',
        'transition-all duration-250 ease-out motion-reduce:transition-none',
        open ? '-rotate-45 translate-y-0' : 'translate-y-1.5',
      ].join(' ')}
    />
  </span>
);

// ─── Main Navbar ───────────────────────────────────────────────────────────────
export const Navbar: React.FC<NavbarProps> = ({ onOpenShare }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrolled = useScrolled(20);
  const isActive = useIsActive();
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // ── Close mobile menu on route change ──
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  // ── Escape key dismissal ──
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  // ── Click-outside dismissal ──
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        drawerRef.current &&
        !drawerRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [mobileMenuOpen]);

  // ── Lock body scroll when mobile menu is open ──
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const closeMobile = () => setMobileMenuOpen(false);

  // ── Header glass class composition ──
  const headerClass = [
    'sticky top-0 z-40 w-full',
    // Glass foundation
    'transition-all duration-300 ease-out motion-reduce:transition-none',
    scrolled
      ? [
          // Scrolled state: more opaque, stronger blur, shadow + border
          'bg-[#FFF8E9]/92',
          '[backdrop-filter:blur(14px)_saturate(160%)]',
          'shadow-[0_1px_0_0_rgba(18,59,42,0.08),0_4px_24px_-4px_rgba(18,59,42,0.10)]',
          'border-b border-[#123B2A]/10',
        ].join(' ')
      : [
          // Top state: light, airy, integrated with hero
          'bg-[#FFF8E9]/75',
          '[backdrop-filter:blur(6px)_saturate(120%)]',
          'shadow-none',
          'border-b border-transparent',
        ].join(' '),
    // Fallback for browsers without backdrop-filter support
    'supports-[not(backdrop-filter)]:bg-[#FFF8E9]/98',
  ].join(' ');

  return (
    <header className={headerClass} role="banner">

      {/* ── Main bar ────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={[
            'flex items-center justify-between gap-6',
            'transition-all duration-300 ease-out motion-reduce:transition-none',
            scrolled ? 'h-[60px] md:h-[64px]' : 'h-[64px] md:h-[72px]',
          ].join(' ')}
        >

          {/* ── Logo / wordmark ── */}
          <Link
            to="/"
            className="flex items-baseline gap-2 group/logo whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2 rounded-sm"
            aria-label="wá jẹun — Home"
          >
            <span
              className={[
                'font-display font-extrabold tracking-tight text-[#123B2A] lowercase',
                'transition-all duration-250 ease-out motion-reduce:transition-none',
                'group-hover/logo:opacity-80',
                scrolled ? 'text-2xl md:text-[1.6rem]' : 'text-2xl md:text-[1.75rem]',
              ].join(' ')}
            >
              wá jẹun
            </span>
            <span className="hidden sm:inline-block text-[11px] font-semibold text-[#123B2A]/50 tracking-wider uppercase">
              · Ijebu Ode
            </span>
          </Link>

          {/* ── Desktop navigation ── */}
          <nav
            className="hidden lg:flex items-center gap-6 xl:gap-7"
            aria-label="Primary navigation"
          >
            {NAV_LINKS.map((link) => (
              <DesktopNavLink
                key={link.label}
                label={link.label}
                path={link.path}
                active={isActive(link.path)}
                isVendor={link.path === '/vendor-register'}
              />
            ))}
          </nav>

          {/* ── Desktop actions ── */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            {onOpenShare && (
              <button
                onClick={onOpenShare}
                type="button"
                className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-[#123B2A]/70 hover:text-[#123B2A] hover:bg-[#123B2A]/6 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"
                title="Share wá jẹun"
                aria-label="Share wá jẹun with friends"
              >
                <Share2 className="w-[18px] h-[18px]" />
              </button>
            )}

            {/* Primary CTA — Join Early Access */}
            <Link
              to="/customer-register"
              className={[
                'group/cta inline-flex items-center justify-center gap-1.5',
                'min-h-[42px] px-5 py-2 text-sm font-bold text-[#123B2A]',
                'bg-[#B8D94B] hover:bg-[#a9cc38]',
                'rounded-xl shadow-sm hover:shadow-md',
                'transition-all duration-200 ease-out motion-reduce:transition-none',
                'hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.98]',
                'whitespace-nowrap shrink-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2',
              ].join(' ')}
            >
              Join Early Access
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/cta:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </div>

          {/* ── Mobile actions ── */}
          <div className="flex items-center gap-1 lg:hidden">
            {onOpenShare && (
              <button
                onClick={onOpenShare}
                type="button"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#123B2A]/70 hover:text-[#123B2A] hover:bg-[#123B2A]/6 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"
                aria-label="Share wá jẹun"
              >
                <Share2 className="w-5 h-5" />
              </button>
            )}

            <button
              ref={menuButtonRef}
              onClick={() => setMobileMenuOpen((o) => !o)}
              type="button"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#123B2A] hover:bg-[#123B2A]/6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              <MenuIcon open={mobileMenuOpen} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      {/*
        Using CSS animation classes (already working via Tailwind plugin)
        rather than Framer Motion to keep the bundle lean.
        The drawer is conditionally rendered but animated via animate-in.
      */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-drawer"
          ref={drawerRef}
          className={[
            'lg:hidden',
            'border-t border-[#123B2A]/8',
            'bg-[#FFF8E9]/96 [backdrop-filter:blur(16px)_saturate(160%)]',
            'supports-[not(backdrop-filter)]:bg-[#FFF8E9]/99',
            'shadow-[0_16px_40px_-8px_rgba(18,59,42,0.14)]',
            'animate-in fade-in slide-in-from-top-1 duration-200',
            'px-4 pt-3 pb-6 overflow-y-auto max-h-[85svh]',
          ].join(' ')}
          role="navigation"
          aria-label="Mobile navigation"
        >
          {/* ── Group 1: Discover Food ── */}
          <div className="space-y-0.5 pb-3">
            <p className="px-3.5 pt-1 pb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#123B2A]/50">
              Discover Food
            </p>
            <MobileNavRow
              label="Home"
              path="/"
              active={location.pathname === '/' && !location.hash}
              onClick={closeMobile}
            />
            <MobileNavRow
              label="Explore Food Categories"
              path="/explore"
              active={isActive('/explore')}
              onClick={closeMobile}
            />
            <MobileNavRow
              label="How wá jẹun Works"
              path="/#how-it-works"
              active={false}
              onClick={closeMobile}
            />
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-[#123B2A]/8 mx-1 my-1" aria-hidden="true" />

          {/* ── Group 2: For Food Businesses ── */}
          <div className="space-y-0.5 py-3">
            <p className="px-3.5 pt-1 pb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#123B2A]/50">
              For Food Businesses
            </p>
            <MobileNavRow
              label="Register Buka or Restaurant"
              path="/vendor-register"
              active={isActive('/vendor-register')}
              badge="Founding Cohort"
              onClick={closeMobile}
            />
            <MobileNavRow
              label="Vendor FAQs &amp; Guidance"
              path="/#faq"
              active={false}
              onClick={closeMobile}
            />
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-[#123B2A]/8 mx-1 my-1" aria-hidden="true" />

          {/* ── Group 3: Information ── */}
          <div className="space-y-0.5 py-3">
            <p className="px-3.5 pt-1 pb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#123B2A]/50">
              Information &amp; Legal
            </p>
            <MobileNavRow
              label="About wá jẹun in Ijebu Ode"
              path="/about"
              active={isActive('/about')}
              onClick={closeMobile}
            />
            <MobileNavRow
              label="Contact Us"
              path="/legal?tab=contact"
              active={isActive('/legal?tab=contact')}
              onClick={closeMobile}
            />
            <MobileNavRow
              label="Privacy &amp; Terms"
              path="/legal?tab=privacy"
              active={false}
              onClick={closeMobile}
            />
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-[#123B2A]/8 mx-1 my-1" aria-hidden="true" />

          {/* ── Mobile CTAs ── */}
          <div className="pt-3 flex flex-col gap-2.5">
            <Link
              to="/customer-register"
              onClick={closeMobile}
              className={[
                'group/mobilecta w-full min-h-[50px]',
                'flex items-center justify-center gap-1.5',
                'px-4 py-3 text-sm font-bold text-[#123B2A]',
                'bg-[#B8D94B] hover:bg-[#a9cc38]',
                'rounded-xl shadow-sm active:scale-[0.98] transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]',
              ].join(' ')}
            >
              Join Early Access
              <ArrowRight className="w-4 h-4 transition-transform group-hover/mobilecta:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
            <Link
              to="/vendor-register"
              onClick={closeMobile}
              className={[
                'w-full min-h-[50px]',
                'flex items-center justify-center gap-1.5',
                'px-4 py-3 text-sm font-bold text-[#123B2A]',
                'bg-white border border-[#123B2A]/15 hover:border-[#123B2A]/40',
                'rounded-xl active:scale-[0.98] transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]',
              ].join(' ')}
            >
              <Store className="w-4 h-4 text-[#123B2A]" />
              Register Food Business
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
