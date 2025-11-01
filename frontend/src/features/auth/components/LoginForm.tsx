import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { login, resendVerificationEmail } from '../../../lib/apiClient';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onSwitchToForgotPassword: () => void;
}

export default function LoginForm({ onSwitchToSignup, onSwitchToForgotPassword }: LoginFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const { login: authLogin } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setEmailNotVerified(false);
    try {
      const data = await login(formData.email, formData.password);
      await authLogin(data.access_token);
      // Navigation is now handled by AuthContext
    } catch (err: any) {
      // Check if it's an email verification error (403)
      if (err?.response?.status === 403 || err?.code === 403) {
        setEmailNotVerified(true);
        setErrors({ general: err?.response?.data?.detail || 'Please verify your email before logging in.' });
        return;
      }
      
      // Parse our structured error, if provided
      let message = 'Something went wrong on our side. Please try again.';
      try {
        const parsed = JSON.parse(err?.message || '{}');
        if (parsed && parsed.code === 404) {
          message = 'User does not exist';
        } else if (parsed && parsed.code === 401) {
          message = 'Incorrect password.';
        }
      } catch (_) {
        // keep default server-side error message
      }
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    if (emailNotVerified) {
      setEmailNotVerified(false);
    }
  };

  const handleResendVerification = async () => {
    if (!formData.email) {
      setErrors({ general: 'Please enter your email address first.' });
      return;
    }
    
    setResendingVerification(true);
    try {
      await resendVerificationEmail(formData.email);
      setErrors({ general: 'Verification email sent! Please check your inbox.' });
      setEmailNotVerified(false);
    } catch (err: any) {
      setErrors({ general: err?.response?.data?.detail || 'Failed to resend verification email. Please try again.' });
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <div className={`w-full max-w-md mx-auto ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
      <div className={`p-8 rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
          <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <Input
            type="email"
            label="Email"
            value={formData.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('email', e.target.value)}
            placeholder="Enter your email"
            error={errors.email}
          />

          {/* Password Field */}
          <Input
            type="password"
            label="Password"
            value={formData.password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('password', e.target.value)}
            placeholder="Enter your password"
            error={errors.password}
            showPasswordToggle={true}
          />

          {/* Forgot Password Link */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSwitchToForgotPassword}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Forgot your password?
            </button>
          </div>

          {errors.general && (
            <div className={`px-4 py-3 rounded ${emailNotVerified ? 'bg-yellow-100 border border-yellow-400 text-yellow-700' : 'bg-red-100 border border-red-400 text-red-700'}`}>
              <p className="mb-2">{errors.general}</p>
              {emailNotVerified && (
                <div className="mt-3 space-y-2">
                  <Button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendingVerification}
                    variant="secondary"
                    className="w-full text-sm"
                  >
                    {resendingVerification ? 'Sending...' : 'Resend Verification Email'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => navigate('/verify-email')}
                    className="text-sm text-blue-600 hover:text-blue-700 underline w-full block text-center"
                  >
                    Go to Verification Page
                  </button>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>

          <div className="text-center">
            <span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Don't have an account?{' '}
            </span>
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 