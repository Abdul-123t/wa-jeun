import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  FileText, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  Info
} from 'lucide-react';
import { api } from '../services/api';

export const LegalPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'privacy';

  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'contact'>(
    (currentTab as any) || 'privacy'
  );

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [contactSubject, setContactSubject] = useState('General Inquiry');
  const [contactMessage, setContactMessage] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['privacy', 'terms', 'contact'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const switchTab = (tab: 'privacy' | 'terms' | 'contact') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!contactName.trim() || contactName.trim().length < 2) {
      setSubmitError('Please enter your name.');
      return;
    }
    if (!contactInfo.trim() || contactInfo.trim().length < 5) {
      setSubmitError('Please enter your phone number or email address.');
      return;
    }
    if (!contactMessage.trim() || contactMessage.trim().length < 10) {
      setSubmitError('Please enter a message (at least 10 characters).');
      return;
    }
    if (!consentAccepted) {
      setSubmitError('Please confirm consent to be contacted.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.submitContact({
        name: contactName.trim(),
        contactInfo: contactInfo.trim(),
        subject: contactSubject,
        message: contactMessage.trim(),
        consentAccepted
      });

      if (res.success) {
        setSubmitSuccess(res.message || 'Your inquiry has been successfully submitted. We will get in touch shortly.');
        setContactName('');
        setContactInfo('');
        setContactMessage('');
        setConsentAccepted(false);
      } else {
        setSubmitError(res.error || 'Failed to submit inquiry. Please try again.');
      }
    } catch (err) {
      setSubmitError('Connection error. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8E9] pb-20">
      
      {/* Header */}
      <section className="bg-white border-b border-[#123B2A]/10 pt-8 pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3 text-center">
          
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center justify-center gap-1.5 text-xs text-[#20231F]/60 pb-1">
            <Link to="/" className="hover:text-[#123B2A] transition-colors">Home</Link>
            <span className="text-slate-400">/</span>
            <span className="text-[#123B2A] font-semibold">Legal & Contact</span>
          </nav>

          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#123B2A]">
            Legal Information & Contact
          </h1>
          <p className="text-sm text-[#20231F]/75 max-w-xl mx-auto">
            Review our data privacy commitment, pre-launch terms of use, or submit an inquiry to the wá jẹun team.
          </p>

          {/* Navigation Tabs */}
          <div className="pt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => switchTab('privacy')}
              className={`min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'privacy'
                  ? 'bg-[#123B2A] text-white shadow-sm'
                  : 'bg-slate-100 text-[#20231F] hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Privacy Policy</span>
            </button>

            <button
              onClick={() => switchTab('terms')}
              className={`min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'terms'
                  ? 'bg-[#123B2A] text-white shadow-sm'
                  : 'bg-slate-100 text-[#20231F] hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Terms of Use</span>
            </button>

            <button
              onClick={() => switchTab('contact')}
              className={`min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'contact'
                  ? 'bg-[#123B2A] text-white shadow-sm'
                  : 'bg-slate-100 text-[#20231F] hover:bg-slate-200'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Contact Us</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        
        {/* Tab 1: Privacy Policy */}
        {activeTab === 'privacy' && (
          <div className="bg-white rounded-2xl border border-[#123B2A]/10 p-6 sm:p-10 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs font-bold text-[#123B2A] uppercase tracking-wider">
                Privacy Notice
              </span>
              <h2 className="font-display text-2xl font-bold text-[#123B2A] mt-1">
                wá jẹun Privacy Policy
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Effective: October 2026 · Market: Ijebu Ode, Ogun State, Nigeria
              </p>
            </div>

            <div className="space-y-6 text-sm text-[#20231F]/80 leading-relaxed">
              <section className="space-y-2">
                <h3 className="font-bold text-[#123B2A] text-base">
                  1. Information We Collect
                </h3>
                <p>
                  During our pre-launch phase, wá jẹun collects only information voluntarily submitted through our Customer Early Access, Food Business Onboarding Interest, or Contact forms:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li><strong>Customer Launch List:</strong> Full name, contact channel (WhatsApp/Phone or Email), neighborhood in Ijebu Ode, and optional food preferences.</li>
                  <li><strong>Food Business Applications:</strong> Business/buka name, manager/contact name, business phone/WhatsApp, business location/neighborhood, business category, current ordering channels, and fulfillment arrangements.</li>
                  <li><strong>General Inquiries:</strong> Name, contact detail, and inquiry text.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="font-bold text-[#123B2A] text-base">
                  2. Purpose of Collection
                </h3>
                <p>
                  We process this information strictly to:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li>Notify customers when food discovery and ordering become available in their specific neighborhood.</li>
                  <li>Review food business expressions of interest and coordinate onboarding discussions.</li>
                  <li>Answer user inquiries regarding the platform.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="font-bold text-[#123B2A] text-base">
                  3. Storage, Security & Access Control
                </h3>
                <p>
                  Your information is stored in persistent backend storage protected by strict access controls. Private contact details are never exposed to the public web or returned in public directory search queries. We do not sell or rent personal information to advertisers.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-bold text-[#123B2A] text-base">
                  4. Your Rights & Data Requests
                </h3>
                <p>
                  You may at any time request to review, update, or permanently delete your contact information from our launch list by reaching out to us through our Contact form or via our communication channels.
                </p>
              </section>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <strong>Legal Review Note:</strong> This policy reflects the operational reality of wá jẹun's pre-launch phase. Prior to full public commercial ordering, it will undergo formal legal compliance review in accordance with Nigerian Data Protection Act (NDPA) regulations.
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Terms of Use */}
        {activeTab === 'terms' && (
          <div className="bg-white rounded-2xl border border-[#123B2A]/10 p-6 sm:p-10 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs font-bold text-[#123B2A] uppercase tracking-wider">
                Platform Terms
              </span>
              <h2 className="font-display text-2xl font-bold text-[#123B2A] mt-1">
                Pre-Launch Terms of Use
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Effective: October 2026 · wá jẹun Marketplace
              </p>
            </div>

            <div className="space-y-6 text-sm text-[#20231F]/80 leading-relaxed">
              <section className="space-y-2">
                <h3 className="font-bold text-[#123B2A] text-base">
                  1. Pre-Launch Nature of Service
                </h3>
                <p>
                  wá jẹun is currently operating as a pre-launch technology preview and onboarding portal. Food discovery, live shopping carts, online payment processing, and order dispatches are currently inactive and will be rolled out as participating vendors complete onboarding.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-bold text-[#123B2A] text-base">
                  2. Vendor Expressions of Interest
                </h3>
                <p>
                  Submitting a Food Business Onboarding Interest form constitutes an expression of interest to explore partnering with wá jẹun. It does not create a binding commercial contract, guarantee platform listing, or commit the applicant or wá jẹun to any monetary obligation.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-bold text-[#123B2A] text-base">
                  3. Fulfillment Model
                </h3>
                <p>
                  At initial rollout, food orders will be fulfilled through either customer pickup at the vendor's premises or delivery arranged directly by the vendor. wá jẹun does not operate motorbikes or employ dispatch riders.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-bold text-[#123B2A] text-base">
                  4. Accuracy of Information
                </h3>
                <p>
                  Users agree to provide truthful contact information when registering on our launch list or submitting business applications.
                </p>
              </section>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <strong>Legal Review Note:</strong> Comprehensive commercial terms of service covering vendor commissions, payment settlement, and food safety standards will be published prior to the initiation of financial transactions.
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Contact Form */}
        {activeTab === 'contact' && (
          <div className="bg-white rounded-2xl border border-[#123B2A]/10 p-6 sm:p-10 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs font-bold text-[#123B2A] uppercase tracking-wider">
                Get in Touch
              </span>
              <h2 className="font-display text-2xl font-bold text-[#123B2A] mt-1">
                Contact the wá jẹun Team
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Have questions about our launch in Ijebu Ode, vendor onboarding, or partnerships?
              </p>
            </div>

            {submitSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs sm:text-sm text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Message Delivered</p>
                  <p>{submitSuccess}</p>
                </div>
              </div>
            )}

            {submitError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs sm:text-sm text-red-800">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Notice</p>
                  <p>{submitError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleContactSubmit} className="space-y-5" noValidate>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Babatunde O."
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                    Phone Number or Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="e.g. 08031234567 or email@domain.com"
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                  Subject
                </label>
                <select
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A]"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Food Business Onboarding Question">Food Business Onboarding Question</option>
                  <option value="Customer Launch List Question">Customer Launch List Question</option>
                  <option value="Data Privacy or Removal Request">Data Privacy or Removal Request</option>
                  <option value="Partnership / Press">Partnership / Press</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="How can we assist you?"
                  className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-[#20231F] focus:outline-none focus:ring-2 focus:ring-[#123B2A]"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#123B2A] focus:ring-[#123B2A] border-slate-300"
                  />
                  <span className="text-xs text-[#20231F]/80 leading-relaxed">
                    I agree to wá jẹun contacting me in response to this inquiry.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto min-h-[48px] px-8 py-3 text-sm font-bold text-[#123B2A] bg-[#B8D94B] hover:bg-[#a7c93e] disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Message...</span>
                  </>
                ) : (
                  <>
                    <span>Send Message</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
              <p>
                <strong>Truthful Operations Notice:</strong> wá jẹun does not publish fabricated physical headquarters addresses or unmonitored call center phone numbers. All communication is directly handled and tracked via our verified contact channels.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
