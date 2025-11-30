import configData from './config.json';

interface Config {
  app: {
    name: string;
    version: string;
    description: string;
  };
  api: {
    base_url: string;
    timeout: number;
    retry_attempts: number;
    retry_delay: number;
  };
  credits: {
    credit_rate: number;
    daily_credit_rate: number;
    admin_starting_credits: number;
    usd_to_credits_rate: number;
  };
  subscription_durations: {
    [key: string]: {
      name: string;
      days: number;
      credits_cost: number;
    };
  };
  contact: {
    telegram: string;
  };
}

class ConfigManager {
  private config: Config;

  constructor() {
    this.config = configData as Config;
    this.overrideWithEnv();
  }

  private overrideWithEnv(): void {
    // Override API base URL with environment variable if available
    if (import.meta.env.VITE_API_BASE_URL) {
      this.config.api.base_url = import.meta.env.VITE_API_BASE_URL;
    }
  }

  getAppConfig() {
    return this.config.app;
  }

  getApiConfig() {
    return this.config.api;
  }

  getCreditsConfig() {
    return this.config.credits;
  }

  getSubscriptionDurations() {
    return this.config.subscription_durations;
  }

  getContactConfig() {
    return this.config.contact;
  }

  getApiUrl(): string {
    return this.config.api.base_url;
  }

  get<T = any>(key: string, defaultValue?: T): T {
    const keys = key.split('.');
    let value: any = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue as T;
      }
    }

    return value as T;
  }

  // Navigation functions
  getNavigationItems() {
    return [
      { path: '/dashboard', label: 'Dashboard', icon: 'home' },
      { path: '/profile', label: 'Profile', icon: 'user' },
      { path: '/wallet', label: 'Wallet', icon: 'wallet' },
      { path: '/shop', label: 'Shop', icon: 'shopping' },
      { path: '/subscriptions', label: 'Subscriptions', icon: 'subscription' },
      { path: '/giveaway', label: 'Giveaway', icon: 'gift' },
      { path: '/contact', label: 'Contact', icon: 'contact' }
    ];
  }

  getAdminNavigationItems() {
    return [
      { path: '/admin', label: 'Admin', icon: 'admin' }
    ];
  }

  // Feature flags
  isFeatureEnabled(feature: string): boolean {
    const features: { [key: string]: boolean } = {
      notifications: false,
      wallet: true,
      subscriptions: true,
      admin_panel: true,
      user_profile: true,
      password_change: true,
      contact_page: true,
      shop: true
    };
    return features[feature] || false;
  }

  // Utility functions
  getTelegramUrl(): string {
    return this.config.contact.telegram;
  }

  getUsdToCreditsRate(): number {
    return this.config.credits.usd_to_credits_rate;
  }
}

export const config = new ConfigManager();
export default config; 