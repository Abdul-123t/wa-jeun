/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ShareModal } from './components/ShareModal';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { CustomerRegistrationPage } from './pages/CustomerRegistrationPage';
import { VendorRegistrationPage } from './pages/VendorRegistrationPage';
import { AboutPage } from './pages/AboutPage';
import { LegalPage } from './pages/LegalPage';

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

export default function App() {
  const [shareModalOpen, setShareModalOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-[#FFF8E9] text-[#20231F] selection:bg-[#B8D94B] selection:text-[#123B2A]">
        <ScrollToTop />
        
        {/* Navigation Bar */}
        <Navbar onOpenShare={() => setShareModalOpen(true)} />

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
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>

        {/* Footer */}
        <Footer />

        {/* Global Share Modal */}
        <ShareModal 
          isOpen={shareModalOpen} 
          onClose={() => setShareModalOpen(false)} 
        />
      </div>
    </BrowserRouter>
  );
}
