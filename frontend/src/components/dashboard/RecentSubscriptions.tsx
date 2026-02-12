import React from 'react';

export interface RecentSubscriptionItem {
  service_name: string;
  service_image: string;
  end_date: string;
  is_active: boolean;
}

interface RecentSubscriptionsProps {
  title?: string;
  items: RecentSubscriptionItem[];
  onFormatDate?: (dateString: string) => string;
  linkHref?: string;
}

const RecentSubscriptions: React.FC<RecentSubscriptionsProps> = ({
  title = 'Recent Subscriptions',
  items,
  onFormatDate,
  linkHref = '/subscriptions',
}) => {
  const formatDate = (dateString: string) => {
    if (onFormatDate) return onFormatDate(dateString);
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString();
    }
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="glass-panel rounded-2xl border border-white/40 dark:border-slate-500/30">
      <div className="px-6 py-4 border-b border-white/35 dark:border-slate-500/30 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        <a
          href={linkHref}
          className="inline-flex items-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          aria-label="Go to Subscriptions"
          title="Go to Subscriptions"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-gray-600 dark:text-gray-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
      </div>
      <div className="p-4">
        {(!items || items.length === 0) ? (
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
            {items.map((subscription, index) => (
              <div key={index} className="glass-panel-soft rounded-xl p-4 border border-white/40 dark:border-slate-500/30">
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
      </div>
    </div>
  );
};

export default RecentSubscriptions;


