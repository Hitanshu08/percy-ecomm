import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { changePassword, getMe, getMyReferralStats } from "../lib/apiClient";
import { Button, Input } from "../components/ui";
import Spinner from "../components/feedback/Spinner";
import Panel from "../components/layout/Panel";

interface UserData {
  username: string;
  email: string;
  role: string;
  credits: number;
}

export default function UserPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordErrors, setPasswordErrors] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [referralStats, setReferralStats] = useState<{
    referral_code: string;
    referrals_count: number;
    total_credits_earned: number;
  } | null>(null);
  const [loadingReferrals, setLoadingReferrals] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchReferralStats();
  }, []);

  const fetchReferralStats = async () => {
    try {
      const stats = await getMyReferralStats();
      setReferralStats(stats);
    } catch (error: any) {
      // If referral code doesn't exist yet, that's okay - user might be old
      if (error.response?.status !== 404) {
        console.error('Error fetching referral stats:', error);
      }
    } finally {
      setLoadingReferrals(false);
    }
  };

  const copyReferralCode = () => {
    if (referralStats?.referral_code) {
      navigator.clipboard.writeText(referralStats.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyReferralLink = () => {
    const referralLink = `${window.location.origin}/auth?ref=${referralStats?.referral_code}`;
    navigator.clipboard.writeText(referralLink);
    setMessage({ type: 'success', text: 'Referral link copied to clipboard!' });
  };

  const fetchUserData = async () => {
    try {
      const data = await getMe();
      setUserData(data as UserData);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const validatePasswordForm = () => {
    const errors = {
      oldPassword: "",
      newPassword: "",
      confirmPassword: ""
    };

    if (!passwordData.oldPassword) {
      errors.oldPassword = "Old password is required";
    }

    if (!passwordData.newPassword) {
      errors.newPassword = "New password is required";
    } else if (passwordData.newPassword.length < 6) {
      errors.newPassword = "Password must be at least 6 characters";
    }

    if (!passwordData.confirmPassword) {
      errors.confirmPassword = "Please confirm your new password";
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setPasswordErrors(errors);
    return !Object.values(errors).some(error => error !== "");
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswordForm()) {
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(passwordData.oldPassword, passwordData.newPassword);
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setShowPasswordModal(false);
      setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordErrors({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password. Please check your old password.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (passwordErrors[field as keyof typeof passwordErrors]) {
      setPasswordErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  if (loading) {
    return (
      <Spinner />
    );
  }

  return (
    <div className="flex-1 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">User Profile</h1>
          <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            Manage your account settings and preferences
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 border border-green-400 text-green-700' 
              : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <div className="lg:col-span-2">
            <Panel title={<span className="text-lg font-medium">Profile Information</span>} bodyClassName="px-2 sm:px-2">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Username
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {userData?.username || user?.username}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {userData?.email || user?.email}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      User ID
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {userData?.username || user?.user_id}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Credits
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {userData?.credits?.toLocaleString() || '0'} credits
                    </p>
                  </div>
                  
                </div>
            </Panel>
          </div>

          {/* Security Settings */}
          <div className="lg:col-span-1">
            <Panel title={<span className="text-lg font-medium">Security</span>} bodyClassName="px-2 sm:px-2">
                <Button
                  onClick={() => setShowPasswordModal(true)}
                  variant="primary"
                  className="w-full"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Change Password
                </Button>
            </Panel>
          </div>
        </div>

        {/* Referral Program Section */}
        <div className="mt-8">
          <Panel title={<span className="text-lg font-medium">Referral Program</span>} bodyClassName="px-2 sm:px-2">
            {loadingReferrals ? (
              <div className="py-4">
                <Spinner />
              </div>
            ) : referralStats ? (
              <div className="space-y-6">
                {/* Referral Code Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Referral Code
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 min-w-0 glass-panel-soft px-4 py-3 rounded-lg border border-white/40 dark:border-slate-500/30">
                      <code className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-wider break-all">
                        {referralStats.referral_code}
                      </code>
                    </div>
                    <Button
                      onClick={copyReferralCode}
                      variant={copied ? "secondary" : "primary"}
                      className="w-full sm:w-auto px-4 sm:px-6 justify-center"
                    >
                      {copied ? (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Code
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Share this code with friends! When they sign up using your code and purchase their first subscription, you'll earn credits as a reward.
                  </p>
                </div>

                {/* Share Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Referral Link
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 min-w-0 glass-panel-soft px-4 py-3 rounded-lg border border-white/40 dark:border-slate-500/30">
                      <code className="block text-xs sm:text-sm text-gray-900 dark:text-white break-all">
                        {window.location.origin}/auth?ref={referralStats.referral_code}
                      </code>
                    </div>
                    <Button
                      onClick={copyReferralLink}
                      variant="secondary"
                      className="w-full sm:w-auto px-4 sm:px-6 justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Link
                    </Button>
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="glass-panel-soft p-4 rounded-lg border border-blue-200/55 dark:border-blue-800/40">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Users Referred</div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {(referralStats.referrals_count || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Total signups
                    </div>
                  </div>
                  <div className="glass-panel-soft p-4 rounded-lg border border-green-200/55 dark:border-green-800/40">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Credits Earned</div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {(referralStats.total_credits_earned || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      From referrals
                    </div>
                  </div>
                  <div className="glass-panel-soft p-4 rounded-lg border border-purple-200/55 dark:border-purple-800/40">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg. per Referral</div>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {referralStats.referrals_count > 0 
                        ? ((referralStats.total_credits_earned || 0) / referralStats.referrals_count).toFixed(1)
                        : '0.0'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Credits per user
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="glass-panel-soft border border-blue-200/55 dark:border-blue-800/40 rounded-lg p-4">
                  <div className="flex">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>How it works:</strong> Share your referral code or link with friends. When they sign up using your code and purchase their first subscription, you automatically receive referral credits. Credits are awarded only once per referred user, immediately after their first purchase.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-gray-600 dark:text-gray-400">
                Referral code not available. Please contact support if you believe this is an error.
              </div>
            )}
          </Panel>
        </div>

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div 
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                onClick={() => setShowPasswordModal(false)}
              />

              {/* Modal panel */}
              <div className="inline-block align-bottom glass-panel border border-white/40 dark:border-slate-500/30 rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Change Password
                  </h3>
                </div>
                
                <form onSubmit={handlePasswordChange} className="px-6 py-4">
                  <div className="space-y-4">
                    <Input
                      type="password"
                      label="Current Password"
                      value={passwordData.oldPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('oldPassword', e.target.value)}
                      placeholder="Enter your current password"
                      error={passwordErrors.oldPassword}
                      showPasswordToggle={true}
                    />

                    <Input
                      type="password"
                      label="New Password"
                      value={passwordData.newPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('newPassword', e.target.value)}
                      placeholder="Enter your new password"
                      error={passwordErrors.newPassword}
                      showPasswordToggle={true}
                    />

                    <Input
                      type="password"
                      label="Confirm New Password"
                      value={passwordData.confirmPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('confirmPassword', e.target.value)}
                      placeholder="Confirm your new password"
                      error={passwordErrors.confirmPassword}
                      showPasswordToggle={true}
                    />
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <Button
                      type="button"
                      onClick={() => setShowPasswordModal(false)}
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isChangingPassword}
                      variant="primary"
                    >
                      {isChangingPassword ? 'Updating...' : 'Update Password'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
