import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./contexts/AuthContext";
import AuthPage from "./components/AuthPage";
import { config } from "./config/index";
import Header from "./components/Header";
import { Footer } from "./components/layout";
import Dashboard from "./pages/Dashboard";
import UserPage from "./pages/UserPage";
import Wallet from "./pages/Wallet";
import Shop from "./pages/Shop";
import ContactUs from "./pages/ContactUs";
import Subscriptions from "./pages/Subscriptions";
import Admin from "./pages/Admin";
import AdminAnalytics from "./pages/AdminAnalytics";
import AccessDenied from "./pages/AccessDenied";
import NotFound from "./pages/NotFound";
import TermsAndConditions from "./components/TermsAndConditions";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import EmailVerification from "./pages/EmailVerification";
import Giveaway from "./pages/Giveaway";

// Admin Route Component
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}

// Main App Layout
function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col glass-ambient text-gray-900 dark:text-slate-100">
      <Header />
      <main className="relative flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<UserPage />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/shop" element={config.isFeatureEnabled('shop') ? <Shop /> : <AccessDenied />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/giveaway" element={<Giveaway />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
          <Route path="/access-denied" element={<AccessDenied />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

// Main App Component
export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/verify-email" element={<EmailVerification />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
