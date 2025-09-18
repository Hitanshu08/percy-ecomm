import React, { useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { forgotPassword, verifyOtp, resetPassword } from '../../../lib/apiClient';

interface ForgotPasswordFormProps {
  onSwitchToLogin: () => void;
}

export default function ForgotPasswordForm({ onSwitchToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  type Step = 'request' | 'verify' | 'reset';
  const [step, setStep] = useState<Step>('request');
  const [otp, setOtp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [cooldown, setCooldown] = useState<number>(0);
  const cooldownSteps = [60, 120, 300, 600, 1800];
  const [cooldownIndex, setCooldownIndex] = useState<number>(0);

  // Persist cooldown per email so navigation doesn't reset it
  const storageKey = React.useMemo(() => email ? `fp_otp:${email.toLowerCase()}` : '', [email]);
  const saveCooldownState = React.useCallback((index: number, nextAllowedAtEpoch: number) => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ index, nextAllowedAt: nextAllowedAtEpoch }));
    } catch (_) {}
  }, [storageKey]);
  const loadCooldownState = React.useCallback((): { index: number; nextAllowedAt: number } | null => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }, [storageKey]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // When entering verify step or when email is same, restore remaining cooldown from storage
  React.useEffect(() => {
    if (step !== 'verify' || !email) return;
    const state = loadCooldownState();
    if (!state) return;
    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, Math.floor(state.nextAllowedAt - now));
    setCooldownIndex(Math.min(Math.max(state.index, 0), cooldownSteps.length - 1));
    setCooldown(remaining);
  }, [step, email, loadCooldownState]);
  const [error, setError] = useState('');
  const { theme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Email is required');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await forgotPassword(email);
      setStep('verify');
      // Initialize cooldown to first step (1 minute) on first send, but persist it
      const firstIdx = 0;
      const wait = cooldownSteps[firstIdx];
      const nextAllowedAt = Math.floor(Date.now() / 1000) + wait;
      setCooldownIndex(firstIdx);
      setCooldown(wait);
      saveCooldownState(firstIdx, nextAllowedAt);
    } catch (err: any) {
      const apiDetail = err?.response?.data?.detail;
      const msg = String(apiDetail || err?.message || '').toLowerCase();
      if (msg.includes('account not created for')) {
        setError(`Account is not created with ${email}`);
      } else if (msg.includes('please wait')) {
        setError(String(apiDetail || 'Please wait before requesting another OTP'));
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'verify') {
    return (
      <div className={`w-full max-w-md mx-auto ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
        <div className={`p-8 rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} text-center`}>
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Enter OTP</h2>
            <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              We've sent an OTP to <strong>{email}</strong>
            </p>
          </div>
          
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              if (!otp.trim()) {
                setError('OTP is required');
                return;
              }
              try {
                await verifyOtp(email, otp.trim());
                setStep('reset');
              } catch (err: any) {
                const apiDetail = err?.response?.data?.detail;
                const msg = String(apiDetail || err?.message || '').toLowerCase();
                if (msg.includes('invalid or expired otp')) {
                  setError('Invalid or expired OTP');
                } else if (msg.includes('account not created for')) {
                  setError(`Account is not created with ${email}`);
                } else {
                  setError(String(apiDetail || 'Failed to verify OTP. Please try again.'));
                }
              }
            }}
            className="space-y-4 text-left"
          >
            <div>
              <label className="block text-sm font-medium mb-1">OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\s+/g, ''))}
                className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                  theme === 'dark' 
                    ? 'border-gray-600 focus:border-blue-500 bg-gray-700' 
                    : 'border-gray-300 focus:border-blue-500 bg-white'
                } ${theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'}`}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={cooldown > 0}
                onClick={async () => {
                  setError('');
                  try {
                    await forgotPassword(email);
                    const nextIdx = Math.min(cooldownIndex + 1, cooldownSteps.length - 1);
                    const wait = cooldownSteps[nextIdx];
                    const nextAllowedAt = Math.floor(Date.now() / 1000) + wait;
                    setCooldownIndex(nextIdx);
                    setCooldown(wait);
                    saveCooldownState(nextIdx, nextAllowedAt);
                  } catch (err: any) {
                    const apiDetail = err?.response?.data?.detail;
                    const msg = String(apiDetail || err?.message || '').toLowerCase();
                    if (msg.includes('account not created for')) {
                      setError(`Account is not created with ${email}`);
                    } else if (msg.includes('please wait') || msg.includes('429')) {
                      setError(String(apiDetail || 'Please wait before requesting another OTP'));
                    } else {
                      setError(String(apiDetail || 'Failed to resend OTP. Please try again.'));
                    }
                  }
                }}
                className={`px-3 py-2 rounded-md text-sm ${cooldown > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-gray-800'}`}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Verify OTP
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <div className={`w-full max-w-md mx-auto ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
        <div className={`p-8 rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">Reset Password</h2>
            <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Enter your new password for <strong>{email}</strong>
            </p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              if (!newPass.trim() || !confirmPass.trim()) {
                setError('New password and confirm password are required');
                return;
              }
              if (newPass !== confirmPass) {
                setError('Passwords do not match');
                return;
              }
              try {
                await resetPassword(email, otp.trim(), newPass);
                alert('Password reset successful. Please login.');
                onSwitchToLogin();
              } catch (err: any) {
                const apiDetail = err?.response?.data?.detail;
                setError(String(apiDetail || 'Failed to reset password. Please try again.'));
              }
            }}
            className="space-y-4 text-left"
          >
            <div>
              <label className="block text-sm font-medium mb-1">New Password</label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                  theme === 'dark' 
                    ? 'border-gray-600 focus:border-blue-500 bg-gray-700' 
                    : 'border-gray-300 focus:border-blue-500 bg-white'
                } ${theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'}`}
                placeholder="Enter new password"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                  theme === 'dark' 
                    ? 'border-gray-600 focus:border-blue-500 bg-gray-700' 
                    : 'border-gray-300 focus:border-blue-500 bg-white'
                } ${theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'}`}
                placeholder="Confirm new password"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Reset Password
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-md mx-auto ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
      <div className={`p-8 rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">Reset Password</h2>
          <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                error
                  ? 'border-red-500 focus:border-red-500' 
                  : theme === 'dark' 
                    ? 'border-gray-600 focus:border-blue-500 bg-gray-700' 
                    : 'border-gray-300 focus:border-blue-500 bg-white'
              } ${theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'}`}
              placeholder="Enter your email"
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLoading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onSwitchToLogin}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
} 