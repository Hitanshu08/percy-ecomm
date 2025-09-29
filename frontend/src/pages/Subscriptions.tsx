import React, { useEffect, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { getSubscriptions } from "../lib/apiClient";
import { Button } from "../components/ui";
import Spinner from "../components/feedback/Spinner";
import SubscriptionCard from "../components/subscriptions/SubscriptionCard";
import type { SubscriptionItem, AccountCredential } from "../components/subscriptions/SubscriptionCard";

export default function Subscriptions() {
  const { theme } = useTheme();
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
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
      const raw = (data as { subscriptions: any[] }).subscriptions || [];
      // If backend already grouped by service with accounts array
      if (raw.length > 0 && Array.isArray(raw[0]?.accounts)) {
        const items: SubscriptionItem[] = raw.map((r: any) => ({
          service_name: String(r.service_name || ''),
          service_image: String(r.service_image || ''),
          end_date: String(r.end_date || ''),
          is_active: Boolean(r.is_active),
          accounts: (Array.isArray(r.accounts) ? r.accounts : []).map((a: any) => ({
            subscription_id: a.subscription_id,
            account_id: String(a.account_id || ''),
            account_password: String(a.account_password || ''),
            end_date: String(a.end_date || ''),
            is_active: Boolean(a.is_active),
          })) as AccountCredential[],
        }));
        setSubscriptions(items);
      } else {
        // Fallback: flat list of subscriptions -> group by service
        const grouped = Object.values(
          (raw as any[]).reduce((acc, sub) => {
            const key = String(sub.service_name || '');
            const cred: AccountCredential = {
              subscription_id: sub.subscription_id,
              account_id: String(sub.account_id || ''),
              account_password: String(sub.account_password || ''),
              end_date: String(sub.end_date || ''),
              is_active: Boolean(sub.is_active),
            };
            if (!acc[key]) {
              acc[key] = {
                service_name: key,
                service_image: String(sub.service_image || ''),
                end_date: String(sub.end_date || ''),
                is_active: Boolean(sub.is_active),
                accounts: [cred],
              } as SubscriptionItem;
            } else {
              const existing = acc[key] as SubscriptionItem;
              existing.accounts.push(cred);
              // choose latest end_date
              try {
                const [d1,m1,y1] = existing.end_date.includes('/') ? existing.end_date.split('/') : ['0','0','0'];
                const [d2,m2,y2] = (sub.end_date || '').includes('/') ? String(sub.end_date).split('/') : ['0','0','0'];
                const a = new Date(parseInt(y1), parseInt(m1)-1, parseInt(d1));
                const b = new Date(parseInt(y2), parseInt(m2)-1, parseInt(d2));
                if (b > a) existing.end_date = String(sub.end_date || '');
              } catch {}
              if (Boolean(sub.is_active)) existing.is_active = true;
            }
            return acc;
          }, {} as { [k: string]: SubscriptionItem })
        ) as SubscriptionItem[];
        setSubscriptions(grouped);
      }
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
      <Spinner />
    );
  }

  return (
    <div className={`flex-1 p-4 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
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
            {subscriptions.map((item) => (
              <SubscriptionCard
                key={item.service_name}
                subscription={item}
                theme={theme}
                formatDate={formatDate}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
                showCredentials={!!showCredentials[item.service_name]}
                onToggleCredentials={() => toggleCredentials(item.service_name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
