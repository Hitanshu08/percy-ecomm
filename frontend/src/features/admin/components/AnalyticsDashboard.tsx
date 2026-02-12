import React, { useEffect, useMemo, useState } from 'react';
import {
  AdminAnalyticsEvent,
  AdminAnalyticsFilters,
  AdminAnalyticsResponse,
  getAdminAnalyticsEvents,
} from '../../../lib/apiClient';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

const DEFAULT_FILTERS: AdminAnalyticsFilters = {
  event_type: '',
  status: 'success',
  user_query: '',
  start_date: '',
  end_date: '',
};

const EVENT_TYPES = [
  { value: '', label: 'All events' },
  { value: 'subscription_purchase', label: 'Subscription Purchase' },
  { value: 'wallet_add_credit', label: 'Wallet Add Credit' },
  { value: 'admin_add_credit', label: 'Admin Add Credit' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'success', label: 'Success' },
];

function formatEventType(eventType: string): string {
  return eventType
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function formatDateTime(value: string): string {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
}

function renderDetails(details: Record<string, unknown>): string {
  const entries = Object.entries(details || {});
  if (!entries.length) return '-';
  return entries
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' | ');
}

function getUserFromEvent(event: AdminAnalyticsEvent): string {
  const target = (event.target_username || '').trim();
  const actor = (event.actor_username || '').trim();
  return target || actor || '-';
}

function renderEventDetails(event: AdminAnalyticsEvent): string {
  const details = renderDetails(event.details || {});
  const source = (event.source || '').trim();
  if (source && details !== '-') {
    return `source: ${source} | ${details}`;
  }
  if (source) {
    return `source: ${source}`;
  }
  return details;
}

export default function AnalyticsDashboard() {
  const [events, setEvents] = useState<AdminAnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summaryByType, setSummaryByType] = useState<Record<string, number>>({});
  const [draftFilters, setDraftFilters] = useState<AdminAnalyticsFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AdminAnalyticsFilters>(DEFAULT_FILTERS);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const response: AdminAnalyticsResponse = await getAdminAnalyticsEvents({
          ...appliedFilters,
          page,
          size: pageSize,
        });
        if (cancelled) return;
        setEvents(response.events || []);
        setTotal(typeof response.total === 'number' ? response.total : 0);
        setTotalPages(Math.max(1, Number(response.total_pages || 1)));
        setSummaryByType(response.summary?.by_type || {});
      } catch (error: any) {
        if (cancelled) return;
        setEvents([]);
        setTotal(0);
        setTotalPages(1);
        setSummaryByType({});
        setErrorMessage(error?.message || 'Failed to load analytics events');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, [appliedFilters, page, pageSize]);

  const summaryItems = useMemo(
    () => Object.entries(summaryByType).sort((a, b) => b[1] - a[1]),
    [summaryByType]
  );

  const onApplyFilters = () => {
    setPage(1);
    setAppliedFilters({ ...draftFilters });
  };

  const onResetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPageSize(DEFAULT_PAGE_SIZE);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Analytics Filters</h2>
          <button
            onClick={() => setFiltersExpanded((prev) => !prev)}
            className="glass-btn-secondary px-3 py-1.5 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors"
          >
            {filtersExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {filtersExpanded && (
          <>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="analytics-filter-event" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Event
                </label>
                <select
                  id="analytics-filter-event"
                  value={draftFilters.event_type || ''}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, event_type: e.target.value }))}
                  className="glass-field px-3 py-2 rounded-md text-sm"
                >
                  {EVENT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="analytics-filter-user" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Username or Email
                </label>
                <input
                  id="analytics-filter-user"
                  type="text"
                  value={draftFilters.user_query || ''}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, user_query: e.target.value }))}
                  placeholder="Search by username or email"
                  className="glass-field px-3 py-2 rounded-md text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="analytics-filter-status" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status
                </label>
                <select
                  id="analytics-filter-status"
                  value={draftFilters.status || ''}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, status: e.target.value }))}
                  className="glass-field px-3 py-2 rounded-md text-sm"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="analytics-filter-start-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Start Date
                </label>
                <input
                  id="analytics-filter-start-date"
                  type="date"
                  value={draftFilters.start_date || ''}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, start_date: e.target.value }))}
                  className="glass-field px-3 py-2 rounded-md text-sm dark:[color-scheme:dark]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="analytics-filter-end-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  End Date
                </label>
                <input
                  id="analytics-filter-end-date"
                  type="date"
                  value={draftFilters.end_date || ''}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, end_date: e.target.value }))}
                  className="glass-field px-3 py-2 rounded-md text-sm dark:[color-scheme:dark]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="analytics-filter-page-size" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Page Size
                </label>
                <select
                  id="analytics-filter-page-size"
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="glass-field px-3 py-2 rounded-md text-sm"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={onApplyFilters}
                className="px-3 py-2 bg-blue-600/90 text-white rounded-md hover:bg-blue-700 text-sm transition-colors"
              >
                Apply Filters
              </button>
              <button
                onClick={onResetFilters}
                className="glass-btn-secondary px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors"
              >
                Reset
              </button>
            </div>
          </>
        )}
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Event Summary</h2>
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">Total events: {total}</div>
        {summaryItems.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">No event data available for selected filters.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {summaryItems.map(([eventType, count]) => (
              <div
                key={eventType}
                className="glass-panel-soft px-3 py-2 rounded-xl text-sm text-gray-700 dark:text-gray-200"
              >
                {formatEventType(eventType)}: <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel rounded-2xl">
        <div className="px-4 py-3 border-b border-white/40 dark:border-slate-500/30">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Analytics Events</h2>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading analytics events...</div>
          ) : errorMessage ? (
            <div className="text-sm text-red-600 dark:text-red-400">{errorMessage}</div>
          ) : events.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No events found for selected filters.</div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {events.map((event) => (
                  <div
                    key={String(event.id)}
                    className="glass-panel-soft rounded-xl p-3 text-sm border border-white/40 dark:border-slate-500/30"
                  >
                    <div className="grid grid-cols-1 gap-2">
                      <div className="text-gray-700 dark:text-gray-200">
                        <span className="font-medium">User:</span> {getUserFromEvent(event)}
                      </div>
                      <div className="text-gray-700 dark:text-gray-200">
                        <span className="font-medium">Event:</span> {formatEventType(event.event_type)}
                      </div>
                      <div className="text-gray-700 dark:text-gray-200">
                        <span className="font-medium">Status:</span>{' '}
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300">
                          {event.status || '-'}
                        </span>
                      </div>
                      <div className="text-gray-700 dark:text-gray-200">
                        <span className="font-medium">Time:</span> {formatDateTime(event.created_at)}
                      </div>
                      <div className="text-gray-600 dark:text-gray-300 break-words">
                        <span className="font-medium text-gray-700 dark:text-gray-200">Details:</span>{' '}
                        {renderEventDetails(event)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-300 border-b border-white/40 dark:border-slate-500/30">
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Event</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={String(event.id)} className="border-b border-white/30 dark:border-slate-500/20 align-top hover:bg-white/30 dark:hover:bg-slate-900/30">
                        <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{getUserFromEvent(event)}</td>
                        <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{formatEventType(event.event_type)}</td>
                        <td className="py-2 pr-3">
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300">
                            {event.status || '-'}
                          </span>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap text-gray-700 dark:text-gray-200">
                          {formatDateTime(event.created_at)}
                        </td>
                        <td className="py-2 text-gray-600 dark:text-gray-300 break-words max-w-[460px]">
                          {renderEventDetails(event)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="px-4 py-3 border-t border-white/40 dark:border-slate-500/30 flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-300">
            Page {page} of {totalPages} • {total} items
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="glass-btn-secondary px-3 py-1 rounded disabled:opacity-50 text-gray-700 dark:text-gray-200"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="glass-btn-secondary px-3 py-1 rounded disabled:opacity-50 text-gray-700 dark:text-gray-200"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
