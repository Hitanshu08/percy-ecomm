import React, { useState, useEffect } from 'react';
import { getDashboard } from '../lib/apiClient';
import Spinner from '../components/feedback/Spinner';
import StatCard from '../components/dashboard/StatCard';
import Panel from '../components/layout/Panel';

interface DashboardData {
  username: string;
  credits: number;
  active_subscriptions: number;
  total_credits_earned: number;
  recent_subscriptions: Array<{
    service_name: string;
    service_image: string;
    end_date: string;
    is_active: boolean;
    account_id: string;
  }>;
}

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const data = await getDashboard();
        setDashboardData(data as DashboardData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatDate = (dateString: string) => {
    // Handle dd/mm/yyyy format
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString();
    }
    // Fallback to original format
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <Spinner />
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Error loading dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please try refreshing the page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {dashboardData.username}!
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Here's your subscription overview and recent activity
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            title="Available Credits"
            value={(dashboardData.credits || 0).toLocaleString()}
            icon={(
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            )}
            iconBgClass="bg-blue-100 dark:bg-blue-900"
          />
          <StatCard
            title="Active Subscriptions"
            value={dashboardData.active_subscriptions}
            icon={(
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            iconBgClass="bg-green-100 dark:bg-green-900"
          />
          <StatCard
            title="Total Credits Earned"
            value={(dashboardData.total_credits_earned || 0).toLocaleString()}
            icon={(
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            )}
            iconBgClass="bg-purple-100 dark:bg-purple-900"
          />
        </div>

        {/* Recent Subscriptions */}
        <Panel
          title="Recent Subscriptions"
          actions={(
            <a
              href="/subscriptions"
              className="inline-flex items-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Go to Subscriptions"
              title="Go to Subscriptions"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-gray-600 dark:text-gray-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          )}
        >
          {dashboardData.recent_subscriptions.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No subscriptions yet
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by purchasing a subscription from the shop.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {dashboardData.recent_subscriptions.map((subscription, index) => (
                <div key={subscription.service_name} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-full sm:w-auto">
                      {subscription.service_image && subscription.service_image.trim().startsWith('<svg') ? (
                        <div
                          className="service-logo h-20 sm:h-24 w-full sm:w-24 mx-auto object-cover bg-[ghostwhite] rounded"
                          dangerouslySetInnerHTML={{ __html: subscription.service_image }}
                        />
                      ) : (
                        <img
                          src={subscription.service_image}
                          alt={subscription.service_name || 'Service'}
                          className="service-logo h-20 sm:h-24 w-full sm:w-24 mx-auto object-cover bg-[ghostwhite] rounded"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {subscription.service_name}
                      </h3>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Expires: {formatDate(subscription.end_date)}
                      </div>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          subscription.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {subscription.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default Dashboard;
