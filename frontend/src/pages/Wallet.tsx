import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getWallet } from '../lib/apiClient';
import { config } from '../config/index';
import { Button } from '../components/ui';
import { Spinner } from '../components/feedback';
import { WalletCard } from '../features/wallet/components';

interface WalletData {
  credits: number;
}

export default function Wallet() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  // const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const data = await getWallet();
      setWalletData(data as WalletData);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  // const bundles: Array<{ label: string; sub?: string; bundle: '1'|'2'|'5'|'10'|'20'|'50' }> = [
  //   { label: '$1', sub: '1 credit', bundle: '1' },
  //   { label: '$2', sub: '2 credits', bundle: '2' },
  //   { label: '$5', sub: '5 credits', bundle: '5' },
  //   { label: '$10', sub: '10 credits', bundle: '10' },
  //   { label: '$20', sub: '21 credits', bundle: '20' },
  //   { label: '$50', sub: '52 credits', bundle: '50' },
  // ];

  // const startPayment = async (bundle: '1'|'2'|'5'|'10'|'20'|'50') => {
  //   try {
  //     setCreating(bundle);
  //     const resp = await createWalletPayment(bundle);
  //     const url = (resp as any)?.checkout_url;
  //     if (url) {
  //       window.location.href = url;
  //     } else {
  //       alert('Failed to start payment. Please try again.');
  //     }
  //   } catch (e) {
  //     console.error(e);
  //     alert('Failed to start payment.');
  //   } finally {
  //     setCreating(null);
  //   }
  // }

  const handleTelegramClick = () => {
    window.open(config.getTelegramUrl(), '_blank');
  };

  if (loading) {
    return (
      <Spinner />
    );
  }

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Wallet & Credits
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View your credits and conversion rates
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Credits */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Current Credits
                </h3>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                  {walletData?.credits?.toLocaleString() || '0'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Available for purchases
                </p>
              </div>
            </div>

            {/* Contact Support */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mt-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Need to Add Credits?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Contact us on Telegram to purchase credits
                </p>
                <Button
                  onClick={handleTelegramClick}
                  variant="primary"
                  className="w-full"
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  Contact on Telegram
                </Button>
              </div>
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Conversion Rate
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Approximate conversion rates: 1 USD = {config.getUsdToCreditsRate()} Credits
                </p>
              </div>

              {/* Simple Conversion Display */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                    1 USD = {config.getUsdToCreditsRate()} Credits
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Standard conversion rate
                  </p>
                </div>
              </div>

              {/* Buy Credits - temporarily disabled */}
              {/* <div className="mt-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Add Credits
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {bundles.map(({ label, sub, bundle }) => (
                    <button
                      key={bundle}
                      onClick={() => startPayment(bundle)}
                      disabled={creating === bundle}
                      className="w-full border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-60"
                    >
                      <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">{label}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{sub}</div>
                    </button>
                  ))}
                </div>
              </div> */}

              {/* Note */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> 1 USD = 1 credit. $20 gives 21 credits. $50 gives 52 credits.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
