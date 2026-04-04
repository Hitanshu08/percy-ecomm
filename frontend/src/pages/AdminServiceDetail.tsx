import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getService,
  createService,
  updateService,
  putServiceCredits,
} from '../lib/apiClient';
import { config } from '../config/index';
import { Checkbox } from '../components/ui';
import Spinner from '../components/feedback/Spinner';

interface AccountForm {
  id: string;
  password: string;
  end_date: string;
  is_active: boolean;
}

const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const defaultDurationCredits: Record<string, number> = {
  '1month': 2,
  '3months': 3,
};

function buildCreditsWithDefaults(credits: Record<string, number> | undefined | null): Record<string, number> {
  const src = credits || {};
  const merged: Record<string, number> = {};
  Object.entries(config.getSubscriptionDurations()).forEach(([key, d]: any) => {
    const provided = src[key];
    const fallback = defaultDurationCredits[key] ?? d.credits_cost ?? 0;
    merged[key] = typeof provided === 'number' && !Number.isNaN(provided) ? provided : Number(fallback) || 0;
  });
  return merged;
}

export default function AdminServiceDetail() {
  const { serviceName } = useParams<{ serviceName: string }>();
  const navigate = useNavigate();
  const isCreateMode = serviceName === 'new';
  const decodedName = isCreateMode ? '' : decodeURIComponent(serviceName || '');

  const [loading, setLoading] = useState(!isCreateMode);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [accounts, setAccounts] = useState<AccountForm[]>([{ id: '', password: '', end_date: '', is_active: true }]);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (isCreateMode) {
      setCredits(buildCreditsWithDefaults(null));
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const data: any = await getService(decodedName);
        setName(data.name || '');
        setImage(data.image || '');
        setCredits(data.credits || {});
        setAccounts(
          (data.accounts || []).map((a: any) => ({
            id: a.id || '',
            password: a.password || '',
            end_date: a.end_date || '',
            is_active: a.is_active ?? true,
          }))
        );
      } catch {
        alert('Failed to load service');
        navigate('/admin');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [decodedName, isCreateMode, navigate]);

  const addAccount = () => {
    setAccounts(prev => [...prev, { id: '', password: '', end_date: '', is_active: true }]);
  };

  const removeAccount = (index: number) => {
    setAccounts(prev => prev.filter((_, i) => i !== index));
  };

  const updateAccount = (index: number, field: keyof AccountForm, value: string | boolean) => {
    setAccounts(prev => prev.map((acc, i) => (i === index ? { ...acc, [field]: value } : acc)));
  };

  const handleSave = async () => {
    if (!name.trim()) { alert('Service name is required'); return; }
    if (accounts.some(a => !a.id.trim())) { alert('All accounts must have an ID'); return; }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        image: image.trim(),
        credits: buildCreditsWithDefaults(credits),
        accounts: accounts.map(a => ({
          id: a.id.trim(),
          password: a.password,
          end_date: a.end_date || undefined,
          is_active: a.is_active,
        })),
      };

      if (isCreateMode) {
        await createService(payload);
        alert('Service created successfully!');
        navigate('/admin');
      } else {
        await updateService(decodedName, payload);
        if (credits && Object.keys(credits).length > 0) {
          await putServiceCredits(name.trim(), buildCreditsWithDefaults(credits));
        }
        alert('Service updated successfully!');
        navigate('/admin');
      }
    } catch (e: any) {
      try {
        const parsed = JSON.parse(e.message);
        alert(parsed.detail || 'Failed to save service');
      } catch {
        alert(e?.message || 'Failed to save service');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="flex-1 py-4">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white mb-6 transition-colors text-sm">
          <ArrowLeftIcon /> Back to Admin
        </button>

        <div className="glass-panel rounded-2xl p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {isCreateMode ? 'Create New Service' : `Edit Service: ${decodedName}`}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isCreateMode ? 'Fill in the details to create a new service.' : 'Update the service details below.'}
          </p>
        </div>

        {/* Basic Info */}
        <div className="glass-panel rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Service Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ChatGPT"
                className="w-full px-3 py-2 glass-input rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image URL</label>
              <input
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://example.com/image.png"
                className="w-full px-3 py-2 glass-input rounded-lg text-sm"
              />
            </div>
          </div>
          {image.trim() && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</label>
              <img
                src={image}
                alt={name || 'Service preview'}
                className="w-48 h-28 rounded-lg border border-gray-200 dark:border-gray-700 object-cover bg-gray-50 dark:bg-gray-800"
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
              />
            </div>
          )}
        </div>

        {/* Credits */}
        <div className="glass-panel rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Credits per Duration</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(config.getSubscriptionDurations()).map(([key, d]: any) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{d.name}</label>
                <input
                  type="number"
                  min={0}
                  value={credits[key] ?? defaultDurationCredits[key] ?? d.credits_cost ?? 0}
                  onChange={(e) => setCredits(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="w-full px-3 py-2 glass-input rounded-lg text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Accounts */}
        <div className="glass-panel rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Accounts ({accounts.length})</h2>
            <button
              onClick={addAccount}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Account
            </button>
          </div>

          <div className="space-y-4">
            {accounts.map((acc, index) => (
              <div key={index} className="glass-panel-soft rounded-xl p-4 border border-white/40 dark:border-slate-500/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Account {index + 1}</h3>
                  {accounts.length > 1 && (
                    <button
                      onClick={() => removeAccount(index)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      title="Remove account"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Account ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={acc.id}
                      onChange={(e) => updateAccount(index, 'id', e.target.value)}
                      placeholder="Account ID"
                      autoComplete="off"
                      className="w-full px-3 py-2 glass-input rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords[index] ? 'text' : 'password'}
                        value={acc.password}
                        onChange={(e) => updateAccount(index, 'password', e.target.value)}
                        placeholder="Password"
                        autoComplete="off"
                        className="w-full pr-10 pl-3 py-2 glass-input rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(prev => ({ ...prev, [index]: !prev[index] }))}
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 dark:text-gray-400"
                      >
                        {showPasswords[index] ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7 0-1.04.363-2.008.99-2.828m3.164-2.555A9.956 9.956 0 0112 5c5 0 9 4 9 7 0 .915-.27 1.79-.756 2.571M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-end pb-1">
                    <Checkbox
                      checked={acc.is_active}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAccount(index, 'is_active', e.target.checked)}
                      label="Available for Purchase"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving ? 'Saving...' : isCreateMode ? 'Create Service' : 'Update Service'}
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="px-6 py-2.5 glass-btn-secondary rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
