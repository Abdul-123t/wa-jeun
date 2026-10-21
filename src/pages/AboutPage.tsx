import React from 'react';
import { ArrowRight, MapPin, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AboutPage: React.FC = () => (
  <main className="min-h-[70vh] bg-[#FFF8E9] px-4 py-10 sm:px-6 sm:py-16">
    <div className="mx-auto max-w-4xl">
      <header className="rounded-3xl border border-[#123B2A]/10 bg-white px-6 py-9 text-center sm:px-12 sm:py-14">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#123B2A]/5 px-3 py-1.5 text-xs font-semibold text-[#123B2A]"><MapPin className="h-3.5 w-3.5" aria-hidden="true"/>Ijebu Ode, Ogun State</p>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-[#123B2A] sm:text-5xl">Your City. Your Food.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#20231F]/75 sm:text-base">Built in Ijebu. Made for Ijebu. wá jẹun is a local food marketplace starting in Ijebu Ode, with room to grow across Ogun State and beyond.</p>
      </header>

      <section className="mt-6 rounded-3xl border border-[#123B2A]/10 bg-white p-6 sm:p-9" aria-labelledby="about-purpose">
        <h2 id="about-purpose" className="font-display text-2xl font-bold text-[#123B2A]">Made for local food discovery</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#20231F]/75">We’re building one place to find independent restaurants, bukas, grills, bakeries, and food businesses around Ijebu Ode. Vendors can apply to create storefronts; customers can browse real listings as they become available.</p>
        <div className="mt-6 rounded-2xl bg-[#FFF8E9] p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#123B2A]"><ShieldCheck className="h-4 w-4" aria-hidden="true"/>Where things stand</h3>
          <p className="mt-2 text-sm leading-6 text-[#20231F]/75">Vendor onboarding is open. Production ordering and payments are not yet available. Future fulfillment is planned through pickup or delivery managed by each vendor; wá jẹun does not operate a delivery fleet.</p>
        </div>
      </section>

      <section className="mt-6 flex flex-col items-start justify-between gap-5 rounded-3xl bg-[#123B2A] p-6 text-white sm:flex-row sm:items-center sm:p-9">
        <div><h2 className="font-display text-2xl font-bold">Join wá jẹun in Ijebu.</h2><p className="mt-2 text-sm text-white/75">Get launch updates or bring your food business online.</p></div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link to="/customer-register" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#B8D94B] px-4 text-sm font-bold text-[#123B2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Join launch list <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
          <Link to="/vendor-register" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Become a vendor</Link>
        </div>
      </section>
    </div>
  </main>
);
