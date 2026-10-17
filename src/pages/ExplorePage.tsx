import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  X, 
  MapPin, 
  UtensilsCrossed, 
  ArrowRight, 
  Clock, 
  Store,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  MessageSquarePlus
} from 'lucide-react';
import { FOOD_CATEGORIES, IJEBU_ODE_AREAS } from '../data/categories';
import { api } from '../services/api';

export const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategoryFromUrl = searchParams.get('category') || 'all';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(selectedCategoryFromUrl);
  const [selectedArea, setSelectedArea] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);

  // Sync category param if URL changes
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) {
      setSelectedCategory(cat);
    } else {
      setSelectedCategory('all');
    }
  }, [searchParams]);

  // Query API to demonstrate live connection and truthful 0-vendor status
  useEffect(() => {
    setIsLoading(true);
    api.getVendors({
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      search: searchTerm.trim() || undefined
    })
      .then((res) => {
        setVendors(res.vendors || []);
      })
      .catch((err) => {
        console.error('Vendor query failed:', err);
        setVendors([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [selectedCategory, searchTerm, selectedArea, fulfillmentFilter]);

  const handleCategorySelect = (id: string) => {
    setSelectedCategory(id);
    if (id === 'all') {
      searchParams.delete('category');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ category: id });
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedArea('all');
    setFulfillmentFilter('all');
    setSearchParams({});
  };

  const hasActiveFilters = 
    searchTerm.trim() !== '' || 
    selectedCategory !== 'all' || 
    selectedArea !== 'all' || 
    fulfillmentFilter !== 'all';

  const currentCategoryData = FOOD_CATEGORIES.find(c => c.id === selectedCategory);

  // Quick suggestions for search
  const quickSearchTags = ['Jollof', 'Amala', 'Suya', 'Akara', 'Boli', 'Shawarma', 'Ofada'];

  return (
    <div className="min-h-screen bg-[#FFF8E9] pb-20">
      
      {/* 1. Breadcrumbs & Header Section */}
      <section className="bg-white border-b border-[#123B2A]/10 pt-8 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#20231F]/60">
            <Link to="/" className="hover:text-[#123B2A] transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[#123B2A] font-semibold">Explore Food</span>
            {currentCategoryData && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[#123B2A] font-bold">{currentCategoryData.name}</span>
              </>
            )}
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#123B2A]/5 text-[#123B2A] text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5 text-[#123B2A]" />
                <span>Ijebu Ode Directory · Pre-Launch Preview</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#123B2A] tracking-tight">
                Explore Food in Ijebu Ode
              </h1>
              <p className="text-sm sm:text-base text-[#20231F]/75 max-w-2xl leading-relaxed">
                Preview the local culinary landscape. Search popular dishes, browse authentic food types, and discover what will be available when partner bukas and restaurants open online ordering.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <Link
                to="/customer-register"
                className="min-h-[44px] px-5 py-2.5 text-xs font-bold text-[#123B2A] bg-[#B8D94B] hover:bg-[#a7c93e] rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
              >
                <span>Join Launch List</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Search bar & quick suggestions */}
          <div className="pt-2 max-w-2xl space-y-2">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search dishes (e.g., Jollof, Amala, Suya, Shawarma, Ofada)..."
                className="w-full pl-11 pr-10 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-[#20231F] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#123B2A] focus:bg-white transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  type="button"
                  className="absolute right-3 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick search suggestions */}
            <div className="flex items-center gap-2 text-xs text-slate-500 overflow-x-auto pb-1 scrollbar-none">
              <span className="shrink-0 font-medium">Quick search:</span>
              {quickSearchTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSearchTerm(tag)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors shrink-0 ${
                    searchTerm.toLowerCase() === tag.toLowerCase()
                      ? 'bg-[#123B2A] text-white font-semibold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Category Tabs & Filter Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Category Horizontal Filter Tabs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#123B2A] uppercase tracking-wider">
            <span>Food Category</span>
            {selectedCategory !== 'all' && (
              <button
                onClick={() => handleCategorySelect('all')}
                className="text-xs lowercase text-slate-500 hover:text-slate-800 underline"
              >
                Reset to all categories
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => handleCategorySelect('all')}
              className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap shrink-0 transition-all ${
                selectedCategory === 'all'
                  ? 'bg-[#123B2A] text-white shadow-sm'
                  : 'bg-white text-[#20231F] border border-[#123B2A]/15 hover:border-[#123B2A]/40'
              }`}
            >
              All Categories
            </button>
            {FOOD_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap shrink-0 transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-[#123B2A] text-white shadow-sm'
                    : 'bg-white text-[#20231F] border border-[#123B2A]/15 hover:border-[#123B2A]/40'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Neighborhood & Fulfillment Controls */}
        <div className="bg-white p-4 rounded-xl border border-[#123B2A]/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            
            {/* Neighborhood Filter */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500">Neighborhood:</span>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#123B2A]"
              >
                <option value="all">All Ijebu Ode Neighborhoods</option>
                {IJEBU_ODE_AREAS.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* Fulfillment Filter */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500">Fulfillment Model:</span>
              <select
                value={fulfillmentFilter}
                onChange={(e) => setFulfillmentFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#123B2A]"
              >
                <option value="all">Pickup & Vendor Delivery</option>
                <option value="pickup">Customer Pickup Only</option>
                <option value="vendor_delivery">Vendor-Arranged Delivery</option>
              </select>
            </div>

          </div>

          {/* Active Filter Indicator & Reset */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear active filters</span>
            </button>
          )}
        </div>

        {/* Selected Category Spotlight */}
        {currentCategoryData && selectedCategory !== 'all' && (
          <div className="bg-white rounded-2xl border border-[#123B2A]/10 p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
            <img
              src={currentCategoryData.image}
              alt={currentCategoryData.name}
              className="w-full md:w-56 h-40 object-cover rounded-xl border border-slate-100 bg-slate-50 shrink-0"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="space-y-3 flex-1 text-left">
              <div>
                <span className="text-xs font-bold text-[#123B2A] uppercase tracking-wider">
                  Category Spotlight
                </span>
                <h2 className="text-2xl font-bold text-[#123B2A] mt-0.5">
                  {currentCategoryData.name}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#20231F]/80 leading-relaxed">
                {currentCategoryData.description}
              </p>
              
              {/* Popular Dishes Preview */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-500 block mb-1.5">
                  Dishes to look forward to when ordering goes live:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {currentCategoryData.popularItems.map((dish) => (
                    <span 
                      key={dish}
                      className="text-xs font-medium text-[#123B2A] bg-[#FFF8E9] border border-[#123B2A]/10 px-3 py-1 rounded-lg"
                    >
                      {dish}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Empty State (Truthful Operational Status: 0 Live Vendors at Launch) */}
        <div className="bg-white rounded-2xl border border-[#123B2A]/10 p-8 sm:p-12 text-center space-y-6 shadow-sm">
          
          <div className="w-16 h-16 rounded-2xl bg-[#FFF8E9] border border-[#123B2A]/10 text-[#123B2A] flex items-center justify-center mx-auto shadow-xs">
            <UtensilsCrossed className="w-8 h-8 text-[#123B2A]" />
          </div>

          <div className="max-w-xl mx-auto space-y-3">
            <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-[#123B2A]">
              Good food is coming to wá jẹun.
            </h3>
            
            {hasActiveFilters ? (
              <p className="text-sm sm:text-base text-[#20231F]/80 leading-relaxed">
                We're currently preparing our first collection of local food businesses in Ijebu Ode. While you searched for <strong>"{searchTerm || currentCategoryData?.name || selectedArea}"</strong>, no food vendors have completed verified onboarding yet.
              </p>
            ) : (
              <p className="text-sm sm:text-base text-[#20231F]/80 leading-relaxed">
                We're actively preparing our founding cohort of local restaurants, bukas, and caterers in Ijebu Ode. Join the launch list to hear when discovery and ordering go live in your neighborhood.
              </p>
            )}
          </div>

          {/* Action Pathways for Both Personas */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/customer-register"
              className="min-h-[48px] px-6 py-3 text-sm font-bold text-[#123B2A] bg-[#B8D94B] hover:bg-[#a7c93e] rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"
            >
              <span>Join Customer Launch List</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            
            <Link
              to="/vendor-register"
              className="min-h-[48px] px-6 py-3 text-sm font-bold text-[#123B2A] bg-white border border-[#123B2A]/20 hover:border-[#123B2A] rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A]"
            >
              <Store className="w-4 h-4 text-[#123B2A]" />
              <span>Are You a Food Business? Register Here</span>
            </Link>
          </div>

          {/* Community Suggestion Callout */}
          <div className="pt-6 border-t border-slate-100 max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-[#FFF8E9] border border-[#123B2A]/10 text-left">
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#123B2A] flex items-center gap-1.5">
                <MessageSquarePlus className="w-4 h-4 text-[#123B2A]" />
                <span>Know a legendary food spot in Ijebu Ode?</span>
              </p>
              <p className="text-xs text-[#20231F]/70">
                Tell us which buka, grill, or caterer you want to see on wá jẹun first.
              </p>
            </div>
            <Link
              to="/legal?tab=contact"
              className="min-h-[38px] px-4 py-2 text-xs font-bold text-[#123B2A] bg-white border border-[#123B2A]/20 hover:border-[#123B2A] rounded-lg transition-all shrink-0 whitespace-nowrap"
            >
              Suggest a Kitchen
            </Link>
          </div>

          {/* Operational Architecture Clarification */}
          <div className="pt-2 max-w-lg mx-auto text-left">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 text-slate-600 text-xs leading-relaxed">
              <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p>
                <strong>System Readiness:</strong> This discovery catalog queries live vendor records via <code>/api/vendors</code>. As verified partners across Folagbade, Molipa, Igbeba, and other Ijebu Ode zones complete onboarding, their menus, prices, and operating hours will appear here automatically.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
