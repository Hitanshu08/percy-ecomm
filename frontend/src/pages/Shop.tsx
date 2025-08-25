import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../lib/useApi';
import { config } from '../config/index';
import { Button, Select } from '../components/ui';
import { Spinner } from '../components/feedback';

interface Service {
  name: string;
  image: string;
  available_accounts: number;
  total_accounts: number;
  max_days_until_expiry: number;
  max_end_date: string;
  credits?: Record<string, number>;
  user_end_date?: string; // added from backend to determine extension
}

interface UserSubscription {
  service_name: string;
  service_image: string;
  account_id: string;
  account_username: string;
  account_password: string;
  end_date: string;
  is_active: boolean;
  duration: string;
  total_duration: number;
  created_date: string;
  last_extension: string;
  extension_duration: string;
}

const Shop: React.FC = () => {
  const { user } = useAuth();
  const { callApi } = useApi();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedDuration, setSelectedDuration] = useState('7days');
  const [purchasing, setPurchasing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const servicesData = await callApi<{ services: Service[] }>(`${config.getApiUrl()}/services`);
      setServices(servicesData.services);
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load data. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to parse dd/mm/yyyy dates
  const parseDate = (dateString: string): Date => {
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return new Date(dateString);
  };

  // Check if user has a subscription for a service
  const hasSubscription = (serviceName: string) => {
    const svc = services.find(s => s.name === serviceName);
    return Boolean(svc?.user_end_date);
  };

  // Get current subscription info for a service
  const getCurrentSubscriptionInfo = (serviceName: string) => {
    const svc = services.find(s => s.name === serviceName);
    if (!svc || !svc.user_end_date) return null as any;
    return {
      service_name: serviceName,
      service_image: svc.image,
      account_id: '',
      account_username: '',
      account_password: '',
      end_date: svc.user_end_date,
      is_active: true,
      duration: '',
      total_duration: 0,
      created_date: '',
      last_extension: '',
      extension_duration: ''
    } as any;
  };

  // Get available duration options for a service based on account expiry dates and existing subscription
  const getAvailableDurations = (service: Service) => {
    if (service.available_accounts === 0) {
      return [];
    }

    const currentSub = service.user_end_date ? getCurrentSubscriptionInfo(service.name) : null;
    const subscriptionDurations = config.getSubscriptionDurations();
    
    if (currentSub) {
      // Extension logic - user can only extend existing subscription
      const currentEndDate = parseDate(currentSub!.end_date);
      const accountEndDate = parseDate(service.max_end_date);
      const today = new Date();
      
      // Calculate maximum extension days possible
      const maxExtensionDays = Math.floor((accountEndDate.getTime() - currentEndDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (maxExtensionDays <= 0) {
        return []; // No extension possible
      }
      
      // Filter durations that are within the possible extension range
      const availableDurations = Object.entries(subscriptionDurations)
        .filter(([key, duration]) => {
          return duration.days <= maxExtensionDays;
        })
        .map(([key, duration]) => ({
          value: key,
          label: `${duration.name} (Extension)`,
          days: duration.days,
          credits_cost: service.credits?.[key] ?? duration.credits_cost,
          extension: true
        }))
        .sort((a, b) => a.days - b.days);
      
      return availableDurations;
    } else {
      // New subscription logic
      const maxAvailableDays = service.max_days_until_expiry;
      
      // Filter durations that are within the available time range
      const availableDurations = Object.entries(subscriptionDurations)
        .filter(([key, duration]) => {
          return duration.days <= maxAvailableDays;
        })
        .map(([key, duration]) => ({
          value: key,
          label: duration.name,
          days: duration.days,
          credits_cost: service.credits?.[key] ?? duration.credits_cost,
          extension: false
        }))
        .sort((a, b) => a.days - b.days);
      
      return availableDurations;
    }
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

      let messageText = result.message;
      
      if (result.extension) {
        messageText += ` - New end date: ${result.new_end_date} - ${result.cost} credits deducted. Remaining: ${result.credits}`;
      } else {
        messageText += ` - Ends on: ${result.new_end_date} - ${result.cost} credits deducted. Remaining: ${result.credits}`;
      }

      setMessage({
        type: 'success',
        text: messageText
      });
      
      // Refresh data to update availability
      fetchData();
      setSelectedDuration("7days");
    } catch (error: any) {
      console.error('Error purchasing subscription:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Purchase failed. Please try again.'
      });
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <Spinner />
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
            Choose from our premium services and get assigned to specific accounts
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const availableDurations = getAvailableDurations(service);
            const hasAvailableOptions = availableDurations.length > 0;
            const hasExistingSubscription = hasSubscription(service.name);
            const currentSubInfo = getCurrentSubscriptionInfo(service.name);
            
            return (
              <div key={service.name} className="border rounded-md overflow-hidden bg-white dark:bg-gray-800">
                {/* Service Image */}
                <img src={service.image} alt={service.name} className="h-40 w-full object-cover bg-[ghostwhite]" />
                
                {/* Service Info */}
                <div className="p-4 space-y-3">
                  <div className="text-lg font-medium text-gray-900 dark:text-white">{service.name}</div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {service.available_accounts} of {service.total_accounts} accounts available
                  </p>

                  {/* Current Subscription Info */}
                  {hasExistingSubscription && currentSubInfo && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Your Current Assignment:
                      </p>
                      <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                        <div><strong>Expires:</strong> {currentSubInfo.end_date}</div>
                        <div><strong>Total Duration:</strong> {currentSubInfo.total_duration} days</div>
                        {currentSubInfo.last_extension && (
                          <div><strong>Last Extended:</strong> {currentSubInfo.last_extension}</div>
                        )}
                        <div className="mt-2 text-blue-600 dark:text-blue-400">
                          <strong>Extension will add to your current subscription</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Account Availability Info */}
                  {!hasExistingSubscription && service.available_accounts > 0 && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                        Account Availability:
                      </p>
                      <div className="text-xs text-green-700 dark:text-green-400">
                        <div>Max available time: {service.max_days_until_expiry} days</div>
                        <div>Account expires: {service.max_end_date}</div>
                        <div className="mt-2 text-green-600 dark:text-green-400">
                          <strong>You will be assigned to a specific account</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Duration Selection */}
                  {hasAvailableOptions && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {hasExistingSubscription ? 'Select Extension Duration:' : 'Select Duration:'}
                      </label>
                      <Select
                        value={selectedDuration}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDuration(e.target.value)}
                      >
                        {availableDurations.map((duration) => (
                          <option key={duration.value} value={duration.value}>
                            {duration.label} - {duration.credits_cost} credits
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  {/* Purchase/Extension Button */}
                  <Button
                    onClick={() => handlePurchase(service.name)}
                    disabled={purchasing || !hasAvailableOptions}
                    variant="primary"
                    className="w-full"
                  >
                    {purchasing ? 'Processing...' : !hasAvailableOptions ? 'No Options Available' : hasExistingSubscription ? 'Extend Subscription' : 'Get Account Assignment'}
                  </Button>

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-7m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
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
