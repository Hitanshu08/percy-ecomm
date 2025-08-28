import React from 'react';
import { Button, Select } from '../ui';

export interface Service {
  name: string;
  image: string;
  available_accounts: number;
  total_accounts: number;
  max_days_until_expiry: number;
  max_end_date: string;
  credits?: Record<string, number>;
  user_end_date?: string;
}

interface DurationOption {
  value: string;
  label: string;
  days: number;
  credits_cost: number;
  extension: boolean;
}

interface CurrentSubInfo {
  end_date: string;
  total_duration: number;
  last_extension?: string;
}

interface ServiceCardProps {
  service: Service;
  availableDurations: DurationOption[];
  hasExistingSubscription: boolean;
  currentSubInfo: CurrentSubInfo | null;
  selectedDuration: string;
  onChangeDuration: (val: string) => void;
  onPurchase: (serviceName: string) => void;
  purchasing: boolean;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  availableDurations,
  hasExistingSubscription,
  currentSubInfo,
  selectedDuration,
  onChangeDuration,
  onPurchase,
  purchasing,
}) => {
  const hasAvailableOptions = availableDurations.length > 0;
  return (
    <div className="border rounded-md overflow-hidden bg-white dark:bg-gray-800">
      <img src={service.image} alt={service.name} className="h-40 w-full object-cover bg-[ghostwhite]" />
      <div className="p-4 space-y-3">
        <div className="text-lg font-medium text-gray-900 dark:text-white">{service.name}</div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {service.available_accounts} of {service.total_accounts} accounts available
        </p>

        {hasExistingSubscription && currentSubInfo && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Your Current Assignment:</p>
            <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <div><strong>Expires:</strong> {currentSubInfo.end_date}</div>
              {currentSubInfo.last_extension && (
                <div><strong>Last Extended:</strong> {currentSubInfo.last_extension}</div>
              )}
              <div className="mt-2 text-blue-600 dark:text-blue-400">
                <strong>Extension will add to your current subscription</strong>
              </div>
            </div>
          </div>
        )}

        {!hasExistingSubscription && service.available_accounts > 0 && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Account Availability:</p>
            <div className="text-xs text-green-700 dark:text-green-400">
              <div>Max available time: {service.max_days_until_expiry} days</div>
              <div>Account expires: {service.max_end_date}</div>
              <div className="mt-2 text-green-600 dark:text-green-400">
                <strong>You will be assigned to a specific account</strong>
              </div>
            </div>
          </div>
        )}

        {hasAvailableOptions && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {hasExistingSubscription ? 'Select Extension Duration:' : 'Select Duration:'}
            </label>
            <Select value={selectedDuration} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChangeDuration(e.target.value)}>
              {availableDurations.map((duration) => (
                <option key={duration.value} value={duration.value}>
                  {duration.label} - {duration.credits_cost} credits
                </option>
              ))}
            </Select>
          </div>
        )}

        <Button
          onClick={() => onPurchase(service.name)}
          disabled={purchasing || !hasAvailableOptions}
          variant="primary"
          className="w-full"
        >
          {purchasing ? 'Processing...' : !hasAvailableOptions ? 'No Options Available' : hasExistingSubscription ? 'Extend Subscription' : 'Get Account Assignment'}
        </Button>

        {!hasAvailableOptions && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {hasExistingSubscription
                ? 'No extension options available for this subscription at this time.'
                : 'No duration options available for this service at this time.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceCard;


