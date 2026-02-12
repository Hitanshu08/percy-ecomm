import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { useSearchParams } from 'react-router-dom';
import { signup, checkUsername } from '../../../lib/apiClient';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';

interface SignupFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

export default function SignupForm({ onSuccess, onSwitchToLogin }: SignupFormProps) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    referralCode: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [usernameAvailable, setUsernameAvailable] = useState<null | boolean>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();

  // Auto-fill referral code from URL parameter
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setFormData(prev => ({ ...prev, referralCode: refCode.toUpperCase() }));
    }
  }, [searchParams]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const newSuggestions: string[] = [];

    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      newSuggestions.push('Use at least 6 characters');
    } else {
      if (!/[A-Z]/.test(formData.password)) {
        newSuggestions.push('Include at least one uppercase letter');
      }
      if (!/[a-z]/.test(formData.password)) {
        newSuggestions.push('Include at least one lowercase letter');
      }
      if (!/[0-9]/.test(formData.password)) {
        newSuggestions.push('Include at least one number');
      }
      if (!/[^A-Za-z0-9]/.test(formData.password)) {
        newSuggestions.push('Include at least one special character');
      }
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    setSuggestions(newSuggestions);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await signup(formData.username, formData.email, formData.password, formData.referralCode || undefined);
      onSuccess();
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setErrors({ general: err.response.data.detail });
      } else {
        setErrors({ general: 'Failed to create account. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Debounced username availability check
  useEffect(() => {
    const val = formData.username.trim();
    setUsernameAvailable(null);
    if (!val || val.length < 3) return;
    setCheckingUsername(true);
    const t = setTimeout(async () => {
      try {
        const res = await checkUsername(val);
        setUsernameAvailable(res.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [formData.username]);

  return (
    <div className={`w-full max-w-md mx-auto ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
      <div className="p-8 rounded-2xl glass-panel border border-white/40 dark:border-slate-500/30 shadow-lg">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">Create Account</h2>
          <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            Join us today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Field */}
          <div className="space-y-1">
            <Input
              type="text"
              label="Username"
              value={formData.username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('username', e.target.value)}
              placeholder="Choose a username"
              error={errors.username}
            />
            {formData.username && formData.username.length >= 3 && (
              <div className="text-sm mt-2s">
                {checkingUsername ? (
                  <span className="text-gray-500">Checking availability…</span>
                ) : usernameAvailable === false ? (
                  <span className="text-red-600">Username {formData.username} is taken</span>
                ) : usernameAvailable === true ? (
                      <span className="text-green-600">Username {formData.username} is available</span>
                ) : null}
              </div>
            )}
          </div>

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
            placeholder="Create a password"
            error={errors.password}
            showPasswordToggle={true}
          />

          {/* Password Suggestions */}
          {suggestions.length > 0 && (
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Suggestions: {suggestions.join(', ')}
            </p>
          )}

          {/* Confirm Password Field */}
          <Input
            type="password"
            label="Confirm Password"
            value={formData.confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('confirmPassword', e.target.value)}
            placeholder="Confirm your password"
            error={errors.confirmPassword}
            showPasswordToggle={true}
          />

          {/* Referral Code Field (Optional) */}
          <Input
            type="text"
            label="Referral Code (Optional)"
            value={formData.referralCode}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('referralCode', e.target.value.toUpperCase())}
            placeholder="Enter referral code"
            error={errors.referralCode}
          />

          {errors.general && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {errors.general}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>

          <div className="text-center">
            <span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Already have an account?{' '}
            </span>
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 