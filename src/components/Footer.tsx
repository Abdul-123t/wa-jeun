import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowUpRight } from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const discoverLinks = [
    { label: 'Explore Food', to: '/explore' },
    { label: 'Browse Restaurants', to: '/explore' },
    { label: 'Popular Food Categories', to: '/explore?category=all' },
  ];

  const businessLinks = [
    { label: 'Register Your Business', to: '/vendor-register' },
    { label: 'How It Works', to: '/#how-it-works' },
  ];

  const helpLinks = [
    { label: 'Contact Us', to: '/legal?tab=contact' },
    { label: 'Frequently Asked Questions', to: '/#faq' },
    { label: 'Privacy Policy', to: '/legal?tab=privacy' },
    { label: 'Terms of Service', to: '/legal?tab=terms' },
  ];

  return (
    <footer
      className="relative bg-[#0D2E20] text-[#FFF8E9]/85 overflow-hidden"
      role="contentinfo"
    >
      {/* Decorative food-inspired SVG motif — subtle, non-distracting */}
      <div
        className="absolute top-0 right-0 w-[420px] h-[420px] pointer-events-none select-none opacity-[0.03]"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 420 420"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Stylised bowl / mortar — a nod to food preparation */}
          <ellipse cx="210" cy="260" rx="170" ry="80" stroke="#FFF8E9" strokeWidth="2.5" />
          <path
            d="M60 260 Q 60 140 210 120 Q 360 140 360 260"
            stroke="#FFF8E9"
            strokeWidth="2.5"
            fill="none"
          />
          <line x1="210" y1="50" x2="210" y2="120" stroke="#FFF8E9" strokeWidth="2" />
          <line x1="180" y1="60" x2="195" y2="125" stroke="#FFF8E9" strokeWidth="1.5" />
          <line x1="240" y1="60" x2="225" y2="125" stroke="#FFF8E9" strokeWidth="1.5" />
          {/* Steam wisps */}
          <path d="M185 50 Q 180 30 190 15" stroke="#FFF8E9" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M210 45 Q 205 20 215 5" stroke="#FFF8E9" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M235 50 Q 230 30 240 15" stroke="#FFF8E9" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      {/* Top accent line */}
      <div className="h-[3px] bg-gradient-to-r from-[#B8D94B]/60 via-[#E8913A]/40 to-[#B8D94B]/20" aria-hidden="true" />

      {/* ─── Main content ─── */}
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 pt-14 pb-10">

        {/* Grid: brand + 3 link columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-y-12 gap-x-8 lg:gap-x-10">

          {/* ── Brand column ── */}
          <div className="lg:col-span-4 space-y-5">
            <Link
              to="/"
              className="inline-block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D2E20] rounded-lg"
              aria-label="Wá Jẹun Home"
            >
              <span className="font-display text-[1.75rem] font-extrabold tracking-tight text-[#FFF8E9] lowercase transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none">
                wá jẹun
              </span>
            </Link>

            <p className="text-[0.84rem] leading-relaxed text-[#FFF8E9]/65 max-w-xs">
              Discover great food around you. Find local favourites, explore
              menus, and order from food businesses in your community.
            </p>

            <div className="flex items-center gap-2 text-xs text-[#FFF8E9]/50">
              <MapPin className="w-3.5 h-3.5 text-[#B8D94B] shrink-0" />
              <span>Ijebu Ode, Ogun State, Nigeria</span>
            </div>
          </div>

          {/* ── Discover column ── */}
          <nav className="lg:col-span-2 lg:col-start-6" aria-label="Discover">
            <h3 className="footer-heading">Discover</h3>
            <ul className="space-y-2.5 mt-4" role="list">
              {discoverLinks.map((link) => (
                <li key={link.label}>
                  <FooterLink to={link.to}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── For Food Businesses column ── */}
          <nav className="lg:col-span-3" aria-label="For Food Businesses">
            <h3 className="footer-heading">For Food Businesses</h3>
            <ul className="space-y-2.5 mt-4" role="list">
              {businessLinks.map((link) => (
                <li key={link.label}>
                  <FooterLink to={link.to}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Help & Information column ── */}
          <nav className="lg:col-span-3" aria-label="Help and Information">
            <h3 className="footer-heading">Help &amp; Information</h3>
            <ul className="space-y-2.5 mt-4" role="list">
              {helpLinks.map((link) => (
                <li key={link.label}>
                  <FooterLink to={link.to}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* ─── Divider ─── */}
        <div className="mt-14 mb-6 h-px bg-[#FFF8E9]/8" aria-hidden="true" />

        {/* ─── Bottom bar ─── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[0.7rem] text-[#FFF8E9]/40">
          <p>
            &copy; {currentYear} Wá Jẹun. All rights reserved.
          </p>

          <div className="flex items-center gap-5">
            <Link
              to="/legal?tab=privacy"
              className="footer-bottom-link"
            >
              Privacy
            </Link>
            <span className="text-[#FFF8E9]/15" aria-hidden="true">·</span>
            <Link
              to="/legal?tab=terms"
              className="footer-bottom-link"
            >
              Terms
            </Link>
            <span className="text-[#FFF8E9]/15" aria-hidden="true">·</span>
            <Link
              to="/legal?tab=contact"
              className="footer-bottom-link"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

/* ─── Reusable footer link component ─── */
interface FooterLinkProps {
  to: string;
  children: React.ReactNode;
}

const FooterLink: React.FC<FooterLinkProps> = ({ to, children }) => {
  const isHash = to.startsWith('/#');

  const sharedClasses =
    'group/link inline-flex items-center gap-1 text-[0.82rem] text-[#FFF8E9]/60 transition-colors duration-200 ease-out hover:text-[#E8913A] focus-visible:text-[#E8913A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913A]/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0D2E20] rounded-sm motion-reduce:transition-none';

  const arrow = (
    <ArrowUpRight
      className="w-3 h-3 opacity-0 -translate-x-1 translate-y-0.5 transition-all duration-200 ease-out group-hover/link:opacity-70 group-hover/link:translate-x-0 group-hover/link:translate-y-0 group-focus-visible/link:opacity-70 group-focus-visible/link:translate-x-0 group-focus-visible/link:translate-y-0 motion-reduce:transition-none"
      aria-hidden="true"
    />
  );

  if (isHash) {
    return (
      <a href={to} className={sharedClasses}>
        {children}
        {arrow}
      </a>
    );
  }

  return (
    <Link to={to} className={sharedClasses}>
      {children}
      {arrow}
    </Link>
  );
};
