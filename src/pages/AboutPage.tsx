import React from 'react';
import { Link } from 'react-router-dom';
import { 
  MapPin, 
  Utensils, 
  Target, 
  Compass, 
  Eye, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  HeartHandshake
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FFF8E9] pb-20">
      
      {/* 1. Hero Header */}
      <section className="bg-white border-b border-[#123B2A]/10 pt-8 pb-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 text-center">
          
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center justify-center gap-1.5 text-xs text-[#20231F]/60 pb-2">
            <Link to="/" className="hover:text-[#123B2A] transition-colors">Home</Link>
            <span className="text-slate-400">/</span>
            <span className="text-[#123B2A] font-semibold">About wá jẹun</span>
          </nav>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#123B2A]/5 text-[#123B2A] text-xs font-semibold">
            <MapPin className="w-3.5 h-3.5 text-[#123B2A]" />
            <span>Built for Ijebu Ode, Ogun State, Nigeria</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-[#123B2A] tracking-tight">
            Your City. Your Food.
          </h1>

          <p className="text-base sm:text-lg text-[#20231F]/80 max-w-2xl mx-auto leading-relaxed">
            wá jẹun is an independent initiative designed to modernize how people discover local meals and how local food businesses reach everyday customers.
          </p>

        </div>
      </section>

      {/* 2. Brand Mission & Honest Context */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 space-y-12">
        
        <div className="bg-white rounded-2xl border border-[#123B2A]/10 p-6 sm:p-10 space-y-6">
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#123B2A]">
              Our Purpose
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#123B2A]">
              Why start in Ijebu Ode?
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-[#20231F]/80 leading-relaxed">
              <p>
                Ijebu Ode is renowned across Nigeria for its rich culinary culture—from legendary bukateria delicacies and traditional soup kitchens to vibrant street grills and contemporary eateries.
              </p>
              <p>
                Yet discovering what is available, looking up verified menus, or checking current prices often requires physical visits, phone calls, or fragmented messaging. wá jẹun is being built to bridge this gap: providing a dedicated, unified online space where residents, workers, and visitors can explore their city's culinary landscape.
              </p>
            </div>
          </div>

          {/* Intended Benefits - Product Goals */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#123B2A]">
              Our Intended Product Goals
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="p-4 rounded-xl bg-[#FFF8E9] border border-[#123B2A]/10 space-y-1.5">
                <div className="font-bold text-sm text-[#123B2A] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#123B2A]" />
                  <span>Centralized Local Discovery</span>
                </div>
                <p className="text-xs text-[#20231F]/75 leading-relaxed">
                  Make it effortless to discover authentic food vendors in neighborhoods like Folagbade, Molipa, Igbeba, and Degun.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FFF8E9] border border-[#123B2A]/10 space-y-1.5">
                <div className="font-bold text-sm text-[#123B2A] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#123B2A]" />
                  <span>Transparent Menus & Prices</span>
                </div>
                <p className="text-xs text-[#20231F]/75 leading-relaxed">
                  Provide verified prices, portion options, and dish varieties so customers know exactly what to expect before ordering.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FFF8E9] border border-[#123B2A]/10 space-y-1.5">
                <div className="font-bold text-sm text-[#123B2A] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#123B2A]" />
                  <span>Frictionless Online Ordering</span>
                </div>
                <p className="text-xs text-[#20231F]/75 leading-relaxed">
                  Introduce streamlined online ordering as food businesses join, minimizing long queues and miscommunicated orders.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FFF8E9] border border-[#123B2A]/10 space-y-1.5">
                <div className="font-bold text-sm text-[#123B2A] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#123B2A]" />
                  <span>Empowering Local Food Businesses</span>
                </div>
                <p className="text-xs text-[#20231F]/75 leading-relaxed">
                  Give independent bukas, caterers, and eateries a free, polished web presence without needing expensive custom apps.
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* 3. Truthful Transparency Commitment */}
        <div className="bg-white rounded-2xl border border-[#123B2A]/10 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#123B2A] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#123B2A]" />
            <span>Our Commitment to Truthful Operations</span>
          </div>

          <h3 className="font-display text-xl font-bold text-[#123B2A]">
            We operate with complete honesty.
          </h3>

          <div className="space-y-3 text-xs sm:text-sm text-[#20231F]/80 leading-relaxed">
            <p>
              wá jẹun does not manufacture fake customer counts, dummy reviews, or fabricated order activity. We are in active pre-launch development, testing the system and gathering direct input from local residents and kitchen operators.
            </p>
            <p>
              When a food business is listed on wá jẹun, it means we have actually communicated with the owner, verified their dishes, and confirmed their pickup or delivery terms.
            </p>
          </div>
        </div>

        {/* 4. Action CTA */}
        <div className="bg-[#123B2A] text-white rounded-2xl p-8 sm:p-10 text-center space-y-5">
          <h3 className="font-display text-2xl sm:text-3xl font-bold">
            Be part of the founding community.
          </h3>
          <p className="text-sm text-white/80 max-w-md mx-auto">
            Whether you want to discover great meals or want customers to find your food, register your interest today.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/customer-register"
              className="min-h-11 px-6 py-2.5 text-xs font-bold text-[#123B2A] bg-[#B8D94B] hover:bg-[#a7c93e] rounded-xl flex items-center justify-center gap-1.5"
            >
              <span>Join Customer Launch List</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/vendor-register"
              className="min-h-11 px-6 py-2.5 text-xs font-bold text-white border border-white/20 hover:border-white rounded-xl flex items-center justify-center"
            >
              Register Food Business
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};
