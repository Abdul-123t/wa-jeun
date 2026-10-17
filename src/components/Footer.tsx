import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin, Share2 } from 'lucide-react';
import { FooterIllustrations } from './FooterIllustrations';

type FooterProps = { onOpenShare?: () => void };

export const Footer: React.FC<FooterProps> = ({ onOpenShare }) => {
  const year = new Date().getFullYear();

  return <footer className="relative overflow-hidden bg-[#123B2A] text-[#FFF8E9]" role="contentinfo">
    <div className="h-1 bg-[#B8D94B]" aria-hidden="true" />

    <section className="border-b border-[#FFF8E9]/15 px-5 py-11 sm:px-8 sm:py-14 lg:py-[4.5rem]" aria-labelledby="footer-editorial-title">
      <div className="mx-auto grid max-w-7xl items-center gap-x-10 gap-y-7 lg:grid-cols-[.92fr_1.08fr] lg:gap-x-14">
        <div className="max-w-[34rem] lg:col-start-1 lg:row-start-1">
          <p className="mb-3 font-display text-[11px] font-bold uppercase tracking-[.2em] text-[#B8D94B] sm:text-xs">A little taste of Ijebu</p>
          <h2 id="footer-editorial-title" className="font-display text-[2.3rem] font-semibold leading-[1.04] tracking-[-.04em] text-[#FFF8E9] min-[360px]:text-[2.55rem] sm:text-5xl lg:text-[3.4rem]">
            Good food. Good people. <span className="text-[#B8D94B]">Good Ijebu.</span>
          </h2>
        </div>

        <div className="footer-artwork -mx-1 sm:mx-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <FooterIllustrations />
        </div>

        <p className="max-w-[36rem] text-sm leading-7 text-[#FFF8E9]/80 sm:text-base sm:leading-8 lg:col-start-1 lg:row-start-2">
          From the beloved bukas of Ijebu Ode to the sizzling grills and kitchens around town, we’re celebrating the local cooks, authentic flavours, and shared moments that make our city feel like home. Every meal tells a story, and every local kitchen has one worth discovering.
        </p>
      </div>
    </section>

    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-10 gap-y-8 px-5 py-9 sm:grid-cols-2 sm:gap-y-10 sm:px-8 sm:py-11 lg:grid-cols-12 lg:gap-x-8 lg:py-14">
      <div className="sm:col-span-2 sm:max-w-xl lg:col-span-4 lg:pr-8">
        <Link to="/" aria-label="wá jẹun home" className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D94B] focus-visible:ring-offset-4 focus-visible:ring-offset-[#123B2A]">
          <img src="/brand/wa-jeun-logo.webp" alt="" aria-hidden="true" className="h-28 w-auto rounded-md object-contain" />
        </Link>
        <p className="mt-1 text-sm font-semibold text-[#B8D94B]">Your City. Your Food.</p>
        <p className="mt-4 max-w-sm text-sm leading-6 text-[#FFF8E9]/75">A local food marketplace bringing Ijebu Ode’s cooks, kitchens, and authentic flavours closer to the people who love them.</p>
        <p className="mt-4 flex items-center gap-2 text-sm text-[#FFF8E9]/75"><MapPin className="h-4 w-4 shrink-0 text-[#B8D94B]" aria-hidden="true" />Ijebu Ode, Ogun State, Nigeria</p>
        {onOpenShare && <button type="button" onClick={onOpenShare} className="footer-action mt-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D94B] focus-visible:ring-offset-4 focus-visible:ring-offset-[#123B2A]">
          <Share2 className="h-4 w-4" aria-hidden="true" />Share wá jẹun
        </button>}
      </div>

      <FooterNav title="Explore" className="lg:col-span-2" links={[
        ['Explore Food', '/explore'], ['Join the Launch List', '/customer-register'], ['About wá jẹun', '/about'],
      ]} />

      <div className="lg:col-span-3">
        <h3 className="footer-heading">Food businesses</h3>
        <p className="mt-3 max-w-xs text-sm leading-6 text-[#FFF8E9]/70">Restaurants, bukas, grills, bakeries, and street-food businesses: bring your kitchen to more local food lovers.</p>
        <Link to="/vendor-register" className="footer-action mt-3">
          List Your Food Business <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <FooterNav title="Help & information" className="lg:col-span-3" links={[
        ['Contact', '/legal?tab=contact'], ['Privacy', '/legal?tab=privacy'], ['Terms', '/legal?tab=terms'],
      ]} />
    </div>

    <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
      <div className="footer-rule" aria-hidden="true" />
      <div className="flex flex-col gap-2.5 py-5 text-xs leading-5 text-[#FFF8E9]/70 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p>© {year} wá jẹun. All rights reserved.</p>
        <p className="text-[#FFF8E9]/80">A product of NAMACO TECHNOLOGY NIGERIA LIMITED.</p>
      </div>
    </div>
  </footer>;
};

type FooterNavProps = { title: string; className?: string; links: [string, string][] };

const FooterNav: React.FC<FooterNavProps> = ({ title, className = '', links }) => (
  <nav className={className} aria-label={title}>
    <h3 className="footer-heading">{title}</h3>
    <ul className="mt-2">
      {links.map(([label, to]) => <li key={to}><Link className="footer-link" to={to}>{label}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></li>)}
    </ul>
  </nav>
);
