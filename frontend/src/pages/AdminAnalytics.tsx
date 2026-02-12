import React from 'react';
import AnalyticsDashboard from '../features/admin/components/AnalyticsDashboard';

export default function AdminAnalytics() {
  return (
    <div className="flex-1 py-8 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-8 glass-panel rounded-2xl p-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Analytics</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Track successful platform interactions and filter event activity.
          </p>
        </div>
        <AnalyticsDashboard />
      </div>
    </div>
  );
}
