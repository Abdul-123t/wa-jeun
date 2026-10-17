/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ShareModal } from './components/ShareModal';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { CustomerRegistrationPage } from './pages/CustomerRegistrationPage';
import { VendorRegistrationPage } from './pages/VendorRegistrationPage';
import { AboutPage } from './pages/AboutPage';
import { LegalPage } from './pages/LegalPage';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AuthPage } from './pages/AuthPage';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { VendorDashboardPage } from './pages/VendorDashboardPage';
import { PublicVendorMenuPage } from './pages/PublicVendorMenuPage';
import { CartProvider } from './services/CartContext';
import { CartPage } from './pages/CartPage';
import { CustomerOrdersPage } from './pages/CustomerOrdersPage';
import { getAdminAccessViewState } from './auth/authRules';

// Scroll to top helper on route change with smooth hash navigation
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      // Delay slightly to ensure destination DOM elements are fully mounted
      const timer = setTimeout(() => {
        const element = document.getElementById(hash.replace('#', ''));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pathname, hash]);

  return null;
}

function RouteMetadata() {
  const location = useLocation();

  useEffect(() => {
    const mode = new URLSearchParams(location.search).get('mode');
    const tab = new URLSearchParams(location.search).get('tab');
    const privatePath = ['/account', '/vendor', '/admin', '/cart', '/orders'].some(path => location.pathname === path || location.pathname.startsWith(`${path}/`));
    let title = 'wá jẹun — Your City. Your Food. | Ijebu Ode Food Marketplace';
    let description = 'Discover food around Ijebu Ode with wá jẹun. Connect with local food businesses, explore authentic Nigerian meals, and join the launch list.';

    if (location.pathname === '/explore') {
      title = 'Explore Local Food | wá jẹun';
      description = 'Explore verified local food businesses and authentic Nigerian menus in Ijebu Ode with wá jẹun.';
    } else if (location.pathname === '/customer-register') {
      title = 'Join the Customer Launch List | wá jẹun';
      description = 'Join the wá jẹun customer launch list for updates on local food discovery and ordering in Ijebu Ode.';
    } else if (location.pathname === '/vendor-register') {
      title = 'Register Your Food Business | wá jẹun';
      description = 'Register your restaurant, buka, grill, bakery, or food business in Ijebu Ode with wá jẹun.';
    } else if (location.pathname === '/about') {
      title = 'About wá jẹun | Local Food in Ijebu Ode';
      description = 'Learn about wá jẹun and our work connecting Ijebu Ode food lovers with local food businesses.';
    } else if (location.pathname === '/legal') {
      title = tab === 'contact' ? 'Contact wá jẹun' : tab === 'privacy' ? 'Privacy | wá jẹun' : tab === 'terms' ? 'Terms | wá jẹun' : 'Help and Information | wá jẹun';
      description = tab === 'contact' ? 'Contact the wá jẹun team in Ijebu Ode.' : 'Read wá jẹun policies and important marketplace information.';
    } else if (location.pathname === '/auth') {
      title = mode === 'signup' ? 'Create an Account | wá jẹun' : mode === 'reset' ? 'Reset Password | wá jẹun' : mode === 'recovery' ? 'Choose a New Password | wá jẹun' : 'Sign In | wá jẹun';
      description = 'Securely access your wá jẹun account.';
    } else if (location.pathname.startsWith('/vendors/')) {
      title = 'Local Food Menu | wá jẹun';
      description = 'Explore an approved local food business menu on wá jẹun.';
    } else if (privatePath) {
      title = 'Private Workspace | wá jẹun';
      description = 'A private, sign-in protected wá jẹun workspace.';
    }

    document.title = title;
    const updateMeta = (selector: string, attribute: string, value: string) => {
      const element = document.head.querySelector<HTMLMetaElement>(selector);
      if (element) element.setAttribute(attribute, value);
    };
    updateMeta('meta[name="description"]', 'content', description);
    updateMeta('meta[property="og:title"]', 'content', title);
    updateMeta('meta[property="og:description"]', 'content', description);
    updateMeta('meta[property="og:url"]', 'content', `https://wajeun.ng${location.pathname}${location.search}`);
    updateMeta('meta[name="twitter:title"]', 'content', title);
    updateMeta('meta[name="twitter:description"]', 'content', description);
    updateMeta('meta[name="robots"]', 'content', privatePath ? 'noindex, nofollow' : 'index, follow');
  }, [location.pathname, location.search]);

  return null;
}

function AdminRoute() {
  const { user, adminUserId, permissionsLoading, adminPermissionError, retryPermissionCheck } = useAuth();
  const accessState = getAdminAccessViewState({ permissionsLoading, userId: user?.id, adminUserId, error: adminPermissionError });
  if (accessState === 'loading') return <main className="flex min-h-[60vh] items-center justify-center text-sm text-[#123B2A]/70" role="status">Verifying administrator access…</main>;
  if (accessState === 'error') return <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 text-center"><h1 className="font-display text-3xl font-bold text-[#123B2A]">Couldn’t verify administrator access</h1><p role="alert" className="mt-3 text-sm text-[#20231F]/70">{adminPermissionError}</p><button type="button" onClick={retryPermissionCheck} className="mt-6 min-h-11 rounded-lg bg-[#123B2A] px-5 py-3 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D94B]">Try again</button></main>;
  if (accessState === 'denied') return <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 text-center"><h1 className="font-display text-3xl font-bold text-[#123B2A]">Access unavailable</h1><p className="mt-3 text-sm text-[#20231F]/70">This workspace is available only to authorized administrators.</p><Link to="/" className="mt-6 rounded-lg bg-[#123B2A] px-5 py-3 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D94B]">Return home</Link></main>;
  return <AdminPage />;
}

export default function App() {
  const [shareModalOpen, setShareModalOpen] = useState(false);

  return (
    <BrowserRouter>
      <AuthProvider>
      <CartProvider>
      <div className="flex flex-col min-h-screen bg-[#FFF8E9] text-[#20231F] selection:bg-[#B8D94B] selection:text-[#123B2A]">
        <ScrollToTop />
        <RouteMetadata />
        
        {/* Navigation Bar */}
        <Navbar />

        {/* Main Content Pages */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route 
              path="/customer-register" 
              element={<CustomerRegistrationPage onOpenShare={() => setShareModalOpen(true)} />} 
            />
            <Route path="/vendor-register" element={<VendorRegistrationPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
            <Route path="/vendor" element={<ProtectedRoute><VendorDashboardPage /></ProtectedRoute>} />
            <Route path="/vendors/:businessId/menu" element={<PublicVendorMenuPage />} />
            <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><CustomerOrdersPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminRoute /></ProtectedRoute>} />
            <Route path="/admin/*" element={<ProtectedRoute><AdminRoute /></ProtectedRoute>} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>

        {/* Footer */}
        <Footer onOpenShare={() => setShareModalOpen(true)} />

        {/* Global Share Modal */}
        <ShareModal 
          isOpen={shareModalOpen} 
          onClose={() => setShareModalOpen(false)} 
        />
      </div>
      </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
