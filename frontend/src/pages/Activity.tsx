import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AdminAnalyticsEvent,
  AdminAnalyticsResponse,
  getAdminAnalyticsEvents,
} from '../lib/apiClient';
import { Spinner } from '../components/feedback';
import { Button, Select } from '../components/ui';

// ── constants ──────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: '', label: 'All Events' },
  { value: 'page_load', label: 'Page Loads' },
  { value: 'button_click', label: 'Button Clicks' },
  { value: 'credit_add', label: 'Credit Adds' },
  { value: 'purchase', label: 'Purchases' },
  { value: 'subscription_purchase', label: 'Subscription Purchase' },
  { value: 'wallet_add_credit', label: 'Wallet Add Credit' },
  { value: 'admin_add_credit', label: 'Admin Add Credit' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'success', label: 'Success' },
];

const STAT_CARDS: { key: string; label: string; color: string; iconPath: string }[] = [
  {
    key: 'page_load',
    label: 'Page Loads',
    color: 'blue',
    iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    key: 'button_click',
    label: 'Button Clicks',
    color: 'purple',
    iconPath: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122',
  },
  {
    key: 'credit_add',
    label: 'Credits Added',
    color: 'green',
    iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1',
  },
  {
    key: 'purchase',
    label: 'Purchases',
    color: 'amber',
    iconPath: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z',
  },
];

const COLOR_MAP: Record<string, { bg: string; text: string; icon: string; badge: string; bar: string }> = {
  blue:   { bg: 'bg-blue-100 dark:bg-blue-900/40',     text: 'text-blue-600 dark:text-blue-400',     icon: 'text-blue-600 dark:text-blue-400',     badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',     bar: 'bg-blue-500' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/40',   text: 'text-purple-600 dark:text-purple-400', icon: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300', bar: 'bg-purple-500' },
  green:  { bg: 'bg-green-100 dark:bg-green-900/40',     text: 'text-green-600 dark:text-green-400',   icon: 'text-green-600 dark:text-green-400',   badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',   bar: 'bg-green-500' },
  amber:  { bg: 'bg-amber-100 dark:bg-amber-900/40',     text: 'text-amber-600 dark:text-amber-400',   icon: 'text-amber-600 dark:text-amber-400',   badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',   bar: 'bg-amber-500' },
};

const BAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
];

// ── helpers ────────────────────────────────────────────────────────────

function formatDateTime(value: string): string {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatEventType(t: string): string {
  return t.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

function renderDetails(details: Record<string, unknown>): React.ReactNode {
  const entries = Object.entries(details || {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
          <span className="font-medium">{k}:</span> {String(v)}
        </span>
      ))}
    </div>
  );
}

function getBadgeColor(eventType: string): string {
  const card = STAT_CARDS.find((c) => c.key === eventType);
  if (card) return COLOR_MAP[card.color]?.badge ?? '';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
}

function getBarColor(eventType: string, idx: number): string {
  const card = STAT_CARDS.find((c) => c.key === eventType);
  if (card) return COLOR_MAP[card.color]?.bar ?? BAR_COLORS[idx % BAR_COLORS.length];
  return BAR_COLORS[idx % BAR_COLORS.length];
}

// ── chart components ───────────────────────────────────────────────────

function HorizontalBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate mr-3">{d.label}</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{d.value.toLocaleString()}</span>
          </div>
          <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${d.color}`}
              style={{ width: `${Math.max((d.value / max) * 100, 1)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProportionBar({ data }: { data: { label: string; value: number; color: string }[] }) {
  const totalVal = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div>
      <div className="w-full h-5 rounded-full overflow-hidden flex bg-gray-100 dark:bg-slate-700">
        {data.map((d) => {
          const pct = (d.value / totalVal) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={d.label}
              className={`h-full ${d.color} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${d.label}: ${d.value.toLocaleString()} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {data.map((d) => {
          const pct = ((d.value / totalVal) * 100).toFixed(1);
          return (
            <div key={d.label} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <span className={`w-2.5 h-2.5 rounded-full inline-block ${d.color}`} />
              {d.label} <span className="font-medium text-gray-800 dark:text-gray-200">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────

const Activity: React.FC = () => {
  const [events, setEvents] = useState<AdminAnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [summaryByType, setSummaryByType] = useState<Record<string, number>>({});

  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState('success');
  const [userQuery, setUserQuery] = useState('');
  const [source, setSource] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const resp: AdminAnalyticsResponse = await getAdminAnalyticsEvents({
        page,
        size: 20,
        event_type: filter || undefined,
        status: status || undefined,
        user_query: userQuery || undefined,
        source: source || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setEvents(resp.events);
      setTotalPages(resp.total_pages);
      setTotal(resp.total);
      setSummaryByType(resp.summary?.by_type ?? {});
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  }, [page, filter, status, userQuery, source, startDate, endDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const statValues = useMemo(
    () => STAT_CARDS.map((card) => ({ ...card, count: summaryByType[card.key] ?? 0 })),
    [summaryByType],
  );

  const chartData = useMemo(() => {
    const sorted = Object.entries(summaryByType).sort((a, b) => b[1] - a[1]);
    return sorted.map(([key, value], idx) => ({
      label: formatEventType(key),
      value,
      color: getBarColor(key, idx),
    }));
  }, [summaryByType]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter(e.target.value);
    setPage(1);
  };

  const handleReset = () => {
    setFilter('');
    setStatus('success');
    setUserQuery('');
    setSource('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="flex-1 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Event Activity</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Platform-wide event tracking and analysis across all users
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statValues.map((card) => {
            const colors = COLOR_MAP[card.color];
            return (
              <div key={card.key} className="glass-panel rounded-2xl border border-white/40 dark:border-slate-500/30 p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.bg}`}>
                    <svg className={`w-5 h-5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.iconPath} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
                    <p className={`text-xl font-bold ${colors.text}`}>{card.count.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts */}
        {chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Distribution bar chart */}
            <div className="glass-panel rounded-2xl border border-white/40 dark:border-slate-500/30 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Event Distribution</h2>
              <HorizontalBarChart data={chartData} />
            </div>

            {/* Proportion breakdown */}
            <div className="glass-panel rounded-2xl border border-white/40 dark:border-slate-500/30 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Event Breakdown</h2>
              <div className="mb-6">
                <ProportionBar data={chartData} />
              </div>
              <div className="space-y-2">
                {chartData.map((d) => (
                  <div key={d.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-sm ${d.color}`} />
                      <span className="text-gray-700 dark:text-gray-300">{d.label}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="glass-panel rounded-2xl border border-white/40 dark:border-slate-500/30 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Filters</h2>
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {filtersOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {/* Primary row - always visible */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-48">
              <Select value={filter} onChange={handleFilterChange}>
                {EVENT_TYPES.map((et) => (
                  <option key={et.value} value={et.value}>{et.label}</option>
                ))}
              </Select>
            </div>
            <input
              type="text"
              value={userQuery}
              onChange={(e) => { setUserQuery(e.target.value); setPage(1); }}
              placeholder="Search by username or email"
              className="glass-input block w-full sm:flex-1 rounded-md px-3 py-2 text-gray-900 dark:text-slate-100 shadow-sm text-sm"
            />
          </div>

          {/* Advanced filters - toggled */}
          {filtersOpen && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Status</label>
                <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Source</label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => { setSource(e.target.value); setPage(1); }}
                  placeholder="e.g. frontend, api"
                  className="glass-input block w-full rounded-md px-3 py-2 text-gray-900 dark:text-slate-100 shadow-sm text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="glass-input block w-full rounded-md px-3 py-2 text-gray-900 dark:text-slate-100 shadow-sm text-sm dark:[color-scheme:dark]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="glass-input block w-full rounded-md px-3 py-2 text-gray-900 dark:text-slate-100 shadow-sm text-sm dark:[color-scheme:dark]"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          {filtersOpen && (
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleReset}>
                Reset Filters
              </Button>
            </div>
          )}
        </div>

        {/* Total count */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{total.toLocaleString()} events found</p>

        {loading ? (
          <Spinner />
        ) : events.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-white/40 dark:border-slate-500/30 p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No events found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            {/* Events Table - Desktop */}
            <div className="hidden md:block glass-panel rounded-2xl border border-white/40 dark:border-slate-500/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-300 border-b border-white/40 dark:border-slate-500/30 bg-white/30 dark:bg-slate-800/30">
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((evt) => (
                      <tr key={String(evt.id)} className="border-b border-white/30 dark:border-slate-500/20 hover:bg-white/30 dark:hover:bg-slate-900/30">
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                          {evt.actor_username || evt.target_username || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getBadgeColor(evt.event_type)}`}>
                            {formatEventType(evt.event_type)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs">{evt.source || '-'}</td>
                        <td className="py-3 px-4 whitespace-nowrap text-gray-600 dark:text-gray-300">{formatDateTime(evt.created_at)}</td>
                        <td className="py-3 px-4 max-w-md">{renderDetails(evt.details)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Events Cards - Mobile */}
            <div className="md:hidden space-y-3">
              {events.map((evt) => (
                <div key={String(evt.id)} className="glass-panel rounded-xl border border-white/40 dark:border-slate-500/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getBadgeColor(evt.event_type)}`}>
                      {formatEventType(evt.event_type)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(evt.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{evt.actor_username || evt.target_username || '-'}</p>
                  {evt.source && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">source: {evt.source}</p>}
                  {renderDetails(evt.details)}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    Previous
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Activity;
