import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useApi } from './hooks/useApi';
import { getValidToken } from './utils/auth';
import { config } from './config';

interface Service {
  name: string;
  image: string;
  available_accounts: number;
  total_accounts: number;
  available: Array<{
    id: string;
    days_until_expiry: number;
    end_date: string;
  }>;
}

interface CurrentSubscription {
  service_name: string;
  service_image: string;
  account_id: string;
  password: string;
  end_date: string;
  is_active: boolean;
}

const Shop: React.FC = () => {
  const { user } = useAuth();
  const { callApi } = useApi();
  const [services, setServices] = useState<Service[]>([]);
  const [currentSubscriptions, setCurrentSubscriptions] = useState<CurrentSubscription[]>([]);
  const [selectedDuration, setSelectedDuration] = useState('7days');
  const [purchasing, setPurchasing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [servicesData, subscriptionsData] = await Promise.all([
        callApi<{ services: Service[] }>(`${config.getApiUrl()}/services`),
        callApi<{ subscriptions: CurrentSubscription[] }>(`${config.getApiUrl()}/subscriptions`)
      ]);
      
      setServices(servicesData.services);
      setCurrentSubscriptions(subscriptionsData.subscriptions);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user has a subscription for a service
  const hasSubscription = (serviceName: string) => {
    return currentSubscriptions.some(sub => sub.service_name === serviceName);
  };

  // Get current subscription info for a service
  const getCurrentSubscriptionInfo = (serviceName: string) => {
    return currentSubscriptions.find(sub => sub.service_name === serviceName);
  };

  // Helper function to parse dd/mm/yyyy dates
  const parseDate = (dateString: string): Date => {
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return new Date(dateString);
  };

  // Get available duration options for a service based on account expiry dates and existing subscription
  const getAvailableDurations = (service: Service) => {
    const currentSub = getCurrentSubscriptionInfo(service.name);
    
    if (!currentSub) {
      // New subscription - check account expiry dates
      const today = new Date();
      let maxAvailableDays = 0;
      
      service.available.forEach(account => {
        const accountEndDate = parseDate(account.end_date);
        const daysUntilExpiry = Math.floor((accountEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry > maxAvailableDays) {
          maxAvailableDays = daysUntilExpiry;
        }
      });
      
      // Define all possible duration options with their days
      const allDurations = [
        { value: '7days', label: '7 Days', days: 7 },
        { value: '1month', label: '1 Month', days: 30 },
        { value: '3months', label: '3 Months', days: 90 },
        { value: '6months', label: '6 Months', days: 180 },
        { value: '1year', label: '1 Year', days: 365 }
      ];
      
      return allDurations.filter(duration => duration.days <= maxAvailableDays);
    }
    
    // Existing subscription - check extension possibilities
    const currentEndDate = parseDate(currentSub.end_date);
    const today = new Date();
    
    // Find the latest possible end date from available accounts
    let maxPossibleEndDate = currentEndDate;
    
    service.available.forEach(account => {
      const accountEndDate = parseDate(account.end_date);
      if (accountEndDate > maxPossibleEndDate) {
        maxPossibleEndDate = accountEndDate;
      }
    });
    
    const maxAdditionalDays = Math.floor((maxPossibleEndDate.getTime() - currentEndDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Define all possible duration options with their days
    const allDurations = [
      { value: '7days', label: '7 Days', days: 7 },
      { value: '1month', label: '1 Month', days: 30 },
      { value: '3months', label: '3 Months', days: 90 },
      { value: '6months', label: '6 Months', days: 180 },
      { value: '1year', label: '1 Year', days: 365 }
    ];
    
    if (maxAdditionalDays <= 0) {
      return []; // No extension possible
    }

    // Filter duration options that are within the possible extension range
    return allDurations
      .filter(duration => duration.days <= maxAdditionalDays)
      .map(duration => ({
        ...duration,
        label: `${duration.label} (Extension)`,
        extension: true
      }));
  };

  const handlePurchase = async (serviceName: string) => {
    if (!user) return;

    setPurchasing(true);
    try {
      const result = await callApi<{
        message: string;
        credits: number;
        cost: number;
        extension?: boolean;
        new_end_date?: string;
      }>(`${config.getApiUrl()}/purchase-subscription`, {
        method: 'POST',
        body: JSON.stringify({
          service_name: serviceName,
          duration: selectedDuration
        })
      });

      const messageText = result.extension 
        ? `${result.message} - New end date: ${result.new_end_date} - Credits: ${result.cost} deducted, ${result.credits} remaining`
        : `${result.message} - Credits: ${result.cost} deducted, ${result.credits} remaining`;

      setMessage({
        type: 'success',
        text: messageText
      });
      // Refresh subscriptions
      fetchData();
      setSelectedDuration("7days");
    } catch (error) {
      console.error('Error purchasing subscription:', error);
      setMessage({
        type: 'error',
        text: 'Purchase failed. Please try again.'
      });
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Subscription Shop
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Choose from our premium services and select your preferred duration
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-md ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {message.type === 'success' ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm ${
                  message.type === 'success' 
                    ? 'text-green-800 dark:text-green-200' 
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  {message.text}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setMessage(null)}
                  className={`inline-flex ${
                    message.type === 'success' 
                      ? 'text-green-400 hover:text-green-500' 
                      : 'text-red-400 hover:text-red-500'
                  }`}
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => {
            const availableDurations = getAvailableDurations(service);
            const hasAvailableOptions = availableDurations.length > 0;
            const hasExistingSubscription = hasSubscription(service.name);
            const currentSubInfo = getCurrentSubscriptionInfo(service.name);
            
            return (
              <div key={service.name} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* Service Image */}
                <div className="relative h-48">
                  {service.image && service.image.trim().startsWith('<svg') ? (
                    <div
                      className="service-logo h-48 w-full mx-auto object-cover bg-[ghostwhite]"
                      dangerouslySetInnerHTML={{ __html: service.image }}
                    />
                  ) : (
                    <img src={service.image} alt={service.name} className="service-logo h-48 w-full mx-auto object-cover bg-[ghostwhite]"/>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      {service.available_accounts} Available
                    </span>
                    {hasExistingSubscription && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Active Subscription
                      </span>
                    )}
                  </div>
                </div>

                {/* Service Info */}
                <div className="p-4">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {service.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {service.available_accounts} of {service.total_accounts} accounts available
                  </p>

                  {/* Current Subscription Info */}
                  {hasExistingSubscription && currentSubInfo && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Your Current Subscription:
                      </p>
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        <div>Account ID: {currentSubInfo.account_id}</div>
                        <div>Expires: {currentSubInfo.end_date}</div>
                        <div className="mt-2 text-blue-600 dark:text-blue-400">
                          <strong>Extension will add to your current subscription</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Duration Selection */}
                  {hasAvailableOptions && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {hasExistingSubscription ? 'Select Extension Duration:' : 'Select Duration:'}
                      </label>
                      <select
                        value={selectedDuration}
                        onChange={(e) => setSelectedDuration(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {availableDurations.map((duration) => (
                          <option key={duration.value} value={duration.value}>
                            {duration.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Purchase/Extension Button */}
                  <button
                    onClick={() => handlePurchase(service.name)}
                    disabled={purchasing || !hasAvailableOptions}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {purchasing ? 'Processing...' : !hasAvailableOptions ? 'No Options Available' : hasExistingSubscription ? 'Extend Subscription' : 'Purchase Subscription'}
                  </button>

                  {/* No Options Available Message */}
                  {!hasAvailableOptions && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {hasExistingSubscription 
                          ? "No extension options available for this subscription at this time."
                          : "No duration options available for this service at this time."
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {services.length === 0 && !loading && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No services available
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Check back later for new services.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Shop;
