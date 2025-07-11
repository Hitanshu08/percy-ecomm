import React, { useEffect, useState } from "react";
import { useTheme } from "./contexts/ThemeContext";
import { getSubscriptions } from "./api";

interface Subscription {
  service_name: string;
  service_image: string;
  account_id: string;
  password: string;
  end_date: string;
  is_active: boolean;
}

// Dummy images for different services
const serviceImages: { [key: string]: string } = {
  "Quillbot": "https://via.placeholder.com/300x200/4F46E5/FFFFFF?text=Quillbot",
  "Grammarly": "https://via.placeholder.com/300x200/10B981/FFFFFF?text=Grammarly",
  "ChatGPT": "https://via.placeholder.com/300x200/8B5CF6/FFFFFF?text=ChatGPT",
  "Jasper": "https://via.placeholder.com/300x200/F59E0B/FFFFFF?text=Jasper",
  "Copy.ai": "https://via.placeholder.com/300x200/EF4444/FFFFFF?text=Copy.ai",
  "default": "https://via.placeholder.com/300x200/6B7280/FFFFFF?text=Service"
};

export default function Subscriptions() {
  const { theme } = useTheme();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCredentials, setShowCredentials] = useState<{ [key: string]: boolean }>({});
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await getSubscriptions();
      setSubscriptions((data as { subscriptions: Subscription[] }).subscriptions);
    } catch (err: any) {
      setError("Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const toggleCredentials = (accountId: string) => {
    setShowCredentials(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  const togglePassword = (accountId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      console.log(`${type} copied to clipboard`);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const getServiceImage = (serviceId: string) => {
    // Try to determine service name from service_id
    if (serviceId.includes('qb')) return serviceImages["Quillbot"];
    if (serviceId.includes('gram')) return serviceImages["Grammarly"];
    if (serviceId.includes('chat')) return serviceImages["ChatGPT"];
    return serviceImages.default;
  };

  const getServiceName = (serviceId: string) => {
    // Try to determine service name from service_id
    if (serviceId.includes('qb')) return "Quillbot";
    if (serviceId.includes('gram')) return "Grammarly";
    if (serviceId.includes('chat')) return "ChatGPT";
    return "Unknown Service";
  };

  const formatDate = (dateString: string) => {
    // Handle dd/mm/yyyy format
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    // Fallback to original format
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysUntilExpiry = (dateString: string) => {
    const today = new Date();
    let expiryDate: Date;
    
    // Handle dd/mm/yyyy format
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      expiryDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      // Fallback to original format
      expiryDate = new Date(dateString);
    }
    
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (isActive: boolean, endDate: string) => {
    if (!isActive) return 'bg-red-100 text-red-800';
    
    const daysUntilExpiry = getDaysUntilExpiry(endDate);
    if (daysUntilExpiry < 0) return 'bg-red-100 text-red-800';
    if (daysUntilExpiry <= 7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (isActive: boolean, endDate: string) => {
    if (!isActive) return 'Inactive';
    
    const daysUntilExpiry = getDaysUntilExpiry(endDate);
    if (daysUntilExpiry < 0) return 'Expired';
    if (daysUntilExpiry === 0) return 'Expires Today';
    if (daysUntilExpiry === 1) return 'Expires Tomorrow';
    if (daysUntilExpiry <= 7) return `Expires in ${daysUntilExpiry} days`;
    return 'Active';
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Subscriptions</h1>
          <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            Manage and access your subscription credentials
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {subscriptions.length === 0 ? (
          <div className={`text-center py-12 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="text-6xl mb-4">📱</div>
            <h2 className="text-2xl font-bold mb-2">No Subscriptions Found</h2>
            <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              You don't have any active subscriptions yet. Visit the shop to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.account_id}
                className={`rounded-lg shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}
              >
                {/* Service Image */}
                <div className="relative h-48 overflow-hidden">
                  {subscription.service_image && subscription.service_image.trim().startsWith('<svg') ? (
                    <div
                      className="service-logo mx-auto h-48 w-48"
                      dangerouslySetInnerHTML={{ __html: subscription.service_image }}
                    />
                  ) : (
                    <img src={subscription.service_image} alt={subscription.service_name} className="service-logo mx-auto h-48 w-48"/>
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
                  <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    Expires: {formatDate(subscription.end_date)}
                  </p>

                  {/* Credentials Section */}
                  {subscription.is_active ? (
                    <div className="space-y-4">
                      <button
                        onClick={() => toggleCredentials(subscription.account_id)}
                        className={`w-full flex items-center justify-between px-4 py-2 rounded-lg font-medium transition-colors ${
                          theme === 'dark' 
                            ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        }`}
                      >
                        <span>View Credentials</span>
                        <svg
                          className={`w-5 h-5 transition-transform ${showCredentials[subscription.account_id] ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showCredentials[subscription.account_id] && (
                        <div className="space-y-3">
                          {/* Account ID */}
                          <div>
                            <label className="block text-sm font-medium mb-1">Account ID</label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={subscription.account_id}
                                readOnly
                                className={`flex-1 px-3 py-2 rounded border transition-colors ${
                                  theme === 'dark' 
                                    ? 'border-gray-600 bg-gray-700 text-white' 
                                    : 'border-gray-300 bg-gray-50 text-gray-900'
                                }`}
                              />
                              <button
                                onClick={() => copyToClipboard(subscription.account_id, 'Account ID')}
                                className={`px-3 py-2 rounded transition-colors ${
                                  theme === 'dark' 
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                                title="Copy Account ID"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Password */}
                          <div>
                            <label className="block text-sm font-medium mb-1">Password</label>
                            <div className="flex items-center space-x-2">
                              <div className="relative flex-1">
                                <input
                                  type={showPasswords[subscription.account_id] ? "text" : "password"}
                                  value={subscription.password}
                                  readOnly
                                  className={`w-full px-3 py-2 pr-10 rounded border transition-colors ${
                                    theme === 'dark' 
                                      ? 'border-gray-600 bg-gray-700 text-white' 
                                      : 'border-gray-300 bg-gray-50 text-gray-900'
                                  }`}
                                />
                                <button
                                  onClick={() => togglePassword(subscription.account_id)}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                  title={showPasswords[subscription.account_id] ? "Hide password" : "Show password"}
                                >
                                  {showPasswords[subscription.account_id] ? (
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
                              <button
                                onClick={() => copyToClipboard(subscription.password, 'Password')}
                                className={`px-3 py-2 rounded transition-colors ${
                                  theme === 'dark' 
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                                title="Copy Password"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        This subscription is currently inactive
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
