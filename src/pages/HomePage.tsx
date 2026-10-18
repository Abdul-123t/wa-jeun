import React from 'react';
import { ArrowRight, MapPin, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import heroImage from '../assets/images/hero_nigerian_jollof_feast_1792169660639.jpg';
<<<<<<< Updated upstream
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  MapPin,
  Store,
  ChevronDown,
  CheckCircle2,
  Utensils,
  Search,
  Compass,
  Clock,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  ChefHat
} from 'lucide-react';
import { FOOD_CATEGORIES } from '../data/categories';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [howItWorksTab, setHowItWorksTab] = useState<'diners' | 'vendors'>('diners');
  const [faqFilter, setFaqFilter] = useState<'all' | 'diners' | 'vendors' | 'delivery'>('all');

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/explore?category=${categoryId}`);
  };

  const allFaqs = [
    {
      category: 'general',
      q: "What is wá jẹun?",
      a: "wá jẹun is an independent food marketplace platform created to help food lovers discover local food businesses, view transparent menus and prices, and order food online, starting in Ijebu Ode, Ogun State, Nigeria."
    },
    {
      category: 'general',
      q: "Is wá jẹun available in Ijebu Ode yet?",
      a: "We are currently in our pre-launch phase in Ijebu Ode. We are actively inviting local restaurants, bukas, caterers, and food creators to express interest in joining our initial onboarding group before public ordering opens."
    },
    {
      category: 'diners',
      q: "Can I order food right now?",
      a: "No, live ordering is not yet active. We believe in complete operational transparency: no customer orders will be processed until participating food vendors in Ijebu Ode have completed onboarding, set up their verified menus, and tested their fulfillment workflows."
    },
    {
      category: 'vendors',
      q: "How can I register my restaurant, buka, or canteen?",
      a: "If you operate a food business in Ijebu Ode—whether a traditional buka, modern restaurant, grill spot, or home bakery—visit our 'For Food Businesses' page to submit your interest. Our onboarding team will contact you directly to discuss details."
    },
    {
      category: 'vendors',
      q: "Does it cost anything for a food business to join?",
      a: "No upfront fees are charged to express interest or join the founding cohort. We assist with digital menu setup so local businesses can test the system risk-free."
    },
    {
      category: 'delivery',
      q: "Will vendors handle delivery or will wá jẹun have riders?",
      a: "At initial launch, fulfillment will be handled via customer pickup or delivery organized directly by the food business. wá jẹun does not operate a fleet of motorcycles or employ dedicated delivery riders during this initial phase."
    },
    {
      category: 'delivery',
      q: "Will customer pickup be available?",
      a: "Yes. Every participating vendor can offer customer pickup, allowing you to browse menus ahead of time, place your order, and pick up fresh food without waiting in line."
    },
    {
      category: 'diners',
      q: "How will I know when the marketplace officially opens for ordering?",
      a: "By registering on our Customer Launch List, you will receive direct WhatsApp or email updates as onboarding progresses and when ordering goes live in your specific neighborhood."
    },
    {
      category: 'general',
      q: "What happens to my submitted contact information?",
      a: "Your information is securely stored and used strictly to notify you about the wá jẹun rollout and onboarding. We do not sell your data or share your personal contact details with third parties."
    }
  ];

  const filteredFaqs = allFaqs.filter(faq => {
    if (faqFilter === 'all') return true;
    if (faqFilter === 'diners') return faq.category === 'diners' || faq.category === 'general';
    if (faqFilter === 'vendors') return faq.category === 'vendors' || faq.category === 'general';
    if (faqFilter === 'delivery') return faq.category === 'delivery';
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen">

      {/* 1. Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24 border-b border-[#123B2A]/10 bg-[#FFF8E9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-left">

              {/* Honest Location & Stage Indicator */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#123B2A]/5 text-[#123B2A] text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5 text-[#123B2A]" />
                <span>Starting in Ijebu Ode, Ogun State</span>
                <span className="text-[#123B2A]/30">·</span>
                <span className="text-[#123B2A]/80 font-medium">Pre-Launch Onboarding</span>
              </div>

              {/* Main Heading */}
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#123B2A] tracking-tight leading-[1.1] text-balance">
                Your next favorite meal starts here.
              </h1>

              {/* Supporting Copy */}
              <p className="text-base sm:text-lg text-[#20231F]/80 max-w-xl leading-relaxed">
                Discover the food around you. wá jẹun is bringing Ijebu Ode's food businesses closer to the people who love their meals.
              </p>

              {/* Dual-Audience Action Pathways */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Link
                  to="/customer-register"
                  className="min-h-12.5 px-7 py-3 text-base font-bold text-[#123B2A] bg-[#B8D94B] hover:bg-[#a7c93e] rounded-xl shadow-sm hover:shadow transition-all text-center flex items-center justify-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"
                >
                  <span>Join the Launch List</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/vendor-register"
                  className="min-h-12.5 px-6 py-3 text-base font-bold text-[#123B2A] bg-white border border-[#123B2A]/20 hover:border-[#123B2A] rounded-xl transition-all text-center flex items-center justify-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"
                >
                  <Store className="w-4 h-4 text-[#123B2A]" />
                  <span>List Your Food Business</span>
                </Link>
              </div>

              {/* Quick Trust / Context Indicators - Clean unboxed text with subtle separators */}
              <div className="pt-4 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-[#20231F]/75">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#123B2A]" />
                  Authentic Buka & Restaurant Menus
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#123B2A]" />
                  Pickup & Vendor Delivery
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#123B2A]" />
                  Zero Spam Guarantee
                </span>
              </div>

            </div>

            {/* Right Visual: Nigerian Jollof Feast Photography */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl overflow-hidden shadow-xl border border-[#123B2A]/10 bg-white group">
                <img
                  src={heroImage}
                  alt="Nigerian jollof rice feast with grilled chicken and plantain"
                  className="w-full h-64 sm:h-80 lg:h-112 object-cover"
                />

                {/* Visual card overlay with clear action */}
                <div className="p-4 bg-white/95 backdrop-blur-sm border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#123B2A]">
                      Authentic Local Flavors
                    </p>
                    <p className="text-[11px] text-[#20231F]/70">
                      From local bukas to everyday grills in Ijebu Ode
                    </p>
                  </div>
                  <Link
                    to="/explore"
                    className="text-xs font-bold text-[#123B2A] hover:underline flex items-center gap-1 focus-visible:outline-none"
                  >
                    <span>Preview Food</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
=======
>>>>>>> Stashed changes

export const HomePage: React.FC = () => (
  <div className="bg-[#FFF8E9]">
    <section className="border-b border-[#123B2A]/10 py-9 sm:py-14">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[#123B2A]/5 px-3 py-1.5 text-xs font-semibold text-[#123B2A]"><MapPin className="h-3.5 w-3.5" aria-hidden="true"/>Ijebu Ode, Ogun State</p>
          <h1 className="mt-5 max-w-xl font-display text-4xl font-extrabold leading-tight tracking-tight text-[#123B2A] sm:text-5xl">Built in Ijebu. Made for Ijebu.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#20231F]/75">Your City. Your Food. Discover local food businesses as they join wá jẹun.</p>
          <p className="mt-3 text-sm font-semibold text-[#123B2A]">Vendor onboarding is open. Customer ordering is not available yet.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/explore" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#123B2A] px-5 text-sm font-bold text-white hover:bg-[#194d37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">Explore food <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
            <Link to="/customer-register" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#B8D94B] px-5 text-sm font-bold text-[#123B2A] hover:bg-[#a7c93e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">Join the launch list</Link>
          </div>
          <Link to="/vendor-register" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#123B2A] underline decoration-[#123B2A]/30 underline-offset-4 hover:decoration-[#123B2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"><Store className="h-4 w-4" aria-hidden="true"/>Register a food business</Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#123B2A]/10 bg-white shadow-sm">
          <img src={heroImage} alt="Nigerian jollof rice with grilled chicken and plantain" className="h-64 w-full object-cover sm:h-80" fetchPriority="high" />
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm font-semibold text-[#123B2A]">Local food discovery, starting in Ijebu Ode.</p>
            <Link to="/explore" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-[#123B2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]">Browse directory <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
          </div>
        </div>
      </div>
    </section>

    <section id="how-it-works" className="border-b border-[#123B2A]/10 bg-white py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#123B2A]/60">Getting started</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-[#123B2A] sm:text-3xl">A local marketplace, built step by step.</h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-[#123B2A]/10 bg-[#FFF8E9] p-5">
            <h3 className="font-display text-lg font-bold text-[#123B2A]">For customers</h3>
            <p className="mt-2 text-sm leading-6 text-[#20231F]/70">Browse real listings and join the launch list for updates. Ordering will open after vendor and checkout readiness is confirmed.</p>
            <Link to="/customer-register" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#123B2A] underline underline-offset-4">Get launch updates <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
          </article>
          <article className="rounded-2xl border border-[#123B2A]/10 bg-[#FFF8E9] p-5">
            <h3 className="font-display text-lg font-bold text-[#123B2A]">For food businesses</h3>
            <p className="mt-2 text-sm leading-6 text-[#20231F]/70">Apply to create a storefront. Applications are reviewed before a business can become publicly orderable.</p>
            <Link to="/vendor-register" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#123B2A] underline underline-offset-4">Become a vendor <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
          </article>
        </div>
<<<<<<< Updated upstream
      </section>

      {/* 4. How wá jẹun Will Work (Dual-Audience Tab Switcher) */}
      <section id="how-it-works" className="py-16 md:py-20 bg-white border-b border-[#123B2A]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#123B2A]">
              Simple & Straightforward
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#123B2A] tracking-tight">
              How wá jẹun will work.
            </h2>
            <p className="text-sm sm:text-base text-[#20231F]/75">
              Online food discovery and ordering designed specifically for Ijebu Ode's neighborhoods.
            </p>

            {/* Audience Segment Tabs */}
            <div className="pt-2 inline-flex items-center p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setHowItWorksTab('diners')}
                type="button"
                className={`min-h-10 px-5 text-xs font-bold rounded-lg transition-all ${howItWorksTab === 'diners'
                  ? 'bg-white text-[#123B2A] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                For Food Lovers
              </button>
              <button
                onClick={() => setHowItWorksTab('vendors')}
                type="button"
                className={`min-h-10 px-5 text-xs font-bold rounded-lg transition-all ${howItWorksTab === 'vendors'
                  ? 'bg-white text-[#123B2A] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                For Food Businesses
              </button>
            </div>
          </div>

          {/* Diners Step Grid */}
          {howItWorksTab === 'diners' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-200">

              {/* Step 1 */}
              <div className="space-y-3 p-6 rounded-2xl bg-[#FFF8E9] border border-[#123B2A]/10 relative">
                <div className="w-10 h-10 rounded-xl bg-[#123B2A] text-white flex items-center justify-center font-bold text-sm">
                  01
                </div>
                <h3 className="font-display text-lg font-bold text-[#123B2A]">
                  Discover local spots
                </h3>
                <p className="text-xs text-[#20231F]/80 leading-relaxed">
                  Browse verified restaurants, bukas, and caterers across neighborhoods like Molipa, Igbeba, and Folagbade.
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-3 p-6 rounded-2xl bg-[#FFF8E9] border border-[#123B2A]/10 relative">
                <div className="w-10 h-10 rounded-xl bg-[#123B2A] text-white flex items-center justify-center font-bold text-sm">
                  02
                </div>
                <h3 className="font-display text-lg font-bold text-[#123B2A]">
                  See real menus & prices
                </h3>
                <p className="text-xs text-[#20231F]/80 leading-relaxed">
                  Check exact dishes, available proteins, side combinations, and transparent pricing updated by each vendor.
                </p>
              </div>

              {/* Step 3 */}
              <div className="space-y-3 p-6 rounded-2xl bg-[#FFF8E9] border border-[#123B2A]/10 relative">
                <div className="w-10 h-10 rounded-xl bg-[#123B2A] text-white flex items-center justify-center font-bold text-sm">
                  03
                </div>
                <h3 className="font-display text-lg font-bold text-[#123B2A]">
                  Place your order online
                </h3>
                <p className="text-xs text-[#20231F]/80 leading-relaxed">
                  Once participating businesses go live, order directly without endless phone calls or WhatsApp back-and-forth.
                </p>
              </div>

              {/* Step 4 */}
              <div className="space-y-3 p-6 rounded-2xl bg-[#FFF8E9] border border-[#123B2A]/10 relative">
                <div className="w-10 h-10 rounded-xl bg-[#123B2A] text-white flex items-center justify-center font-bold text-sm">
                  04
                </div>
                <h3 className="font-display text-lg font-bold text-[#123B2A]">
                  Pickup or vendor delivery
                </h3>
                <p className="text-xs text-[#20231F]/80 leading-relaxed">
                  Pick up freshly packed food directly, or receive delivery arranged by the food business where offered.
                </p>
              </div>

            </div>
          )}

          {/* Vendors Step Grid */}
          {howItWorksTab === 'vendors' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-200">

              {/* Step 1 */}
              <div className="space-y-3 p-6 rounded-2xl bg-[#FFF8E9] border border-[#123B2A]/10 relative">
                <div className="w-10 h-10 rounded-xl bg-[#123B2A] text-white flex items-center justify-center font-bold text-sm">
                  01
                </div>
                <h3 className="font-display text-lg font-bold text-[#123B2A]">
                  Submit your interest
                </h3>
                <p className="text-xs text-[#20231F]/80 leading-relaxed">
                  Fill in simple details about your buka, restaurant, or grill in under 2 minutes with no registration cost.
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-3 p-6 rounded-2xl bg-[#FFF8E9] border border-[#123B2A]/10 relative">
                <div className="w-10 h-10 rounded-xl bg-[#123B2A] text-white flex items-center justify-center font-bold text-sm">
                  02
                </div>
                <h3 className="font-display text-lg font-bold text-[#123B2A]">
                  Free menu digitization
                </h3>
                <p className="text-xs text-[#20231F]/80 leading-relaxed">
                  Our Ijebu Ode team assists you with listing dishes, prices, and operating hours in a clean online storefront.
                </p>
              </div>

              {/* Step 3 */}
              <div className="space-y-3 p-6 rounded-2xl bg-[#FFF8E9] border border-[#123B2A]/10 relative">
                <div className="w-10 h-10 rounded-xl bg-[#123B2A] text-white flex items-center justify-center font-bold text-sm">
                  03
                </div>
                <h3 className="font-display text-lg font-bold text-[#123B2A]">
                  Set your fulfillment rules
                </h3>
                <p className="text-xs text-[#20231F]/80 leading-relaxed">
                  Decide whether customers pick up orders at your counter, or whether you dispatch with your existing delivery.
                </p>
              </div>

              {/* Step 4 */}
              <div className="space-y-3 p-6 rounded-2xl bg-[#FFF8E9] border border-[#123B2A]/10 relative">
                <div className="w-10 h-10 rounded-xl bg-[#123B2A] text-white flex items-center justify-center font-bold text-sm">
                  04
                </div>
                <h3 className="font-display text-lg font-bold text-[#123B2A]">
                  Grow your daily sales
                </h3>
                <p className="text-xs text-[#20231F]/80 leading-relaxed">
                  Reach new customers across Ijebu Ode neighborhoods who are eager to discover and patronize your kitchen.
                </p>
              </div>

            </div>
          )}

          {/* Operational Clarity Callout */}
          <div className="p-4 rounded-xl bg-[#123B2A]/5 border border-[#123B2A]/10 max-w-3xl mx-auto flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#123B2A] shrink-0 mt-0.5" />
            <p className="text-xs text-[#20231F]/80 leading-relaxed">
              <strong>Fulfillment Clarification:</strong> wá jẹun does not operate motorbikes or employ dispatch riders. All deliveries are coordinated directly by participating restaurants, ensuring you deal directly with established local businesses.
            </p>
          </div>

        </div>
      </section>

      {/* 5. For Food Businesses Recruitment Section */}
      <section className="py-16 md:py-24 bg-[#123B2A] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">

            <div className="lg:col-span-8 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B8D94B]/20 text-[#B8D94B] text-xs font-bold uppercase tracking-wider">
                <Store className="w-3.5 h-3.5" />
                <span>Founding Vendor Cohort</span>
              </div>

              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white">
                Your food deserves to be discovered.
              </h2>

              <p className="text-base sm:text-lg text-white/80 max-w-2xl leading-relaxed">
                wá jẹun is preparing a new way for people in Ijebu Ode to discover local food businesses. Tell us about your business and register your interest in joining the first group of vendors.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-sm text-white/90">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-[#B8D94B] shrink-0 mt-0.5" />
                  <span>Free digital storefront for your menu</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-[#B8D94B] shrink-0 mt-0.5" />
                  <span>Receive customer orders for pickup or your own delivery</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-[#B8D94B] shrink-0 mt-0.5" />
                  <span>No upfront fees to express interest</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-[#B8D94B] shrink-0 mt-0.5" />
                  <span>Direct onboarding assistance for your staff</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/vendor-register"
                  className="min-h-12 px-8 py-3.5 text-base font-bold text-[#123B2A] bg-[#B8D94B] hover:bg-[#a7c93e] rounded-xl shadow-lg transition-all text-center flex items-center justify-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span>Register Your Business</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/legal?tab=contact"
                  className="min-h-12 px-6 py-3.5 text-base font-bold text-white border border-white/20 hover:border-white rounded-xl transition-all text-center flex items-center justify-center active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Ask a Question
                </Link>
              </div>

            </div>

            {/* Quick vendor requirements note */}
            <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-[#B8D94B]">
                Who can register?
              </h3>
              <ul className="space-y-3 text-xs text-white/80">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B8D94B]" />
                  <span>Traditional bukas and local soup joints</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B8D94B]" />
                  <span>Restaurants & modern dining spots</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B8D94B]" />
                  <span>Evening grills, suya masters & shawarma stands</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B8D94B]" />
                  <span>Bakeries, pastry makers & caterers</span>
                </li>
              </ul>
              <p className="text-[11px] text-white/50 pt-2 border-t border-white/10 leading-relaxed">
                *Submitting an interest form expresses willingness to join discussions; it does not constitute a binding commercial agreement.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 6. Frequently Asked Questions with Fast Category Filters */}
      <section id="faq" className="py-16 md:py-20 bg-[#FFF8E9] border-b border-[#123B2A]/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#123B2A]">
              Frequently Asked Questions
            </span>
            <h2 className="font-display text-3xl font-extrabold text-[#123B2A]">
              Answers you can trust.
            </h2>
            <p className="text-sm text-[#20231F]/70">
              Clear, transparent facts about our current pre-launch stage in Ijebu Ode.
            </p>

            {/* Filter Tabs */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-1.5">
              <button
                onClick={() => setFaqFilter('all')}
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${faqFilter === 'all'
                  ? 'bg-[#123B2A] text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
              >
                All Questions
              </button>
              <button
                onClick={() => setFaqFilter('diners')}
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${faqFilter === 'diners'
                  ? 'bg-[#123B2A] text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
              >
                For Customers
              </button>
              <button
                onClick={() => setFaqFilter('vendors')}
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${faqFilter === 'vendors'
                  ? 'bg-[#123B2A] text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
              >
                For Food Businesses
              </button>
              <button
                onClick={() => setFaqFilter('delivery')}
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${faqFilter === 'delivery'
                  ? 'bg-[#123B2A] text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
              >
                Delivery & Pickup
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredFaqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-[#123B2A]/15 bg-white overflow-hidden transition-all shadow-xs"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full min-h-13 px-5 py-4 text-left flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-[#123B2A] hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 text-[#123B2A] ${isOpen ? 'rotate-180' : ''
                        }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-[#20231F]/80 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 7. Bottom Dual-Audience Conversion Cards */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-center">

          <div className="space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#123B2A]">
              Ready to be part of wá jẹun's journey?
            </h2>
            <p className="text-sm text-[#20231F]/75 max-w-xl mx-auto">
              Whether you want to discover delicious meals or bring your kitchen online, choose your pathway below.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {/* Card 1: For Customers */}
            <div className="p-6 rounded-2xl bg-[#FFF8E9] border border-[#123B2A]/15 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#123B2A]">For Food Lovers</span>
                <h3 className="text-xl font-bold text-[#123B2A]">Join Customer Launch List</h3>
                <p className="text-xs sm:text-sm text-[#20231F]/75 leading-relaxed">
                  Be notified as soon as authentic bukas and eateries in your neighborhood are ready for pickup and delivery orders.
                </p>
              </div>
              <div>
                <Link
                  to="/customer-register"
                  className="w-full min-h-11.5 px-6 py-2.5 text-sm font-bold text-[#123B2A] bg-[#B8D94B] hover:bg-[#a7c93e] rounded-xl transition-all flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"
                >
                  <span>Get Early Access</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Card 2: For Food Businesses */}
            <div className="p-6 rounded-2xl bg-[#123B2A] text-white flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#B8D94B]">For Food Businesses</span>
                <h3 className="text-xl font-bold text-white">Register Your Kitchen</h3>
                <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                  Join our founding vendor cohort in Ijebu Ode. Free digital menu setup, zero upfront fees, and direct customer connection.
                </p>
              </div>
              <div>
                <Link
                  to="/vendor-register"
                  className="w-full min-h-11.5 px-6 py-2.5 text-sm font-bold text-[#123B2A] bg-white hover:bg-slate-100 rounded-xl transition-all flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Store className="w-4 h-4 text-[#123B2A]" />
                  <span>Register Food Business</span>
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
};
=======
      </div>
    </section>
  </div>
);
>>>>>>> Stashed changes
