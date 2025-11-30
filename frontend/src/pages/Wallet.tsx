import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getWallet, createWalletPayment, createPaypalOrder, capturePaypalOrder, createRazorpayOrder, verifyRazorpayPayment, verifyRazorpayPaymentLink } from '../lib/apiClient';
import { config } from '../config/index';
import { Button } from '../components/ui';
import { Spinner, Modal } from '../components/feedback';
import { WalletCard } from '../features/wallet/components';

// Declare Razorpay types
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface WalletData {
  credits: number;
}

export default function Wallet() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [provider, setProvider] = useState<'nowpayments' | 'paypal' | 'razorpay'>('paypal');
  const [selectedBundle, setSelectedBundle] = useState<'1'|'2'|'5'|'10'|'20'|'50' | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalMessage, setModalMessage] = useState<string | undefined>(undefined);

  const openModal = (title?: string, message?: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalOpen(true);
  };

  useEffect(() => {
    fetchWalletData();
    handlePayPalReturn();
    handleRazorpayReturn();
    loadRazorpayScript();
  }, []);

  const loadRazorpayScript = () => {
    if (window.Razorpay) {
      return; // Already loaded
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

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

  const handlePayPalReturn = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const paypalStatus = urlParams.get('paypal');
    
    if (paypalStatus === 'success' && token) {
      try {
        setLoading(true);
        const result = await capturePaypalOrder(token);
        if ((result as any)?.status === 'success') {
          openModal('Payment Successful', (result as any)?.message || 'Credits added to your wallet.');
          await fetchWalletData();
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (error) {
        console.error('PayPal capture error:', error);
        openModal('Payment Error', 'Failed to process payment. Please contact support.');
      } finally {
        setLoading(false);
      }
    } else if (paypalStatus === 'cancel') {
      openModal('Payment Cancelled', 'Payment was cancelled.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleRazorpayReturn = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const razorpayStatus = urlParams.get('razorpay');
    const orderId = urlParams.get('razorpay_order_id');
    const paymentId = urlParams.get('razorpay_payment_id');
    const signature = urlParams.get('razorpay_signature');
    const paymentLinkId = urlParams.get('razorpay_payment_link_id');
    
    // Handle Payment Link return (different parameters)
    if (razorpayStatus === 'success' && paymentLinkId && paymentId) {
      try {
        setLoading(true);
        const result = await verifyRazorpayPaymentLink(paymentLinkId, paymentId);
        if ((result as any)?.status === 'success') {
          openModal('Payment Successful', (result as any)?.message || 'Credits added to your wallet.');
          await fetchWalletData();
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          openModal('Payment Pending', (result as any)?.message || 'Payment is being processed. Credits will be added shortly.');
        }
      } catch (error) {
        console.error('Razorpay Payment Link verification error:', error);
        openModal('Payment Error', 'Failed to process payment. Please contact support.');
      } finally {
        setLoading(false);
      }
    }
    // Handle standard order return
    else if (razorpayStatus === 'success' && orderId && paymentId && signature) {
      try {
        setLoading(true);
        const result = await verifyRazorpayPayment(orderId, paymentId, signature);
        if ((result as any)?.status === 'success') {
          openModal('Payment Successful', (result as any)?.message || 'Credits added to your wallet.');
          await fetchWalletData();
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (error) {
        console.error('Razorpay verification error:', error);
        openModal('Payment Error', 'Failed to process payment. Please contact support.');
      } finally {
        setLoading(false);
      }
    } else if (razorpayStatus === 'cancel') {
      openModal('Payment Cancelled', 'Payment was cancelled.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const bundles: Array<{ label: string; sub?: string; bundle: '1'|'2'|'5'|'10'|'20'|'50' }> = [
    { label: '$1', sub: '1 credit', bundle: '1' },
    { label: '$2', sub: '2 credits', bundle: '2' },
    { label: '$5', sub: '5 credits', bundle: '5' },
    { label: '$10', sub: '10 credits', bundle: '10' },
    { label: '$20', sub: '21 credits', bundle: '20' },
    { label: '$50', sub: '52 credits', bundle: '50' },
  ];

  const startPayment = async (bundle: '1'|'2'|'5'|'10'|'20'|'50') => {
    try {
      setCreating(bundle);
      if (provider === 'paypal') {
        const resp = await createPaypalOrder(bundle);
        const url = (resp as any)?.approve_url;
        if (url) {
          window.location.href = url;
          return;
        }
      } else if (provider === 'razorpay') {
        // Use Payment Links by default (no domain registration needed)
        const resp = await createRazorpayOrder(bundle, true);
        const paymentData = resp as any;
        
        // If payment link is returned, redirect to it
        if (paymentData.short_url) {
          window.location.href = paymentData.short_url;
          return;
        }
        
        // Fallback to embedded checkout if payment link not available
        const orderData = paymentData;
        
        if (!window.Razorpay) {
          openModal('Payment Error', 'Razorpay SDK not loaded. Please refresh the page.');
          return;
        }
        
        // Get current origin for callback URLs
        const currentOrigin = window.location.origin;
        
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'DrogoLabs',
          description: `Wallet top-up: ${orderData.credits} credits`,
          order_id: orderData.order_id,
          image: '', // Optional: Add your logo URL here
          callback_url: `${currentOrigin}/wallet?razorpay=success`,
          redirect: true, // Enable redirect after payment
          handler: async function(response: any) {
            try {
              setLoading(true);
              const verifyResult = await verifyRazorpayPayment(
                response.razorpay_order_id,
                response.razorpay_payment_id,
                response.razorpay_signature
              );
              if ((verifyResult as any)?.status === 'success') {
                openModal('Payment Successful', (verifyResult as any)?.message || 'Credits added to your wallet.');
                await fetchWalletData();
              } else {
                openModal('Payment Error', 'Payment verification failed.');
              }
            } catch (error: any) {
              console.error('Razorpay verification error:', error);
              const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to verify payment. Please contact support.';
              openModal('Payment Error', errorMsg);
            } finally {
              setLoading(false);
              setCreating(null);
            }
          },
          prefill: {
            name: user?.username || '',
            email: user?.email || '',
          },
          theme: {
            color: '#3B82F6',
          },
          modal: {
            ondismiss: function() {
              setCreating(null);
            }
          },
          notes: {
            order_from: 'wallet_topup'
          }
        };
        
        const razorpay = new window.Razorpay(options);
        
        // Handle payment failures
        razorpay.on('payment.failed', function(response: any) {
          console.error('Razorpay payment failed:', response);
          const errorCode = response.error?.code;
          const errorDescription = response.error?.description || response.error?.reason || 'Payment failed';
          
          let errorMessage = `Payment could not be completed: ${errorDescription}`;
          
          // Specific error message for website mismatch
          if (errorCode === 'BAD_REQUEST_ERROR' && errorDescription?.includes('website does not match')) {
            errorMessage = 'Payment blocked: Website domain not registered in Razorpay. Please contact support or register your domain in Razorpay Dashboard > Settings > Website & App Settings.';
          }
          
          openModal('Payment Failed', errorMessage);
          setCreating(null);
        });
        
        razorpay.open();
        return;
      } else {
        const resp = await createWalletPayment(bundle);
        const url = (resp as any)?.checkout_url;
        if (url) {
          window.location.href = url;
          return;
        }
      }
      openModal('Payment Error', 'Failed to start payment. Please try again.');
    } catch (e) {
      console.error(e);
      openModal('Payment Error', 'Failed to start payment.');
    } finally {
      setCreating(null);
    }
  }

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
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
          <p className="text-gray-700 dark:text-gray-200">{modalMessage}</p>
        </Modal>
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
                Instant top-ups via UPI, Crypto, Visa/Mastercard & Manual PayPal. Contact us on Telegram to purchase credits
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
                {/* <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Conversion Rate
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Approximate conversion rates: 1 USD = {config.getUsdToCreditsRate()} Credits
                </p> */}
              </div>

              {/* Provider toggle */}
              <div className="mb-4 flex gap-3">
                <button
                  onClick={() => setProvider('paypal')}
                  className={`px-3 py-2 rounded border transition ${
                    provider === 'paypal'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  PayPal (Other than India)
                </button>
                <button
                  onClick={() => setProvider('razorpay')}
                  className={`px-3 py-2 rounded border transition ${
                    provider === 'razorpay'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  Razorpay (India)
                </button>
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

              {/* Buy Credits */}
              <div className="mt-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Add Credits
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {bundles.map(({ label, sub, bundle }) => (
                    <button
                      key={bundle}
                      onClick={() => setSelectedBundle(bundle)}
                      disabled={creating !== null}
                      className={`w-full border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-60 ${selectedBundle===bundle ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">{label}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{sub}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={async () => {
                      if (!selectedBundle) {
                        openModal('Select amount', 'Please select an amount to continue.');
                        return;
                      }
                      await startPayment(selectedBundle);
                    }}
                    disabled={!selectedBundle || creating !== null}
                    variant="primary"
                  >
                    {creating ? 'Processing…' : provider === 'razorpay' ? 'Pay with Razorpay (India)' : 'Continue to PayPal (Other than India)'}
                  </Button>
                </div>
              </div>

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
