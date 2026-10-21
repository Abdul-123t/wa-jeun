import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Store, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Loader2, 
  Info
} from 'lucide-react';
import { IJEBU_ODE_AREAS } from '../data/categories';
import { api } from '../services/api';
import { BusinessType, FulfillmentOption, OrderingMethod } from '../types';
import { useAuth } from '../auth/AuthContext';
import { MARKET_AREAS } from '../data/marketAreas';

export const VendorRegistrationPage: React.FC = () => {
  const { user, session, loading: authLoading, retryPermissionCheck } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [marketArea, setMarketArea] = useState('ijebu-ode');
  const [customNeighborhood, setCustomNeighborhood] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [nearbyLandmark, setNearbyLandmark] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('local_buka');
  const [currentOrderingMethods, setCurrentOrderingMethods] = useState<OrderingMethod[]>(['walk_in']);
  const [fulfillmentOptions, setFulfillmentOptions] = useState<FulfillmentOption>('pickup_only');
  const [deliveryCoverage, setDeliveryCoverage] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ registrationId?: string; message: string } | null>(null);

  const toggleOrderingMethod = (method: OrderingMethod) => {
    if (currentOrderingMethods.includes(method)) {
      if (currentOrderingMethods.length > 1) {
        setCurrentOrderingMethods(currentOrderingMethods.filter(m => m !== method));
      }
    } else {
      setCurrentOrderingMethods([...currentOrderingMethods, method]);
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!businessName.trim() || businessName.trim().length < 2) {
      errors.businessName = 'Please enter your food business or buka name.';
    }

    if (!contactName.trim() || contactName.trim().length < 2) {
      errors.contactName = 'Please enter the owner or manager name.';
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.phone = 'Please enter a valid WhatsApp or phone number for the business.';
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = 'Please provide a valid email format or leave blank.';
      }
    }

    const finalNeighborhood = marketArea === 'ijebu-ode' && neighborhood === 'Other Neighborhood in Ijebu Ode' ? customNeighborhood : neighborhood;
    if (finalNeighborhood.trim().length < 2) errors.neighborhood = `Please enter the neighborhood or locality in ${marketArea === 'ijagun' ? 'Ijagun' : 'Ijebu Ode'}.`;
    if (streetAddress.trim().length < 3) errors.streetAddress = 'Enter the business street or address.';
    if (nearbyLandmark.trim().length < 2) errors.nearbyLandmark = 'Enter a nearby landmark.';
    if (['vendor_delivery', 'pickup_and_delivery'].includes(fulfillmentOptions) && deliveryCoverage.length === 0) errors.deliveryCoverage = 'Select the areas your business actually delivers to.';

    if (!consentAccepted) {
      errors.consent = 'Consent is required so our team can contact you.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) {
      return;
    }
    if (!session?.access_token) {
      setApiError('Sign in or create an account before submitting. Your application must be linked to your verified account.');
      return;
    }

    setIsSubmitting(true);
    const finalNeighborhood = marketArea === 'ijebu-ode' && neighborhood === 'Other Neighborhood in Ijebu Ode'
      ? customNeighborhood.trim() 
      : neighborhood.trim();

    try {
      const res = await api.registerVendor({
        businessName: businessName.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        neighborhood: finalNeighborhood,
        marketArea,
        streetAddress: streetAddress.trim(),
        nearbyLandmark: nearbyLandmark.trim(),
        deliveryCoverage,
        businessType,
        currentOrderingMethods,
        fulfillmentOptions,
        message: message.trim() || undefined,
        consentAccepted
      }, session.access_token);

      if (res.success) {
        retryPermissionCheck();
        setSuccessData({
          registrationId: res.registrationId,
          message: res.message || 'Your business interest has been recorded.'
        });
      } else {
        setApiError(res.error || 'Failed to submit registration. Please check your inputs.');
      }
    } catch (err) {
      setApiError('Unable to connect to the server. Please check your network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successData) {
    return (
      <div className="min-h-screen bg-[#FFF8E9] py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-[#123B2A]/10 shadow-lg p-8 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 bg-[#B8D94B]/20 text-[#123B2A] rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-[#123B2A]" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#123B2A]">
              Application Received
            </h1>
            <p className="text-sm sm:text-base text-[#20231F]/80 leading-relaxed">
              {successData.message}
            </p>
          </div>

          <div className="bg-[#FFF8E9] p-5 rounded-xl border border-[#123B2A]/10 text-left space-y-2 text-xs sm:text-sm text-[#20231F]/80">
            <div className="font-bold text-[#123B2A] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#123B2A]" />
              <span>Application details</span>
            </div>
            <p className="leading-relaxed">
              We received the application for <strong>{businessName}</strong>. It will be reviewed; submission is not approval, and the storefront cannot accept orders until approved and set up.
            </p>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-[#123B2A]/10">
              Note: This registration expresses interest and does not yet constitute commercial approval or a binding contract.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {user && <Link
              to="/account"
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 text-xs font-bold text-[#123B2A] bg-[#B8D94B] hover:bg-[#a7c93e] rounded-xl flex items-center justify-center"
            >Check application status</Link>}
            <Link
              to="/"
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 text-xs font-bold text-[#123B2A] bg-[#B8D94B] hover:bg-[#a7c93e] rounded-xl flex items-center justify-center gap-1.5"
            >
              <span>Return to Home</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/about"
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 text-xs font-bold text-[#123B2A] bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center"
            >
              Learn More About wá jẹun
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8E9] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Breadcrumb & Context */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#20231F]/60">
          <Link to="/" className="hover:text-[#123B2A] transition-colors">Home</Link>
          <span className="text-slate-400">/</span>
          <span className="text-[#123B2A] font-semibold">For Food Businesses</span>
        </nav>

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#123B2A]/5 text-[#123B2A] text-xs font-semibold">
            <Store className="w-3.5 h-3.5 text-[#123B2A]" />
            <span>Built in Ijebu. Made for Ijebu.</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#123B2A] tracking-tight">
            Bring your food business to <span className="lowercase">wá jẹun</span>.
          </h1>

          <p className="text-sm sm:text-base text-[#20231F]/80 max-w-xl mx-auto leading-relaxed">
            Apply to create your business profile. Our team reviews each application before a storefront can accept orders.
          </p>
          {authLoading ? (
            <p role="status" className="mx-auto max-w-xl text-sm text-[#20231F]/60">Restoring your account session…</p>
          ) : user ? (
            <p className="mx-auto max-w-xl rounded-xl border border-[#123B2A]/10 bg-white px-4 py-3 text-sm text-[#123B2A]">You’re signed in. This application will be linked to your account so you can check its status.</p>
          ) : (
            <p className="mx-auto max-w-xl text-sm text-[#20231F]/65">
              Sign in or <Link to="/auth?mode=signup" className="font-semibold text-[#123B2A] underline underline-offset-2">create an account</Link> to apply. Applications are linked to the signed-in account for secure status tracking and business management. <Link to="/auth?mode=signin" className="font-semibold text-[#123B2A] underline underline-offset-2">Sign in</Link>
            </p>
          )}
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl border border-[#123B2A]/10 shadow-sm p-6 sm:p-10 space-y-6">
          
          {/* Honest Notice */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/60 flex items-start gap-3 text-xs text-amber-900">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Transparent Onboarding:</strong> Submitting this form is an expression of interest to join our first vendor cohort in Ijebu Ode and Ijagun. It does not commit you to any fees or binding commercial contracts.
            </p>
          </div>

          {apiError && (
            <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs sm:text-sm text-red-800">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Submission Notice</p>
                <p>{apiError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            
            {/* 1. Business Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              <div className="space-y-1.5">
                <label htmlFor="vendor-biz-name" className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                  Business or Buka Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="vendor-biz-name"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Mama Funke Buka & Kitchen"
                  className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A] focus:bg-white transition-all ${
                    fieldErrors.businessName ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.businessName && (
                  <p role="alert" className="text-xs text-red-600 font-medium">{fieldErrors.businessName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="vendor-contact-name" className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                  Owner or Manager Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="vendor-contact-name"
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Mrs. Funke Adebowale"
                  className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A] focus:bg-white transition-all ${
                    fieldErrors.contactName ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.contactName && (
                  <p role="alert" className="text-xs text-red-600 font-medium">{fieldErrors.contactName}</p>
                )}
              </div>

            </div>

            {/* 2. Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              <div className="space-y-1.5">
                <label htmlFor="vendor-phone" className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                  WhatsApp / Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="vendor-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0802 345 6789"
                  className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A] focus:bg-white transition-all ${
                    fieldErrors.phone ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.phone && (
                  <p role="alert" className="text-xs text-red-600 font-medium">{fieldErrors.phone}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="vendor-email" className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                  Email Address (Optional)
                </label>
                <input
                  id="vendor-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. contact@mamabuka.com"
                  className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A] focus:bg-white transition-all ${
                    fieldErrors.email ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.email && (
                  <p role="alert" className="text-xs text-red-600 font-medium">{fieldErrors.email}</p>
                )}
              </div>

            </div>

            {/* 3. Business location */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#123B2A]">Business location</h2>
              <label htmlFor="vendor-market-area" className="block text-xs font-semibold text-[#123B2A]">Market area <span className="text-red-500">*</span>
                <select id="vendor-market-area" value={marketArea} onChange={event => { setMarketArea(event.target.value); setNeighborhood(''); setCustomNeighborhood(''); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-[#20231F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#123B2A]">
                  {MARKET_AREAS.map(area => <option key={area.id} value={area.id}>{area.label}</option>)}
                </select>
              </label>
              {marketArea === 'ijebu-ode' ? <label htmlFor="vendor-location" className="block text-xs font-semibold text-[#123B2A]">Neighborhood <span className="text-red-500">*</span>
                <select id="vendor-location" value={neighborhood} onChange={event => setNeighborhood(event.target.value)} className={`mt-1 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm font-normal text-[#20231F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#123B2A] ${fieldErrors.neighborhood ? 'border-red-400' : 'border-slate-200'}`}>
                  <option value="">Select neighborhood...</option>{IJEBU_ODE_AREAS.map(area => <option key={area} value={area}>{area}</option>)}
                </select>
              </label> : <label htmlFor="vendor-location-ijagun" className="block text-xs font-semibold text-[#123B2A]">Neighborhood or locality in Ijagun <span className="text-red-500">*</span>
                <input id="vendor-location-ijagun" value={neighborhood} onChange={event => setNeighborhood(event.target.value)} maxLength={150} placeholder="e.g. around TASFUED" className={`mt-1 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm font-normal text-[#20231F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#123B2A] ${fieldErrors.neighborhood ? 'border-red-400' : 'border-slate-200'}`} />
              </label>}
              {marketArea === 'ijebu-ode' && neighborhood === 'Other Neighborhood in Ijebu Ode' && <input type="text" value={customNeighborhood} onChange={event => setCustomNeighborhood(event.target.value)} placeholder="Type your neighborhood name in Ijebu Ode" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A]" />}
              {fieldErrors.neighborhood && <p role="alert" className="text-xs font-medium text-red-600">{fieldErrors.neighborhood}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label htmlFor="vendor-street" className="block text-xs font-semibold text-[#123B2A]">Street or business address <span className="text-red-500">*</span><input id="vendor-street" value={streetAddress} onChange={event => setStreetAddress(event.target.value)} maxLength={250} placeholder="Street, road, or building address" className={`mt-1 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm font-normal text-[#20231F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#123B2A] ${fieldErrors.streetAddress ? 'border-red-400' : 'border-slate-200'}`} />{fieldErrors.streetAddress && <span role="alert" className="mt-1 block text-red-600">{fieldErrors.streetAddress}</span>}</label>
                <label htmlFor="vendor-landmark" className="block text-xs font-semibold text-[#123B2A]">Nearby landmark <span className="text-red-500">*</span><input id="vendor-landmark" value={nearbyLandmark} onChange={event => setNearbyLandmark(event.target.value)} maxLength={250} placeholder="A real nearby school, junction, or landmark" className={`mt-1 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm font-normal text-[#20231F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#123B2A] ${fieldErrors.nearbyLandmark ? 'border-red-400' : 'border-slate-200'}`} />{fieldErrors.nearbyLandmark && <span role="alert" className="mt-1 block text-red-600">{fieldErrors.nearbyLandmark}</span>}</label>
              </div>
            </div>

            {/* 4. Business Type */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                Business Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { value: 'local_buka', label: 'Local Buka / Canteen' },
                  { value: 'restaurant', label: 'Restaurant / Eatery' },
                  { value: 'fast_food', label: 'Fast Food' },
                  { value: 'grill_shawarma', label: 'Grill / Shawarma / Suya' },
                  { value: 'bakery_snacks', label: 'Bakery / Pastries' },
                  { value: 'other', label: 'Other Food Business' }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setBusinessType(item.value as BusinessType)}
                    className={`min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                      businessType === item.value
                        ? 'bg-[#123B2A] text-white border-[#123B2A] shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. How Orders Are Currently Received */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                How do you currently take orders? (Select all that apply)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'walk_in', label: 'Walk-in Customers' },
                  { id: 'phone_calls', label: 'Phone Calls' },
                  { id: 'whatsapp', label: 'WhatsApp' },
                  { id: 'existing_delivery', label: 'Existing Delivery' },
                  { id: 'other', label: 'Other Channels' }
                ].map((item) => {
                  const isChecked = currentOrderingMethods.includes(item.id as OrderingMethod);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleOrderingMethod(item.id as OrderingMethod)}
                      className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl border flex items-center justify-between transition-all ${
                        isChecked
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{item.label}</span>
                      {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6. Fulfillment Capability */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                Current Fulfillment Options <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { 
                    id: 'pickup_only', 
                    title: 'Customer Pickup Only', 
                    desc: 'Customers come to your buka or store to pick up packed orders.' 
                  },
                  { 
                    id: 'vendor_delivery', 
                    title: 'Our Business Delivers', 
                    desc: 'We have our own delivery arrangement to bring food to customers.' 
                  },
                  { 
                    id: 'pickup_and_delivery', 
                    title: 'Both Pickup and Delivery', 
                    desc: 'We support in-store pickup and also provide delivery.' 
                  },
                  { 
                    id: 'delivery_varies', 
                    title: 'Delivery Availability Varies', 
                    desc: 'We deliver on certain days or for large bulk orders.' 
                  }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFulfillmentOptions(item.id as FulfillmentOption)}
                    className={`min-h-[56px] p-3 rounded-xl border text-left transition-all ${
                      fulfillmentOptions === item.id
                        ? 'bg-[#123B2A] text-white border-[#123B2A]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <p className="text-xs font-bold">{item.title}</p>
                    <p className={`text-[11px] mt-0.5 leading-snug ${fulfillmentOptions === item.id ? 'text-white/80' : 'text-slate-500'}`}>
                      {item.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {['vendor_delivery', 'pickup_and_delivery'].includes(fulfillmentOptions) && <fieldset className="space-y-2 rounded-xl border border-[#123B2A]/10 bg-[#FFF8E9]/60 p-4">
              <legend className="px-1 text-xs font-bold uppercase tracking-wider text-[#123B2A]">Areas your business actually delivers to <span className="text-red-500">*</span></legend>
              <p className="text-xs leading-5 text-[#20231F]/65">Select only areas your own delivery service currently covers. This information will be shown to customers.</p>
              <div className="flex flex-wrap gap-3">{MARKET_AREAS.map(area => <label key={area.id} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-medium text-[#20231F]"><input type="checkbox" checked={deliveryCoverage.includes(area.id)} onChange={event => setDeliveryCoverage(current => event.target.checked ? [...current, area.id] : current.filter(value => value !== area.id))} />{area.label}</label>)}</div>
              {fieldErrors.deliveryCoverage && <p role="alert" className="text-xs font-medium text-red-600">{fieldErrors.deliveryCoverage}</p>}
            </fieldset>}

            {/* 7. Message / Signature Dishes */}
            <div className="space-y-1.5">
              <label htmlFor="vendor-message" className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                Tell Us About Your Food or Signature Dishes (Optional)
              </label>
              <textarea
                id="vendor-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Known for rich amala with fresh ewedu and goat meat, or party jollof and peppered snail..."
                className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A] focus:bg-white transition-all"
              />
            </div>

            {/* 8. Consent */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-[#123B2A] focus:ring-[#123B2A] border-slate-300"
                />
                <span className="text-xs text-[#20231F]/80 leading-relaxed">
                  I consent to wá jẹun contacting me regarding food business onboarding and accept the{' '}
                  <Link to="/legal?tab=privacy" target="_blank" className="font-semibold text-[#123B2A] underline">
                    Privacy Notice
                  </Link>.
                </span>
              </label>
              {fieldErrors.consent && (
                <p role="alert" className="text-xs text-red-600 font-medium mt-1">{fieldErrors.consent}</p>
              )}
            </div>

            {/* 9. Submit button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting || authLoading || !session?.access_token}
                className="w-full min-h-[48px] px-6 py-3.5 text-base font-bold text-[#123B2A] bg-[#B8D94B] hover:bg-[#a7c93e] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Registering Food Business Interest...</span>
                  </>
                ) : (
                  <>
                    <span>{authLoading ? 'Restoring account…' : !session?.access_token ? 'Sign in to submit application' : 'Submit vendor application'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </form>

        </div>

        <p className="rounded-xl border border-[#123B2A]/10 bg-white p-4 text-sm leading-6 text-[#20231F]/75">
          After you apply, the team will review your business. Approval is required before your storefront can accept orders.
        </p>

      </div>
    </div>
  );
};
