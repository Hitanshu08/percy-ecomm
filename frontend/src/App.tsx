import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";
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
import AccessDenied from "./pages/AccessDenied";
import NotFound from "./pages/NotFound";
import TermsAndConditions from "./pages/TermsAndConditions";

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

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
  const { theme } = useTheme();
  
  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<UserPage />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/shop" element={config.isFeatureEnabled('shop') ? <Shop /> : <AccessDenied />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
