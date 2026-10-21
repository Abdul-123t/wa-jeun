import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Phone, 
  Mail, 
  MapPin, 
  Utensils, 
  ShieldCheck, 
  Loader2,
  Share2
} from 'lucide-react';
import { FOOD_CATEGORIES, IJEBU_ODE_AREAS } from '../data/categories';
import { api } from '../services/api';
import { ContactMethod } from '../types';
import { MARKET_AREAS } from '../data/marketAreas';

interface CustomerRegistrationPageProps {
  onOpenShare?: () => void;
}

export const CustomerRegistrationPage: React.FC<CustomerRegistrationPageProps> = ({ onOpenShare }) => {
  const [name, setName] = useState('');
  const [contactMethod, setContactMethod] = useState<ContactMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [marketArea, setMarketArea] = useState('ijebu-ode');
  const [customNeighborhood, setCustomNeighborhood] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ registrationId?: string; message: string } | null>(null);

  const toggleCategory = (catName: string) => {
    if (selectedCategories.includes(catName)) {
      setSelectedCategories(selectedCategories.filter(c => c !== catName));
    } else {
      setSelectedCategories([...selectedCategories, catName]);
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!name.trim() || name.trim().length < 2) {
      errors.name = 'Please enter your full name (at least 2 letters).';
    }

    if (contactMethod === 'phone') {
      const cleanPhone = phone.trim().replace(/\s+/g, '');
      if (!cleanPhone || cleanPhone.length < 10) {
        errors.phone = 'Please enter a valid Nigerian phone or WhatsApp number.';
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim() || !emailRegex.test(email.trim())) {
        errors.email = 'Please enter a valid email address.';
      }
    }

    const finalNeighborhood = neighborhood === 'Other Neighborhood in Ijebu Ode' ? customNeighborhood : neighborhood;
    if (!finalNeighborhood.trim()) {
      errors.neighborhood = `Please select or enter your area in ${marketArea === 'ijagun' ? 'Ijagun' : 'Ijebu Ode'}.`;
    }

    if (!consentAccepted) {
      errors.consent = 'You must accept the privacy notice to be contacted.';
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

    setIsSubmitting(true);

    const finalNeighborhood = neighborhood === 'Other Neighborhood in Ijebu Ode' 
      ? customNeighborhood.trim() 
      : neighborhood.trim();

    try {
      const res = await api.registerCustomer({
        name: name.trim(),
        contactMethod,
        phone: contactMethod === 'phone' ? phone.trim() : undefined,
        email: contactMethod === 'email' ? email.trim() : undefined,
        neighborhood: finalNeighborhood,
        marketArea,
        favoriteCategories: selectedCategories,
        consentAccepted
      });

      if (res.success) {
        setSuccessData({
          registrationId: res.registrationId,
          message: res.message || 'You have successfully joined the wá jẹun Launch List.'
        });
      } else {
        setApiError(res.error || 'Registration could not be completed. Please try again.');
      }
    } catch (err) {
      setApiError('A connection problem occurred. Please check your network and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success view
  if (successData) {
    return (
      <div className="min-h-screen bg-[#FFF8E9] py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-[#123B2A]/10 shadow-lg p-8 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 bg-[#B8D94B]/20 text-[#123B2A] rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-[#123B2A]" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#123B2A]">
              You're on the launch list!
            </h1>
            <p className="text-sm sm:text-base text-[#20231F]/80 leading-relaxed">
              {successData.message}
            </p>
          </div>

          <div className="bg-[#FFF8E9] p-5 rounded-xl border border-[#123B2A]/10 text-left space-y-2 text-xs sm:text-sm text-[#20231F]/80">
            <div className="font-bold text-[#123B2A] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#123B2A]" />
              <span>Your details</span>
            </div>
            <p className="leading-relaxed">
              Your interest is recorded for <strong>{MARKET_AREAS.find(area => area.id === marketArea)?.label || marketArea}</strong>, in <strong>{neighborhood === 'Other Neighborhood in Ijebu Ode' ? customNeighborhood : neighborhood}</strong>. Your selected contact channel is <strong>{contactMethod === 'phone' ? 'WhatsApp/Phone' : 'Email'}</strong>.
            </p>
            {successData.registrationId && (
              <p className="text-[11px] text-slate-500 pt-2 border-t border-[#123B2A]/10 font-mono">
                Reference ID: {successData.registrationId}
              </p>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {onOpenShare && (
              <button
                type="button"
                onClick={onOpenShare}
                className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 text-xs font-bold text-[#123B2A] bg-[#B8D94B] hover:bg-[#a7c93e] rounded-xl flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Tell Friends in Ijebu Ode and Ijagun</span>
              </button>
            )}
            <Link
              to="/explore"
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 text-xs font-bold text-[#123B2A] bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center gap-1.5"
            >
              <span>Explore Food Preview</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8E9] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Breadcrumb & Context */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#20231F]/60">
          <Link to="/" className="hover:text-[#123B2A] transition-colors">Home</Link>
          <span className="text-slate-400">/</span>
          <span className="text-[#123B2A] font-semibold">Ordering Updates</span>
        </nav>

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#123B2A]/5 text-[#123B2A] text-xs font-semibold">
            <MapPin className="w-3.5 h-3.5 text-[#123B2A]" />
            <span>Ordering Updates · Ijebu Ode & Ijagun</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#123B2A] tracking-tight">
            Get notified when ordering opens.
          </h1>

          <p className="text-sm sm:text-base text-[#20231F]/80 max-w-lg mx-auto leading-relaxed">
            Sign up for launch updates. We’ll contact you when food discovery and ordering are available in your selected area. No account is required.
          </p>
          <p className="text-sm text-[#20231F]/65">
            No account needed. <Link to="/auth?mode=signup" className="font-semibold text-[#123B2A] underline underline-offset-2">Create an account</Link> or <Link to="/auth?mode=signin" className="font-semibold text-[#123B2A] underline underline-offset-2">sign in</Link> to use the marketplace.
          </p>
        </div>

        {/* Registration Card */}
        <div className="bg-white rounded-2xl border border-[#123B2A]/10 shadow-sm p-6 sm:p-10 space-y-6">
          
          {apiError && (
            <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs sm:text-sm text-red-800">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Submission Failed</p>
                <p>{apiError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            
            {/* 1. Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="customer-name" className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="customer-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Oluwaseun Adeleke"
                className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A] focus:bg-white transition-all ${
                  fieldErrors.name ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                }`}
              />
              {fieldErrors.name && (
                <p role="alert" className="text-xs text-red-600 font-medium">{fieldErrors.name}</p>
              )}
            </div>

            {/* 2. Contact Method Choice */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                Preferred Contact Channel <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setContactMethod('phone')}
                  className={`min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    contactMethod === 'phone'
                      ? 'bg-[#123B2A] text-white border-[#123B2A]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  <span>WhatsApp / Phone</span>
                </button>

                <button
                  type="button"
                  onClick={() => setContactMethod('email')}
                  className={`min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    contactMethod === 'email'
                      ? 'bg-[#123B2A] text-white border-[#123B2A]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>Email Address</span>
                </button>
              </div>
            </div>

            {/* 3. Phone or Email Input */}
            {contactMethod === 'phone' ? (
              <div className="space-y-1.5">
                <label htmlFor="customer-phone" className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                  WhatsApp or Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0803 123 4567 or +234 803 123 4567"
                  className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A] focus:bg-white transition-all ${
                    fieldErrors.phone ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                  }`}
                />
                <p className="text-[11px] text-slate-500">
                  We’ll only message you about the wá jẹun rollout in your selected area.
                </p>
                {fieldErrors.phone && (
                  <p role="alert" className="text-xs text-red-600 font-medium">{fieldErrors.phone}</p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <label htmlFor="customer-email" className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="customer-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. seun@example.com"
                  className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A] focus:bg-white transition-all ${
                    fieldErrors.email ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.email && (
                  <p role="alert" className="text-xs text-red-600 font-medium">{fieldErrors.email}</p>
                )}
              </div>
            )}

            {/* 4. Market area and local neighborhood */}
            <div className="space-y-1.5">
              <label htmlFor="customer-market-area" className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">Market area <span className="text-red-500">*</span></label>
              <select id="customer-market-area" value={marketArea} onChange={event => { setMarketArea(event.target.value); setNeighborhood(''); setCustomNeighborhood(''); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#20231F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#123B2A]">
                {MARKET_AREAS.map(area => <option key={area.id} value={area.id}>{area.label}</option>)}
              </select>
              {marketArea === 'ijebu-ode' ? <>
                <label htmlFor="customer-area" className="mt-3 block text-xs font-bold uppercase tracking-wider text-[#123B2A]">Neighborhood in Ijebu Ode <span className="text-red-500">*</span></label>
                <select id="customer-area" value={neighborhood} onChange={event => setNeighborhood(event.target.value)} className={`w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm text-[#20231F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#123B2A] ${fieldErrors.neighborhood ? 'border-red-400 bg-red-50/50' : 'border-slate-200'}`}>
                  <option value="">Select your area...</option>{IJEBU_ODE_AREAS.map(area => <option key={area} value={area}>{area}</option>)}
                </select>
                {neighborhood === 'Other Neighborhood in Ijebu Ode' && <input type="text" value={customNeighborhood} onChange={event => setCustomNeighborhood(event.target.value)} placeholder="Specify your neighborhood in Ijebu Ode" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A]" />}
              </> : <>
                <label htmlFor="customer-ijagun-neighborhood" className="mt-3 block text-xs font-bold uppercase tracking-wider text-[#123B2A]">Neighborhood or locality in Ijagun <span className="text-red-500">*</span></label>
                <input id="customer-ijagun-neighborhood" type="text" maxLength={150} value={neighborhood} onChange={event => setNeighborhood(event.target.value)} placeholder="Enter your neighborhood in Ijagun" className={`w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm text-[#20231F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#123B2A] ${fieldErrors.neighborhood ? 'border-red-400 bg-red-50/50' : 'border-slate-200'}`} />
              </>}
              {fieldErrors.neighborhood && <p role="alert" className="text-xs font-medium text-red-600">{fieldErrors.neighborhood}</p>}
            </div>

            {/* 5. Optional Favorite Food Categories */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                Food Categories You Love (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {FOOD_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.name);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.name)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-[#123B2A] text-white border-[#123B2A]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6. Consent Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-[#123B2A] focus:ring-[#123B2A] border-slate-300"
                />
                <span className="text-xs text-[#20231F]/80 leading-relaxed">
                  I agree to wá jẹun's{' '}
                  <Link to="/legal?tab=privacy" target="_blank" className="font-semibold text-[#123B2A] underline">
                    Privacy Notice
                  </Link>{' '}
                  and consent to being contacted about the wá jẹun launch in Ijebu Ode or Ijagun.
                </span>
              </label>
              {fieldErrors.consent && (
                <p role="alert" className="text-xs text-red-600 font-medium mt-1">{fieldErrors.consent}</p>
              )}
            </div>

            {/* 7. Submit Action */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-6 py-3.5 text-base font-bold text-[#123B2A] bg-[#B8D94B] hover:bg-[#a7c93e] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Recording Your Early Access...</span>
                  </>
                ) : (
                  <>
                    <span>Notify Me When Ordering Opens</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <p className="text-[11px] text-slate-500">
                🔒 We will never spam or sell your information. No password required.
              </p>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
};
