import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getAdminUsers,
  getAdminUserSubscriptions,
  addCredits as apiAddCredits,
  removeCredits as apiRemoveCredits,
  removeUserSubscription,
  updateUserSubscriptionEndDate,
  forgotPassword,
} from '../lib/apiClient';
import Spinner from '../components/feedback/Spinner';

interface UserInfo {
  username: string;
  email: string;
  role: string;
  credits: number;
  services_count: number;
}

interface Subscription {
  service_name: string;
  account_id: string;
  end_date: string;
}

const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export default function AdminUserDetail() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const decodedUsername = decodeURIComponent(username || '');

  const [user, setUser] = useState<UserInfo | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [subsLoading, setSubsLoading] = useState(false);

  const [creditAmount, setCreditAmount] = useState<number>(0);
  const [creditLoading, setCreditLoading] = useState(false);

  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [editingEndDate, setEditingEndDate] = useState<Record<string, string>>({});
  const [showEndDateEdit, setShowEndDateEdit] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!decodedUsername) return;
    const load = async () => {
      setLoading(true);
      try {
        const [usersRes, subsRes] = await Promise.all([
          getAdminUsers(1, 100, decodedUsername),
          getAdminUserSubscriptions(decodedUsername).catch(() => ({ subscriptions: [] })),
        ]);
        const usersData: any = usersRes;
        const found = (usersData.users || usersData || []).find(
          (u: any) => u.username === decodedUsername
        );
        setUser(found || null);
        const subsData: any = subsRes;
        setSubscriptions(subsData.subscriptions || []);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [decodedUsername]);

  const refreshSubscriptions = async () => {
    setSubsLoading(true);
    try {
      const data: any = await getAdminUserSubscriptions(decodedUsername);
      setSubscriptions(data.subscriptions || []);
    } catch {
      // keep existing
    } finally {
      setSubsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const usersRes: any = await getAdminUsers(1, 100, decodedUsername);
      const found = (usersRes.users || usersRes || []).find(
        (u: any) => u.username === decodedUsername
      );
      if (found) setUser(found);
    } catch {
      // keep existing
    }
  };

  const handleAddCredits = async () => {
    if (creditAmount <= 0) { alert('Enter a valid amount'); return; }
    setCreditLoading(true);
    try {
      await apiAddCredits(decodedUsername, creditAmount);
      alert(`Added ${creditAmount} credits to ${decodedUsername}`);
      setCreditAmount(0);
      await refreshUser();
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed to add credits'}`);
    } finally {
      setCreditLoading(false);
    }
  };

  const handleRemoveCredits = async () => {
    if (creditAmount <= 0) { alert('Enter a valid amount'); return; }
    setCreditLoading(true);
    try {
      await apiRemoveCredits(decodedUsername, creditAmount);
      alert(`Removed ${creditAmount} credits from ${decodedUsername}`);
      setCreditAmount(0);
      await refreshUser();
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed to remove credits'}`);
    } finally {
      setCreditLoading(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!user?.email) { alert('No email available'); return; }
    if (!confirm(`Send password reset email to ${user.email}?`)) return;
    setResetLoading(true);
    try {
      await forgotPassword(user.email);
      setResetSent(true);
      alert(`Password reset email sent to ${user.email}`);
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed to send reset email'}`);
    } finally {
      setResetLoading(false);
    }
  };

  const handleRemoveSubscription = async (accountId: string) => {
    if (!confirm(`Remove subscription "${accountId}" from ${decodedUsername}?`)) return;
    try {
      await removeUserSubscription(decodedUsername, accountId);
      await Promise.all([refreshSubscriptions(), refreshUser()]);
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed to remove subscription'}`);
    }
  };

  const handleUpdateEndDate = async (accountId: string) => {
    const iso = editingEndDate[accountId];
    if (!iso) { alert('Pick a date'); return; }
    const [year, month, day] = iso.split('-');
    const ddmmyyyy = `${day}/${month}/${year}`;
    try {
      await updateUserSubscriptionEndDate(decodedUsername, accountId, ddmmyyyy);
      setShowEndDateEdit(prev => ({ ...prev, [accountId]: false }));
      setEditingEndDate(prev => ({ ...prev, [accountId]: '' }));
      await refreshSubscriptions();
    } catch {
      alert('Failed to update end date');
    }
  };

  if (loading) return <Spinner />;

  if (!user) {
    return (
      <div className="flex-1 py-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white mb-4 transition-colors">
            <ArrowLeftIcon /> Back to Admin
          </button>
          <div className="glass-panel rounded-2xl p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">User "{decodedUsername}" not found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 py-4">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white mb-6 transition-colors text-sm">
          <ArrowLeftIcon /> Back to Admin
        </button>

        {/* User Info Card */}
        <div className="glass-panel rounded-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                  {decodedUsername.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{decodedUsername}</h1>
                  <p className="text-gray-500 dark:text-gray-400">{user.email}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                user.role === 'admin'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              }`}>{user.role}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="glass-panel-soft rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{user.credits}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Credits</div>
            </div>
            <div className="glass-panel-soft rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{user.services_count}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Subscriptions</div>
            </div>
            <div className="glass-panel-soft rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{user.role}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Role</div>
            </div>
            <div className="glass-panel-soft rounded-xl p-4 text-center">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.email}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email</div>
            </div>
          </div>
        </div>

        {/* Password Reset */}
        <div className="glass-panel rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Password Reset</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Send a password reset link to the user's email address ({user.email}).
          </p>
          <button
            onClick={handleSendPasswordReset}
            disabled={resetLoading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {resetLoading ? 'Sending...' : resetSent ? 'Resend Reset Link' : 'Send Password Reset Link'}
          </button>
          {resetSent && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">Reset link sent successfully.</p>
          )}
        </div>

        {/* Credit Management */}
        <div className="glass-panel rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Credit Management</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
              <input
                type="number"
                min={1}
                value={creditAmount || ''}
                onChange={(e) => setCreditAmount(Number(e.target.value))}
                placeholder="Enter credit amount"
                className="w-full px-3 py-2 glass-input rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddCredits}
                disabled={creditLoading || creditAmount <= 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                Add Credits
              </button>
              <button
                onClick={handleRemoveCredits}
                disabled={creditLoading || creditAmount <= 0}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                Remove Credits
              </button>
            </div>
          </div>
        </div>

        {/* Subscriptions */}
        <div className="glass-panel rounded-2xl">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Subscriptions ({subscriptions.length})
            </h2>
            {subsLoading && <span className="text-xs text-gray-500">Refreshing...</span>}
          </div>
          <div className="p-6">
            {subscriptions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No active subscriptions.</p>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((s, idx) => (
                  <div key={idx} className="glass-panel-soft rounded-xl p-4 border border-white/40 dark:border-slate-500/30">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm flex-1">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">Service</span>
                          <div className="font-medium text-gray-900 dark:text-white">{s.service_name}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">Account ID</span>
                          <div className="font-medium text-gray-900 dark:text-white break-all">{s.account_id}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">End Date</span>
                          <div className="font-medium text-gray-900 dark:text-white">{s.end_date}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setShowEndDateEdit(prev => ({ ...prev, [s.account_id]: !prev[s.account_id] }))}
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                          title="Edit end date"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          onClick={() => handleRemoveSubscription(s.account_id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          title="Remove subscription"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                    {showEndDateEdit[s.account_id] && (
                      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <input
                          type="date"
                          value={editingEndDate[s.account_id] || ''}
                          onChange={(e) => setEditingEndDate(prev => ({ ...prev, [s.account_id]: e.target.value }))}
                          className="px-3 py-1.5 glass-input rounded-lg text-sm dark:[color-scheme:dark]"
                        />
                        <button
                          onClick={() => handleUpdateEndDate(s.account_id)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setShowEndDateEdit(prev => ({ ...prev, [s.account_id]: false }));
                            setEditingEndDate(prev => ({ ...prev, [s.account_id]: '' }));
                          }}
                          className="px-3 py-1.5 glass-btn-secondary rounded-lg text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
