import React, { useState } from 'react';
import SignupForm from '../features/auth/components/SignupForm';
import LoginForm from '../features/auth/components/LoginForm';
import ForgotPasswordForm from '../features/auth/components/ForgotPasswordForm';
import { useTheme } from '../contexts/ThemeContext';

type AuthMode = 'login' | 'signup' | 'forgot-password';

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const { theme } = useTheme();

  const renderForm = () => {
    switch (mode) {
      case 'signup':
        return (
          <SignupForm
            onSuccess={() => {}} // No longer needed, but keeping for compatibility
            onSwitchToLogin={() => setMode('login')}
          />
        );
      case 'login':
        return (
          <LoginForm
            onSwitchToSignup={() => setMode('signup')}
            onSwitchToForgotPassword={() => setMode('forgot-password')}
          />
        );
      case 'forgot-password':
        return (
          <ForgotPasswordForm
            onSwitchToLogin={() => setMode('login')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="w-full max-w-md">
        {/* Form */}
        {renderForm()}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            © 2025 Valuesubs. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
} 