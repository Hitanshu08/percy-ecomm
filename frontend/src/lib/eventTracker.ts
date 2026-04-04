import { createAnalyticsEvent } from './apiClient';

type EventType = 'page_load' | 'button_click' | 'credit_add' | 'purchase';

interface TrackOptions {
  source?: string;
  details?: Record<string, unknown>;
}

function fire(eventType: EventType, opts: TrackOptions = {}) {
  createAnalyticsEvent({
    event_type: eventType,
    source: opts.source ?? 'frontend',
    details: opts.details ?? {},
  }).catch(() => {
    // Best-effort: never block the UI for analytics failures
  });
}

export function trackPageLoad(pageName: string, details?: Record<string, unknown>) {
  fire('page_load', {
    details: { page: pageName, url: window.location.pathname, ...details },
  });
}

export function trackButtonClick(buttonName: string, details?: Record<string, unknown>) {
  fire('button_click', {
    details: { button: buttonName, page: window.location.pathname, ...details },
  });
}

export function trackCreditAdd(amount: number, details?: Record<string, unknown>) {
  fire('credit_add', {
    details: { amount, ...details },
  });
}

export function trackPurchase(serviceName: string, duration: string, cost: number, details?: Record<string, unknown>) {
  fire('purchase', {
    details: { service: serviceName, duration, cost, ...details },
  });
}
