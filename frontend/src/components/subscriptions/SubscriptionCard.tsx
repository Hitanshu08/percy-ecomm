import React, { useState } from 'react';
import Button from '../ui/Button';

export interface AccountCredential {
  subscription_id?: string | number;
  account_id: string;
  account_password?: string;
  end_date: string;
  is_active: boolean;
}

export interface SubscriptionItem {
  service_name: string;
  service_image: string;
  end_date: string; // aggregated for badge
  is_active: boolean; // aggregated flag
  accounts: AccountCredential[];
}

interface SubscriptionCardProps {
  subscription: SubscriptionItem;
  theme: 'light' | 'dark' | string;
  formatDate: (dateString: string) => string;
  getStatusColor: (isActive: boolean, endDate: string) => string;
  getStatusText: (isActive: boolean, endDate: string) => string;
  showCredentials: boolean;
  onToggleCredentials: () => void;
}

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  theme,
  formatDate,
  getStatusColor,
  getStatusText,
  showCredentials,
  onToggleCredentials,
}) => {
  const [visiblePasswords, setVisiblePasswords] = useState<{ [index: number]: boolean }>({});

  const togglePassword = (index: number) => {
    setVisiblePasswords(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };
  return (
    <div
      className={`rounded-lg shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl ${
        theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}
    >
      {/* Service Image */}
      <div className="relative h-48 overflow-hidden">
        {subscription.service_image && subscription.service_image.trim().startsWith('<svg') ? (
          <div
            className="service-logo h-48 w-full mx-auto object-cover bg-[ghostwhite]"
            dangerouslySetInnerHTML={{ __html: subscription.service_image }}
          />
        ) : (
          <img
            src={subscription.service_image}
            alt={subscription.service_name}
            className="service-logo h-48 w-full mx-auto object-cover bg-[ghostwhite]"
          />
        )}
        <div className="absolute top-4 right-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.is_active, subscription.end_date)}`}>
            {getStatusText(subscription.is_active, subscription.end_date)}
          </span>
        </div>
      </div>

      {/* Service Info */}
      <div className="p-4">
        <h3 className="text-xl font-bold mb-2">{subscription.service_name}</h3>
        <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} text-sm mb-4`}>
          Expires: {formatDate(subscription.end_date)}
        </p>

        {/* Credentials Section */}
        {subscription.accounts && subscription.accounts.length > 0 ? (
          <div className="space-y-4">
            <Button onClick={onToggleCredentials} variant="secondary" className="w-full">
              <span>View Credentials ({subscription.accounts.length})</span>
              <svg
                className={`w-5 h-5 transition-transform ${showCredentials ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>

            {showCredentials && (
              <div className="space-y-4">
                {subscription.accounts.map((acc, idx) => (
                  <div key={`${acc.subscription_id ?? idx}`} className={`p-3 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Account {idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(acc.is_active, acc.end_date)}`}>
                        {getStatusText(acc.is_active, acc.end_date)}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Account ID</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={acc.account_id}
                            readOnly
                            className={`basis-0 min-w-0 grow px-3 py-2 rounded border truncate select-all ${
                              theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900'
                            }`}
                            aria-label="Account ID"
                          />
                          <Button onClick={() => copyToClipboard(acc.account_id)} variant="primary" size="sm" title="Copy Account ID">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Password</label>
                        <div className="flex items-center space-x-2">
                          <div className="relative flex-1">
                            <input
                              type={visiblePasswords[idx] ? 'text' : 'password'}
                              value={acc.account_password || ''}
                              readOnly
                              className={`w-full min-w-0 px-3 py-2 pr-10 rounded border truncate ${
                                theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900'
                              }`}
                            />
                            <button
                              onClick={() => togglePassword(idx)}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                              title={visiblePasswords[idx] ? 'Hide password' : 'Show password'}
                            >
                              {visiblePasswords[idx] ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              )}
                            </button>
                          </div>
                          <Button onClick={() => copyToClipboard(acc.account_password || '')} variant="primary" size="sm" title="Copy Password">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SubscriptionCard;


