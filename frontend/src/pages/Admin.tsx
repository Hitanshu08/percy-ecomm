import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAdminUsers,
  getAdminServices,
  getAdminUserSubscriptions,
  deleteService,
  removeUserSubscription,
  adminAddSubscription,
  updateUserSubscriptionEndDate,
} from '../lib/apiClient';
import { config } from '../config/index';
import AnalyticsDashboard from '../features/admin/components/AnalyticsDashboard';
import Spinner from '../components/feedback/Spinner';

interface User {
  username: string;
  email: string;
  role: string;
  credits: number;
  services_count: number;
}

interface ServiceAccount {
  id: string;
  password: string;
  end_date?: string;
  is_active: boolean;
}

interface Service {
  name: string;
  image: string;
  accounts: ServiceAccount[];
  credits: Record<string, number>;
}

interface SubEntry {
  service_name: string;
  account_id: string;
  end_date: string;
}

type TabId = 'analytics' | 'users' | 'subscriptions' | 'services';

const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

// --- Sorting infrastructure ---
type SortDir = 'asc' | 'desc';
type SortCfg<K extends string = string> = { key: K; dir: SortDir } | null;

function toggleSort<K extends string>(cur: SortCfg<K>, key: K): SortCfg<K> {
  if (cur?.key === key) {
    if (cur.dir === 'asc') return { key, dir: 'desc' };
    return null;
  }
  return { key, dir: 'asc' };
}

function applySortTo<T>(data: T[], cfg: SortCfg, getVal: (item: T, key: string) => string | number): T[] {
  if (!cfg) return data;
  return [...data].sort((a, b) => {
    const av = getVal(a, cfg.key);
    const bv = getVal(b, cfg.key);
    if (av === bv) return 0;
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
    return cfg.dir === 'asc' ? cmp : -cmp;
  });
}

const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => (
  <span className={`inline-flex flex-col ml-1 align-middle leading-none ${active ? '' : 'opacity-30'}`}>
    <svg className={`h-2 w-2 ${active && dir === 'asc' ? 'text-blue-500' : 'text-gray-400'}`} viewBox="0 0 8 4" fill="currentColor"><path d="M4 0l4 4H0z"/></svg>
    <svg className={`h-2 w-2 ${active && dir === 'desc' ? 'text-blue-500' : 'text-gray-400'}`} viewBox="0 0 8 4" fill="currentColor"><path d="M4 4L0 0h8z"/></svg>
  </span>
);

const SortTh = ({ label, sortKey, sort, onSort, className = '' }: { label: string; sortKey: string; sort: SortCfg; onSort: (k: string) => void; className?: string }) => (
  <th
    className={`py-3 px-4 font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${className}`}
    onClick={() => onSort(sortKey)}
  >
    {label}
    <SortIcon active={sort?.key === sortKey} dir={sort?.key === sortKey ? sort.dir : 'asc'} />
  </th>
);

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'analytics', label: 'Analytics',
    icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    id: 'users', label: 'Users',
    icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  },
  {
    id: 'subscriptions', label: 'Subscriptions',
    icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>,
  },
  {
    id: 'services', label: 'Services',
    icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  },
];

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const saved = localStorage.getItem('admin_active_tab');
    return (['analytics', 'users', 'subscriptions', 'services'] as TabId[]).includes(saved as TabId) ? saved as TabId : 'analytics';
  });

  // --- Users tab state ---
  const [users, setUsers] = useState<User[]>([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);

  // --- Services tab state ---
  const [services, setServices] = useState<Service[]>([]);
  const [servicesSearch, setServicesSearch] = useState('');
  const [servicesPage, setServicesPage] = useState(1);
  const [servicesPageSize, setServicesPageSize] = useState(10);
  const [servicesTotal, setServicesTotal] = useState(0);
  const [servicesTotalPages, setServicesTotalPages] = useState(1);
  const [servicesLoading, setServicesLoading] = useState(false);

  // --- Subscriptions tab state ---
  const [subsTabSearch, setSubsTabSearch] = useState('');
  const [subsTabPage, setSubsTabPage] = useState(1);
  const [subsTabPageSize, setSubsTabPageSize] = useState(10);
  const [subsTabUsers, setSubsTabUsers] = useState<User[]>([]);
  const [subsTabTotal, setSubsTabTotal] = useState(0);
  const [subsTabTotalPages, setSubsTabTotalPages] = useState(1);
  const [subsTabLoading, setSubsTabLoading] = useState(false);
  const [subsTabExpanded, setSubsTabExpanded] = useState<string | null>(null);
  const [subsTabUserSubs, setSubsTabUserSubs] = useState<Record<string, SubEntry[]>>({});
  const [subsTabLoadingSubs, setSubsTabLoadingSubs] = useState<string | null>(null);
  const [subsTabSubFilter, setSubsTabSubFilter] = useState('');
  const [editingEndDate, setEditingEndDate] = useState<Record<string, string>>({});
  const [showEndDateEdit, setShowEndDateEdit] = useState<Record<string, boolean>>({});

  // --- Assign subscription state ---
  const [assignUser, setAssignUser] = useState('');
  const [assignService, setAssignService] = useState('');
  const [assignDuration, setAssignDuration] = useState('');
  const [assigning, setAssigning] = useState(false);


  // --- Sort state ---
  const [usersSort, setUsersSort] = useState<SortCfg>(null);
  const [servicesSort, setServicesSort] = useState<SortCfg>(null);
  const [subsUsersSort, setSubsUsersSort] = useState<SortCfg>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const didInit = useRef(false);

  useEffect(() => {
    localStorage.setItem('admin_active_tab', activeTab);
  }, [activeTab]);

  // --- Data fetchers ---
  const fetchUsers = useCallback(async (page: number, pageSize: number, search: string) => {
    try {
      setUsersLoading(true);
      const data: any = await getAdminUsers(page, pageSize, search);
      setUsers(data.users || data || []);
      setUsersTotal(data.total ?? 0);
      setUsersTotalPages(data.total_pages ?? 1);
    } catch {
      setUsers([]);
      setUsersTotal(0);
      setUsersTotalPages(1);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchServices = useCallback(async (page: number, pageSize: number, search: string) => {
    try {
      setServicesLoading(true);
      const data: any = await getAdminServices(page, pageSize, search);
      setServices(data.services || data || []);
      setServicesTotal(data.total ?? 0);
      setServicesTotalPages(data.total_pages ?? 1);
    } catch {
      setServices([]);
      setServicesTotal(0);
      setServicesTotalPages(1);
    } finally {
      setServicesLoading(false);
    }
  }, []);

  const fetchSubsTabUsers = useCallback(async (page: number, pageSize: number, search: string) => {
    try {
      setSubsTabLoading(true);
      const data: any = await getAdminUsers(page, pageSize, search);
      setSubsTabUsers(data.users || data || []);
      setSubsTabTotal(data.total ?? 0);
      setSubsTabTotalPages(data.total_pages ?? 1);
    } catch {
      setSubsTabUsers([]);
      setSubsTabTotal(0);
      setSubsTabTotalPages(1);
    } finally {
      setSubsTabLoading(false);
    }
  }, []);

  const fetchUserSubs = useCallback(async (username: string) => {
    setSubsTabLoadingSubs(username);
    try {
      const data: any = await getAdminUserSubscriptions(username);
      setSubsTabUserSubs(prev => ({ ...prev, [username]: data.subscriptions || [] }));
    } catch {
      setSubsTabUserSubs(prev => ({ ...prev, [username]: [] }));
    } finally {
      setSubsTabLoadingSubs(null);
    }
  }, []);


  // --- Init ---
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const init = async () => {
      setInitialLoading(true);
      await Promise.all([fetchUsers(1, 10, ''), fetchServices(1, 10, '')]);
      setInitialLoading(false);
    };
    init();
  }, [fetchUsers, fetchServices]);

  useEffect(() => {
    if (initialLoading) return;
    fetchUsers(usersPage, usersPageSize, usersSearch);
  }, [usersPage, usersPageSize, usersSearch, fetchUsers, initialLoading]);

  useEffect(() => {
    if (initialLoading) return;
    fetchServices(servicesPage, servicesPageSize, servicesSearch);
  }, [servicesPage, servicesPageSize, servicesSearch, fetchServices, initialLoading]);

  useEffect(() => {
    if (activeTab === 'subscriptions') {
      fetchSubsTabUsers(subsTabPage, subsTabPageSize, subsTabSearch);
    }
  }, [activeTab, subsTabPage, subsTabPageSize, subsTabSearch, fetchSubsTabUsers]);


  // --- Sorted data ---
  const sortedUsers = useMemo(() => applySortTo(users, usersSort, (u, k) => {
    switch (k) {
      case 'username': return u.username;
      case 'email': return u.email;
      case 'role': return u.role;
      case 'credits': return u.credits;
      case 'services_count': return u.services_count;
      default: return '';
    }
  }), [users, usersSort]);

  const sortedServices = useMemo(() => applySortTo(services, servicesSort, (s, k) => {
    switch (k) {
      case 'name': return s.name;
      case 'accounts': return s.accounts.length;
      case 'active': return s.accounts.filter(a => a.is_active).length;
      default: return '';
    }
  }), [services, servicesSort]);

  const sortedSubsUsers = useMemo(() => applySortTo(subsTabUsers, subsUsersSort, (u, k) => {
    switch (k) {
      case 'username': return u.username;
      case 'email': return u.email;
      case 'services_count': return u.services_count;
      default: return '';
    }
  }), [subsTabUsers, subsUsersSort]);

  // --- Handlers ---
  const handleDeleteService = async (serviceName: string) => {
    if (!confirm(`Delete "${serviceName}"? This will also remove all user subscriptions to this service.`)) return;
    try {
      await deleteService(serviceName);
      await fetchServices(servicesPage, servicesPageSize, servicesSearch);
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed to delete service'}`);
    }
  };

  const handleRemoveSubscription = async (username: string, accountId: string) => {
    if (!confirm(`Remove subscription "${accountId}" from ${username}?`)) return;
    try {
      await removeUserSubscription(username, accountId);
      await fetchUserSubs(username);
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed to remove subscription'}`);
    }
  };

  const handleUpdateEndDate = async (username: string, accountId: string) => {
    const iso = editingEndDate[accountId];
    if (!iso) { alert('Pick a date'); return; }
    const [year, month, day] = iso.split('-');
    const ddmmyyyy = `${day}/${month}/${year}`;
    try {
      await updateUserSubscriptionEndDate(username, accountId, ddmmyyyy);
      await fetchUserSubs(username);
      setShowEndDateEdit(prev => ({ ...prev, [accountId]: false }));
      setEditingEndDate(prev => ({ ...prev, [accountId]: '' }));
    } catch {
      alert('Failed to update end date');
    }
  };

  const handleAssignSubscription = async () => {
    if (!assignUser || !assignService || !assignDuration) {
      alert('Please select user, service, and duration');
      return;
    }
    setAssigning(true);
    try {
      await adminAddSubscription(assignUser, assignService, assignDuration);
      alert('Subscription assigned successfully!');
      setAssignUser('');
      setAssignService('');
      setAssignDuration('');
      if (subsTabExpanded === assignUser) await fetchUserSubs(assignUser);
      await fetchSubsTabUsers(subsTabPage, subsTabPageSize, subsTabSearch);
    } catch (e: any) {
      try {
        const parsed = JSON.parse(e.message);
        alert(parsed.detail || 'Failed to assign subscription');
      } catch {
        alert(e?.message || 'Failed to assign subscription');
      }
    } finally {
      setAssigning(false);
    }
  };

  const toggleSubsExpand = async (username: string) => {
    if (subsTabExpanded === username) {
      setSubsTabExpanded(null);
      return;
    }
    setSubsTabExpanded(username);
    if (!subsTabUserSubs[username]) {
      await fetchUserSubs(username);
    }
  };

  // --- Subscription row renderer (shared between tabs) ---
  const renderSubRow = (s: SubEntry, username: string) => (
    <div key={`${username}-${s.account_id}`} className="glass-panel-soft rounded-lg p-3 border border-white/30 dark:border-slate-600/30">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-sm flex-1">
          <div><span className="text-gray-500 dark:text-gray-400 text-xs">Service:</span> <span className="font-medium text-gray-900 dark:text-white">{s.service_name}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400 text-xs">Account:</span> <span className="font-medium text-gray-900 dark:text-white break-all">{s.account_id}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400 text-xs">End Date:</span> <span className="font-medium text-gray-900 dark:text-white">{s.end_date}</span></div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowEndDateEdit(prev => ({ ...prev, [s.account_id]: !prev[s.account_id] }))}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            title="Edit end date"
          >
            <PencilIcon />
          </button>
          <button
            onClick={() => handleRemoveSubscription(username, s.account_id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Remove subscription"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      {showEndDateEdit[s.account_id] && (
        <div className="mt-2 flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <input
            type="date"
            value={editingEndDate[s.account_id] || ''}
            onChange={(e) => setEditingEndDate(prev => ({ ...prev, [s.account_id]: e.target.value }))}
            className="px-3 py-1.5 glass-input rounded-lg text-sm dark:[color-scheme:dark]"
          />
          <button onClick={() => handleUpdateEndDate(username, s.account_id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium">Save</button>
          <button onClick={() => { setShowEndDateEdit(prev => ({ ...prev, [s.account_id]: false })); setEditingEndDate(prev => ({ ...prev, [s.account_id]: '' })); }} className="px-3 py-1.5 glass-btn-secondary rounded-lg text-xs">Cancel</button>
        </div>
      )}
    </div>
  );

  if (initialLoading) return <Spinner />;

  return (
    <div className="flex-1 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Manage users, services, subscriptions, and analytics</p>
        </div>

        {/* Main Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-1 overflow-x-auto pb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ======================== ANALYTICS TAB ======================== */}
        {activeTab === 'analytics' && <AnalyticsDashboard />}

        {/* ======================== USERS TAB ======================== */}
        {activeTab === 'users' && (
          <div className="glass-panel rounded-2xl">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Users ({usersTotal})</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={usersSearch}
                  onChange={(e) => { setUsersSearch(e.target.value); setUsersPage(1); }}
                  placeholder="Search by username or email..."
                  className="px-3 py-2 glass-input rounded-lg text-sm w-full sm:w-64"
                />
                <select
                  value={usersPageSize}
                  onChange={(e) => { setUsersPageSize(Number(e.target.value)); setUsersPage(1); }}
                  className="px-2 py-2 glass-input rounded-lg text-sm"
                >
                  {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4">
              {usersLoading ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading users...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">No users found.</div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                          <SortTh label="Username" sortKey="username" sort={usersSort} onSort={k => setUsersSort(toggleSort(usersSort, k))} />
                          <SortTh label="Email" sortKey="email" sort={usersSort} onSort={k => setUsersSort(toggleSort(usersSort, k))} />
                          <SortTh label="Role" sortKey="role" sort={usersSort} onSort={k => setUsersSort(toggleSort(usersSort, k))} />
                          <SortTh label="Credits" sortKey="credits" sort={usersSort} onSort={k => setUsersSort(toggleSort(usersSort, k))} />
                          <SortTh label="Subs" sortKey="services_count" sort={usersSort} onSort={k => setUsersSort(toggleSort(usersSort, k))} />
                          <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedUsers.map((u) => (
                          <tr key={u.username} className="border-b border-gray-100 dark:border-gray-800 hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{u.username}</td>
                            <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{u.email}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                u.role === 'admin'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                              }`}>{u.role}</span>
                            </td>
                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{u.credits}</td>
                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{u.services_count}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => navigate(`/admin/users/${encodeURIComponent(u.username)}`)} className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="Edit user"><PencilIcon /></button>
                                <button onClick={() => alert('User deletion is not supported from the admin panel.')} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Delete user"><TrashIcon /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {sortedUsers.map((u) => (
                      <div key={u.username} className="glass-panel-soft rounded-xl p-4 border border-white/40 dark:border-slate-500/30">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-white truncate">{u.username}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>{u.role}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{u.credits} credits</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{u.services_count} subs</span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => navigate(`/admin/users/${encodeURIComponent(u.username)}`)} className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Edit"><PencilIcon /></button>
                            <button onClick={() => alert('User deletion is not supported from the admin panel.')} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" title="Delete"><TrashIcon /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Page {usersPage} of {usersTotalPages} &middot; {usersTotal} total</span>
                    <div className="flex gap-2">
                      <button onClick={() => setUsersPage(p => Math.max(1, p - 1))} disabled={usersPage <= 1} className="px-3 py-1.5 glass-btn-secondary rounded-lg disabled:opacity-40 text-sm">Prev</button>
                      <button onClick={() => setUsersPage(p => Math.min(usersTotalPages, p + 1))} disabled={usersPage >= usersTotalPages} className="px-3 py-1.5 glass-btn-secondary rounded-lg disabled:opacity-40 text-sm">Next</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ======================== SUBSCRIPTIONS TAB ======================== */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6">
            {/* Assign Subscription */}
            <div className="glass-panel rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Assign Subscription</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select value={assignUser} onChange={(e) => setAssignUser(e.target.value)} className="px-3 py-2 glass-input rounded-lg text-sm">
                  <option value="">Select User</option>
                  {users.map(u => <option key={u.username} value={u.username}>{u.username} ({u.role})</option>)}
                </select>
                <select value={assignService} onChange={(e) => setAssignService(e.target.value)} className="px-3 py-2 glass-input rounded-lg text-sm">
                  <option value="">Select Service</option>
                  {services.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
                <select value={assignDuration} onChange={(e) => setAssignDuration(e.target.value)} className="px-3 py-2 glass-input rounded-lg text-sm">
                  <option value="">Select Duration</option>
                  {Object.entries(config.getSubscriptionDurations()).map(([key, d]: any) => (
                    <option key={key} value={key}>{d.name}</option>
                  ))}
                </select>
                <button onClick={handleAssignSubscription} disabled={assigning} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors">
                  {assigning ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>

            {/* Users with expandable subscriptions */}
            <div className="glass-panel rounded-2xl">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Browse Subscriptions</h2>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={subsTabSearch}
                    onChange={(e) => { setSubsTabSearch(e.target.value); setSubsTabPage(1); }}
                    placeholder="Search by username, email, or ID..."
                    className="px-3 py-2 glass-input rounded-lg text-sm w-full sm:w-72"
                  />
                  <select
                    value={subsTabPageSize}
                    onChange={(e) => { setSubsTabPageSize(Number(e.target.value)); setSubsTabPage(1); }}
                    className="px-2 py-2 glass-input rounded-lg text-sm"
                  >
                    {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="p-4">
                {/* Sort controls for subscriptions list */}
                {!subsTabLoading && subsTabUsers.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>Sort by:</span>
                    {([['username', 'Username'], ['email', 'Email'], ['services_count', 'Subs']] as const).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setSubsUsersSort(toggleSort(subsUsersSort, key))}
                        className={`px-2 py-1 rounded-md transition-colors ${subsUsersSort?.key === key ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                      >
                        {label}
                        <SortIcon active={subsUsersSort?.key === key} dir={subsUsersSort?.key === key ? subsUsersSort.dir : 'asc'} />
                      </button>
                    ))}
                  </div>
                )}
                {subsTabLoading ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
                ) : subsTabUsers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">No users found.</div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {sortedSubsUsers.map(u => {
                        const isExpanded = subsTabExpanded === u.username;
                        const subs = subsTabUserSubs[u.username] || [];
                        const filtered = subsTabSubFilter && isExpanded
                          ? subs.filter(s =>
                              s.service_name.toLowerCase().includes(subsTabSubFilter.toLowerCase()) ||
                              s.account_id.toLowerCase().includes(subsTabSubFilter.toLowerCase())
                            )
                          : subs;

                        return (
                          <div key={u.username} className="glass-panel-soft rounded-xl border border-white/40 dark:border-slate-500/30 overflow-hidden">
                            {/* User row */}
                            <button
                              onClick={() => toggleSubsExpand(u.username)}
                              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors"
                            >
                              <ChevronIcon open={isExpanded} />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-white">{u.username}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{u.email}</span>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                u.services_count > 0
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400'
                              }`}>
                                {u.services_count} sub{u.services_count !== 1 ? 's' : ''}
                              </span>
                            </button>

                            {/* Expanded subscriptions */}
                            {isExpanded && (
                              <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                                {subsTabLoadingSubs === u.username ? (
                                  <div className="py-4 text-sm text-gray-500 dark:text-gray-400 text-center">Loading subscriptions...</div>
                                ) : subs.length === 0 ? (
                                  <div className="py-4 text-sm text-gray-500 dark:text-gray-400 text-center">No subscriptions.</div>
                                ) : (
                                  <>
                                    {subs.length > 2 && (
                                      <div className="pt-3 pb-2">
                                        <input
                                          type="text"
                                          value={subsTabSubFilter}
                                          onChange={(e) => setSubsTabSubFilter(e.target.value)}
                                          placeholder="Filter by service or account ID..."
                                          className="px-3 py-1.5 glass-input rounded-lg text-xs w-full max-w-xs"
                                        />
                                      </div>
                                    )}
                                    <div className="space-y-2 pt-2">
                                      {filtered.map(s => renderSubRow(s, u.username))}
                                      {filtered.length === 0 && subs.length > 0 && (
                                        <div className="py-2 text-sm text-gray-500 dark:text-gray-400 text-center">No subscriptions match filter.</div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Page {subsTabPage} of {subsTabTotalPages} &middot; {subsTabTotal} users</span>
                      <div className="flex gap-2">
                        <button onClick={() => setSubsTabPage(p => Math.max(1, p - 1))} disabled={subsTabPage <= 1} className="px-3 py-1.5 glass-btn-secondary rounded-lg disabled:opacity-40 text-sm">Prev</button>
                        <button onClick={() => setSubsTabPage(p => Math.min(subsTabTotalPages, p + 1))} disabled={subsTabPage >= subsTabTotalPages} className="px-3 py-1.5 glass-btn-secondary rounded-lg disabled:opacity-40 text-sm">Next</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================== SERVICES TAB ======================== */}
        {activeTab === 'services' && (
          <div className="glass-panel rounded-2xl">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Services ({servicesTotal})</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={servicesSearch}
                  onChange={(e) => { setServicesSearch(e.target.value); setServicesPage(1); }}
                  placeholder="Search services..."
                  className="px-3 py-2 glass-input rounded-lg text-sm w-full sm:w-64"
                />
                <select
                  value={servicesPageSize}
                  onChange={(e) => { setServicesPageSize(Number(e.target.value)); setServicesPage(1); }}
                  className="px-2 py-2 glass-input rounded-lg text-sm"
                >
                  {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button onClick={() => navigate('/admin/services/new')} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors whitespace-nowrap">
                  <PlusIcon /> New
                </button>
              </div>
            </div>
            <div className="p-4">
              {servicesLoading ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading services...</div>
              ) : services.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">No services found.</div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                          <SortTh label="Service" sortKey="name" sort={servicesSort} onSort={k => setServicesSort(toggleSort(servicesSort, k))} />
                          <SortTh label="Accounts" sortKey="accounts" sort={servicesSort} onSort={k => setServicesSort(toggleSort(servicesSort, k))} />
                          <SortTh label="Active" sortKey="active" sort={servicesSort} onSort={k => setServicesSort(toggleSort(servicesSort, k))} />
                          <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedServices.map((s) => (
                          <tr key={s.name} className="border-b border-gray-100 dark:border-gray-800 hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <img src={s.image} alt={s.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-800" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                <span className="font-medium text-gray-900 dark:text-white">{s.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{s.accounts.length}</td>
                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{s.accounts.filter(a => a.is_active).length}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => navigate(`/admin/services/${encodeURIComponent(s.name)}`)} className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="Edit service"><PencilIcon /></button>
                                <button onClick={() => handleDeleteService(s.name)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Delete service"><TrashIcon /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {sortedServices.map((s) => (
                      <div key={s.name} className="glass-panel-soft rounded-xl p-4 border border-white/40 dark:border-slate-500/30">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={s.image} alt={s.name} className="w-12 h-12 rounded-lg object-cover bg-gray-100 dark:bg-gray-800 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            <div className="min-w-0">
                              <h3 className="font-medium text-gray-900 dark:text-white truncate">{s.name}</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{s.accounts.length} accounts ({s.accounts.filter(a => a.is_active).length} active)</p>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => navigate(`/admin/services/${encodeURIComponent(s.name)}`)} className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Edit"><PencilIcon /></button>
                            <button onClick={() => handleDeleteService(s.name)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" title="Delete"><TrashIcon /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Page {servicesPage} of {servicesTotalPages} &middot; {servicesTotal} total</span>
                    <div className="flex gap-2">
                      <button onClick={() => setServicesPage(p => Math.max(1, p - 1))} disabled={servicesPage <= 1} className="px-3 py-1.5 glass-btn-secondary rounded-lg disabled:opacity-40 text-sm">Prev</button>
                      <button onClick={() => setServicesPage(p => Math.min(servicesTotalPages, p + 1))} disabled={servicesPage >= servicesTotalPages} className="px-3 py-1.5 glass-btn-secondary rounded-lg disabled:opacity-40 text-sm">Next</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
