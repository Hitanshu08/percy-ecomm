import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  getServices,
  createService,
  updateService,
  deleteService,
  adminAddSubscription,
  getAdminServices,
  getAdminUsers,
  getService,
  getAdminUserSubscriptions,
  addCredits as apiAddCredits,
  removeCredits as apiRemoveCredits,
  putServiceCredits,
  getServiceCredits,
  updateUserSubscriptionEndDate,
  removeUserSubscription,
} from '../lib/apiClient';
import { Button, Input, Checkbox } from '../components/ui';
import { useApi } from '../lib/useApi';
import { config } from '../config/index';

interface ServiceAccount {
  id: string;
  password: string;
  end_date: string;
  is_active: boolean;
  credits: Record<string, number>;
}

interface Service {
  name: string;
  image: string;
  accounts: ServiceAccount[];
  credits: Record<string, number>;
}

interface User {
  username: string;
  email: string;
  role: string;
  credits: number;
  services: Array<{
    service_id: string;
    end_date: string;
    is_active: boolean;
  }>;
}

export default function Admin() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'services' | 'users' | 'credits'>('services');
  
  // Service management state
  const [newService, setNewService] = useState({
    name: '',
    image: '',
    credits: {},
    accounts: [{ id: '', password: '', end_date: '', is_active: true }]
  });
  const [editingService, setEditingService] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  
  // User management state
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('1month');
  const [addingSubscription, setAddingSubscription] = useState(false);
  const [userSubs, setUserSubs] = useState<any | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [subsByUser, setSubsByUser] = useState<Record<string, any>>({});
  const [loadingSubsFor, setLoadingSubsFor] = useState<string | null>(null);
  const [endDateEdits, setEndDateEdits] = useState<Record<string, string>>({});
  const [showEndDateEdit, setShowEndDateEdit] = useState<Record<string, boolean>>({});
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [editingCreditsFor, setEditingCreditsFor] = useState<string | null>(null);
  const [creditsForm, setCreditsForm] = useState<Record<string, number>>({});
  
  // Credit management state
  const [creditUser, setCreditUser] = useState<string>('');
  const [creditAmount, setCreditAmount] = useState<number>(0);
  const [selectedSubscription, setSelectedSubscription] = useState<string>('');
  const [earningRate, setEarningRate] = useState('');
  const [conversionRate, setConversionRate] = useState('');
  
  // Service credit preview
  const [serviceCreditPreview, setServiceCreditPreview] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Service credit configuration (matching backend config)
  const serviceCredits = {
    "Quillbot": {
      "7days": 1,
      "1month": 2,
      "3months": 12,
      "6months": 20,
      "1year": 35
    },
    "Grammarly": {
      "7days": 2,
      "1month": 4,
      "3months": 10,
      "6months": 18,
      "1year": 30
    },
    "ChatGPT": {
      "7days": 3,
      "1month": 6,
      "3months": 15,
      "6months": 25,
      "1year": 45
    }
  };

  // Default per-duration credits when a service has no custom credits configured
  const defaultDurationCredits: Record<string, number> = {
    "7days": 1,
    "1month": 2,
    "3months": 3,
    "6months": 5,
    "1year": 9,
  };

  const getServiceCreditsForDuration = (serviceName: string, duration: string): number => {
    const service = serviceCredits[serviceName as keyof typeof serviceCredits];
    if (service && duration in service) {
      return (service as any)[duration];
    }
    return 0;
  };


  const fetchData = async () => {
    try {
      const [servicesData, usersData] = await Promise.all([
        getAdminServices(),
        getAdminUsers(),
      ]);
      setServices((servicesData as any).services || (servicesData as any) || []);
      setUsers((usersData as any).users || (usersData as any) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setServices([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async () => {
    try {
      await createService(newService as any);
      alert('Service created successfully!');
      setNewService({
        name: '',
        image: '',
        credits: {},
        accounts: [{ id: '', password: '', end_date: '', is_active: true }]
      });
      fetchData();
    } catch (error: any) {
      console.error('Error creating service:', error);
      alert(`Error: ${error?.message || 'Error creating service'}`);
    }
  };

      const handleEditService = async (serviceName: string) => {
      try {
        await updateService(serviceName, newService as any);
        alert('Service updated successfully!');
        setEditingService(null);
        setShowEditForm(false);
        setNewService({
          name: '',
          image: '',
          credits: {},
          accounts: [{ id: '', password: '', end_date: '', is_active: true }]
        });
        fetchData();
      } catch (error: any) {
        console.error('Error updating service:', error);
        alert(`Error: ${error?.message || 'Error updating service'}`);
      }
    };

      const startEditService = async (serviceName: string) => {
      try {
        const serviceData: any = await getService(serviceName);
        setNewService({
          name: serviceData.name,
          image: serviceData.image,
          credits: serviceData.credits || {},
          accounts: serviceData.accounts.map((acc: any) => ({
            id: acc.id,
            password: acc.password,
            end_date: acc.end_date,
            is_active: acc.is_active
          }))
        });
        setEditingService(serviceName);
        setShowEditForm(true);
      } catch (error: any) {
        console.error('Error fetching service:', error);
        alert(`Error fetching service details: ${error?.message || ''}`);
      }
    };

  const handleDeleteService = async (serviceName: string) => {
    if (!confirm(`Are you sure you want to delete ${serviceName}? This will also remove all user subscriptions to this service.`)) return;

    try {
      const result: any = await deleteService(serviceName);
      const message = `Service deleted successfully!\n\n${result.message}\nUsers updated: ${result.users_updated || 0}\nAccount IDs removed: ${result.account_ids_removed?.join(', ') || 'None'}`;
      alert(message);
      
      // Refresh data and update any expanded user subscriptions
      await fetchData();
      
      // If any user has expanded subscriptions, refresh them to show updated data
      if (expandedUser && subsByUser[expandedUser]) {
        await fetchUserSubscriptions(expandedUser);
      }
    } catch (error: any) {
      console.error('Error deleting service:', error);
      alert(`Error deleting service: ${error?.message || ''}`);
    }
  };

    const handleAddSubscription = async () => {
    if (!selectedUser || !selectedService || !selectedDuration) {
      alert('Please select user, service, and duration');
      return;
    }

    setAddingSubscription(true);
    try {
      const result: any = await adminAddSubscription(selectedUser, selectedService, selectedDuration);
      const message = `Success! ${result.message}`;
      alert(message);
      if (selectedUser && expandedUser === selectedUser) {
        await fetchUserSubscriptions(selectedUser);
      }
      setSelectedUser('');
      setSelectedService('');
      setSelectedDuration('');
      fetchData();
    } catch (error: any) {
      try {
        console.error('Error adding subscription:', error);
        const parsedObject = JSON.parse((error as any).message);
        alert(parsedObject.detail);
      } catch (err) {
        alert('Failed to add subscription. Please try again.');
      }
    } finally {
      setAddingSubscription(false);
    }
  };

  const handleRemoveCredits = async () => {
    if (!creditUser || creditAmount <= 0) {
      alert('Please enter valid user and credit amount');
      return;
    }

    try {
      await apiRemoveCredits(creditUser, creditAmount, selectedSubscription || undefined);
      const message = selectedSubscription 
        ? `Removed ${creditAmount} credits from subscription ${selectedSubscription} for ${creditUser}`
        : `Removed ${creditAmount} credits from ${creditUser}`;
      alert(message);
      setCreditUser('');
      setSelectedSubscription('');
      setCreditAmount(0);
      fetchData();
    } catch (error: any) {
      console.error('Error removing credits:', error);
      alert(`Error removing credits: ${error?.message || ''}`);
    }
  };

  const handleRemoveCreditsForSubscription = async (username: string, serviceId: string) => {
    try {
      const input = window.prompt(`Enter credits to remove from subscription ${serviceId} for ${username}`);
      if (!input) return;
      const amount = Number(input);
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid positive number');
        return;
      }
      await apiRemoveCredits(username, amount, serviceId);
      alert(`Removed ${amount} credits from ${username}'s subscription ${serviceId}`);
      await fetchUserSubscriptions(username);
      fetchData();
    } catch (e) {
      console.error('Error removing credits from subscription', e);
      alert('Error removing credits');
    }
  };

  const fetchUserSubscriptions = async (username: string) => {
    if (!username) return;
    try {
      setLoadingSubsFor(username);
      const data = await getAdminUserSubscriptions(username);
      setSubsByUser(prev => ({ ...prev, [username]: data }));
      setUserSubs(data);
    } catch (e) {
      console.error('Failed to fetch user subscriptions', e);
    } finally {
      setLoadingSubsFor(null);
    }
  };

  const handleAddCredits = async () => {
    if (!creditUser || creditAmount <= 0) {
      alert('Please enter valid user and credit amount');
      return;
    }

    try {
      const result = await apiAddCredits(creditUser, creditAmount, selectedSubscription || undefined);
        const message = selectedSubscription 
          ? `Added ${creditAmount} credits to subscription ${selectedSubscription} for ${creditUser}`
          : `Added ${creditAmount} credits to ${creditUser}`;
        alert(message);
        setCreditUser('');
        setSelectedSubscription('');
        setCreditAmount(0);
        fetchData();
    } catch (error: any) {
      console.error('Error adding credits:', error);
      alert(`Error adding credits: ${error?.message || ''}`);
    }
  };

  const addAccountField = () => {
    setNewService(prev => ({
      ...prev,
      accounts: [...prev.accounts, { id: '', password: '', end_date: '', is_active: true }]
    }));
  };

  const removeAccountField = (index: number) => {
    setNewService(prev => ({
      ...prev,
      accounts: prev.accounts.filter((_, i) => i !== index)
    }));
  };

  const updateAccountField = (index: number, field: string, value: string | boolean) => {
    setNewService(prev => ({
      ...prev,
      accounts: prev.accounts.map((acc, i) => 
        i === index ? { ...acc, [field]: value } : acc
      )
    }));
  };

  const formatDateForInput = (dateString: string) => {
    // Convert dd/mm/yyyy to yyyy-mm-dd for HTML date input
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateString;
  };

  const formatDateForDisplay = (dateString: string) => {
    // Convert yyyy-mm-dd to dd/mm/yyyy for display
    if (dateString.includes('-') && dateString.length === 10) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    return dateString;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage services, users, and credits
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'services', label: 'Services' },
              { id: 'users', label: 'Users' },
              { id: 'credits', label: 'Credits' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Services Tab */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            {/* Create/Edit Service Form */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {editingService ? `Edit Service: ${editingService}` : 'Create New Service'}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <Input
                  type="text"
                  placeholder="Service Name"
                  value={newService.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewService({ ...newService, name: e.target.value })}
                />
                <Input
                  type="text"
                  placeholder="Image URL"
                  value={newService.image}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewService({ ...newService, image: e.target.value })}
                />
              </div>

              {/* Credits Section */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Credits (per duration)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.entries(config.getSubscriptionDurations()).map(([key, d]: any) => (
                    <div key={key} className="flex items-center gap-2">
                      <label className="text-xs w-24 text-gray-700 dark:text-gray-300">{(d as any).name}</label>
                      <input
                        type="number"
                        value={(newService as any).credits?.[key] ?? (defaultDurationCredits[key] ?? (d as any).credits_cost)}
                        onChange={(e) => setNewService(prev => ({
                          ...prev,
                          credits: { ...(prev as any).credits, [key]: Number(e.target.value) }
                        }))}
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Accounts Section */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Accounts
                  </label>
                  <button
                    onClick={addAccountField}
                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                  >
                    Add Account
                  </button>
                </div>
                
                {newService.accounts.map((account, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-md p-4 mb-3">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">Account {index + 1}</h4>
                      {newService.accounts.length > 1 && (
                        <button
                          onClick={() => removeAccountField(index)}
                          className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <input
                        type="text"
                        autoComplete="off"
                        name="serviceAccountId"
                        placeholder="Account ID"
                        value={account.id}
                        onChange={(e) => updateAccountField(index, 'id', e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                      <div className="relative">
                        <input
                          type={showPasswords[index] ? 'text' : 'password'}
                          autoComplete="off"
                          placeholder="Password"
                          name="serviceAccountPassword"
                          value={account.password}
                          onChange={(e) => updateAccountField(index, 'password', e.target.value)}
                          className="w-full pr-10 pl-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(prev => ({ ...prev, [index]: !prev[index] }))}
                          className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-600 dark:text-gray-300"
                          aria-label={showPasswords[index] ? 'Hide password' : 'Show password'}
                        >
                          {showPasswords[index] ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7 0-1.04.363-2.008.99-2.828m3.164-2.555A9.956 9.956 0 0112 5c5 0 9 4 9 7 0 .915-.27 1.79-.756 2.571M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <input
                        type="date"
                        value={formatDateForInput(account.end_date)}
                        onChange={(e) => updateAccountField(index, 'end_date', formatDateForDisplay(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300  dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:[color-scheme:dark]"
                      />
                      <div className="flex items-center">
                        <Checkbox
                          checked={account.is_active}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAccountField(index, 'is_active', e.target.checked)}
                          label="Active"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={editingService ? () => handleEditService(editingService) : handleCreateService}
                  variant="primary"
                >
                  {editingService ? 'Update Service' : 'Create Service'}
                </Button>
                {editingService && (
                  <Button
                    onClick={() => {
                      setEditingService(null);
                      setShowEditForm(false);
                      setNewService({
                        name: '',
                        image: '',
                        credits: {},
                        accounts: [{ id: '', password: '', end_date: '', is_active: true }]
                      });
                    }}
                    variant="secondary"
                  >
                    Cancel Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Services List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Existing Services
                </h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(services || []).map((service) => (
                    <div key={service.name} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center space-x-4 mb-4">
                        <img
                          src={service.image}
                          alt={service.name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {service.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {service.accounts.length} accounts
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        {service.accounts.map((account, index) => (
                          <div key={index} className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">ID: {account.id}</span>
                            <span className={`ml-2 px-2 py-1 rounded text-xs ${
                              account.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {account.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => startEditService(service.name)}
                          variant="primary"
                          size="sm"
                          className="flex-1"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={async () => {
                            setEditingCreditsFor(service.name);
                            try {
                              const data: any = await getServiceCredits(service.name);
                              const durations = config.getSubscriptionDurations();
                              const initial: Record<string, number> = {};
                              Object.entries(durations).forEach(([key, d]: any) => {
                                initial[key] = (data.credits && data.credits[key] != null)
                                  ? Number(data.credits[key])
                                  : Number(defaultDurationCredits[key] ?? (d as any).credits_cost);
                              });
                              setCreditsForm(initial);
                            } catch (e) {
                              setCreditsForm({});
                            }
                          }}
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                        >
                          Edit Credits
                        </Button>
                        <Button
                          onClick={() => handleDeleteService(service.name)}
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                        >
                          Delete
                        </Button>
                      </div>
                      {editingCreditsFor === service.name && (
                        <div className="mt-4 p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Edit Credits</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {Object.entries(config.getSubscriptionDurations()).map(([key, d]: any) => (
                              <div key={key} className="flex items-center gap-2">
                                <label className="text-xs w-24 text-gray-700 dark:text-gray-300">{(d as any).name}</label>
                                <input
                                  type="number"
                                  value={creditsForm[key] ?? (defaultDurationCredits[key] ?? (d as any).credits_cost)}
                                  onChange={(e) => setCreditsForm(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                                  className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-xs"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await putServiceCredits(service.name, creditsForm);
                                  alert('Credits updated');
                                  setEditingCreditsFor(null);
                                } catch (e) {
                                  alert('Failed to update credits');
                                }
                              }}
                              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingCreditsFor(null)}
                              className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Assign Subscription Form */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Assign Subscription
              </h2>
              <div className="mb-6">
                {/* <h3 className="text-lg font-semibold mb-4">Assign Subscription</h3> */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select User</option>
                    {(users || []).map((user) => (
                      <option key={user.username} value={user.username}>
                        {user.username} ({user.role})
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedService}
                    onChange={(e) => {
                      setSelectedService(e.target.value);
                      // Update credit preview
                      if (e.target.value && selectedDuration) {
                        // const credits = getServiceCreditsForDuration(e.target.value, selectedDuration);
                        // setServiceCreditPreview(credits);
                      } else {
                        // setServiceCreditPreview(null);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select Service</option>
                    {(services || []).map((service) => (
                      <option key={service.name} value={service.name}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedDuration}
                    onChange={(e) => {
                      setSelectedDuration(e.target.value);
                      // Update credit preview
                      // if (selectedService && e.target.value) {
                      //   const credits = getServiceCreditsForDuration(selectedService, e.target.value);
                      //   setServiceCreditPreview(credits);
                      // } else {
                      //   setServiceCreditPreview(null);
                      // }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select Duration</option>
                    <option value="7days">7 Days</option>
                    <option value="1month">1 Month</option>
                    <option value="3months">3 Months</option>
                    <option value="6months">6 Months</option>
                    <option value="1year">1 Year</option>
                  </select>
                </div>
                
                {/* Credit Preview */}
                {/* {serviceCreditPreview !== null && selectedService && selectedDuration && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Credit Preview:</strong> {selectedService} for {selectedDuration} will be assigned <strong>{serviceCreditPreview} credits</strong>
                    </p>
                  </div>
                )} */}
                <Button
                  onClick={handleAddSubscription}
                  disabled={addingSubscription}
                  variant="primary"
                  className="mt-4"
                >
                  {addingSubscription ? 'Adding...' : 'Add Subscription'}
                </Button>
              </div>

              {/* Users List */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Users
                  </h2>
                </div>
                <div className="p-4">
                  <div className="space-y-4">
                    {(users || []).map((user) => (
                      <div key={user.username} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                              {user.username}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {user.email} • {user.role} • {user.credits} total credits • {user.services.length} subscriptions
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={async () => {
                              if (expandedUser === user.username) {
                                setExpandedUser(null);
                                setUserSubs(null);
                                return;
                              }
                              setExpandedUser(user.username);
                              await fetchUserSubscriptions(user.username);
                            }}
                            className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                          >
                            {expandedUser === user.username ? 'Hide Subscriptions' : 'View Subscriptions'}
                          </button>
                        </div>

                        {expandedUser === user.username && (
                          <div className="mt-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md">
                            {loadingSubsFor === user.username ? (
                              <div className="text-sm text-gray-500 dark:text-gray-400">Loading subscriptions...</div>
                            ) : subsByUser[user.username] && subsByUser[user.username].subscriptions && subsByUser[user.username].subscriptions.length > 0 ? (
                              <div className="space-y-2">
                                {subsByUser[user.username].subscriptions.map((s: any, idx: number) => (
                                  <div key={idx} className="p-2 border border-gray-200 dark:border-gray-700 rounded">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                                      <div className="break-words"><span className="font-medium">Service:</span> {s.service_name}</div>
                                      <div className="break-words"><span className="font-medium">Account:</span> {s.account_id}</div>
                                      <div className="break-words"><span className="font-medium">End Date:</span> {s.end_date}</div>
                                      <div className="break-words"><span className="font-medium">Active:</span> {s.is_active ? 'Yes' : 'No'}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500 dark:text-gray-400">No subscriptions for this user.</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* User Subscriptions Panel */}
              {userSubs && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 mt-6">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {userSubs.username}'s Subscriptions (Credits: {userSubs.credits})
                    </h2>
                  </div>
                  <div className="p-4">
                    {userSubs.subscriptions && userSubs.subscriptions.length > 0 ? (
                      <div className="space-y-3">
                        {userSubs.subscriptions.map((s: any, idx: number) => (
                          <div key={idx} className="p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 text-sm items-start">
                              <div className='break-words'><span className="font-medium">Service:</span> {s.service_name}</div>
                              <div className='break-words'><span className="font-medium">Account:</span> {s.account_id}</div>
                              <div className='break-words'><span className="font-medium">End Date:</span> {s.end_date}</div>
                              <div className='break-words'><span className="font-medium">Active:</span> {s.is_active ? 'Yes' : 'No'}</div>
                              <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:col-span-3">
                                {!showEndDateEdit[s.account_id] ? (
                                  <button
                                    onClick={() => setShowEndDateEdit(prev => ({ ...prev, [s.account_id]: true }))}
                                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                  >
                                    Update End Date
                                  </button>
                                ) : (
                                  <>
                                    <input
                                      type="date"
                                      value={endDateEdits[s.account_id] ?? formatDateForInput(s.end_date)}
                                      onChange={(e) => setEndDateEdits(prev => ({ ...prev, [s.account_id]: e.target.value }))}
                                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-xs dark:[color-scheme:dark]"
                                    />
                                    <button
                                      onClick={async () => {
                                        const iso = (endDateEdits[s.account_id] || formatDateForInput(s.end_date)).trim();
                                        if (!iso) {
                                          alert('Please pick a date');
                                          return;
                                        }
                                        const ddmmyyyy = formatDateForDisplay(iso);
                                        try {
                                          await updateUserSubscriptionEndDate(userSubs.username, s.account_id, ddmmyyyy);
                                          const data = await getAdminUserSubscriptions(userSubs.username);
                                          setUserSubs(data);
                                          setShowEndDateEdit(prev => ({ ...prev, [s.account_id]: false }));
                                          setEndDateEdits(prev => ({ ...prev, [s.account_id]: '' }));
                                          alert('End date updated');
                                        } catch (e) {
                                          alert('Failed to update end date');
                                        }
                                      }}
                                      className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setShowEndDateEdit(prev => ({ ...prev, [s.account_id]: false }));
                                        setEndDateEdits(prev => ({ ...prev, [s.account_id]: '' }));
                                      }}
                                      className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                              </div>
                              <div className="flex gap-2 md:col-span-full md:justify-end flex-wrap">
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Remove subscription ${s.account_id} from ${userSubs.username}?`)) return;
                                    try {
                                      await removeUserSubscription(userSubs.username, s.account_id);
                                      const data = await getAdminUserSubscriptions(userSubs.username);
                                      setUserSubs(data);
                                      alert('Subscription removed');
                                    } catch (e) {
                                      alert('Failed to remove subscription');
                                    }
                                  }}
                                  className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400">No subscriptions for this user.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Credits Tab */}
        {activeTab === 'credits' && (
          <div className="space-y-6">
            {/* Add Credits Form */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Manage Credits
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  value={creditUser}
                  onChange={(e) => {
                    setCreditUser(e.target.value);
                    setSelectedSubscription(''); // Reset subscription selection when user changes
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select User</option>
                  {(users || []).map((user) => (
                    <option key={user.username} value={user.username}>
                      {user.username} ({user.role}) - Total: {user.credits || 0} credits
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Credit Amount"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  onClick={handleAddCredits}
                  variant="primary"
                  className="bg-green-600 hover:bg-green-700"
                >
                  Add Credits
                </Button>
                <Button
                  onClick={handleRemoveCredits}
                  variant="primary"
                  className="bg-red-600 hover:bg-red-700"
                >
                  Remove Credits
                </Button>
              </div>
            </div>

            {/* Credit System Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Credit System Information
              </h2>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p>• Credits are automatically assigned based on service and duration</p>
                <p>• Each service has different credit amounts for different durations</p>
                <p>• Credits are managed per subscription</p>
                <p>• Total credits = Global credits + Sum of all subscription credits</p>
                <p>• Admin can add additional credits to specific subscriptions or globally</p>
                <br />
                <p><strong>Service Credit Examples:</strong></p>
                <p>• Quillbot: 1 (7d) → 350 (1y)</p>
                <p>• Grammarly: 2 (7d) → 650 (1y)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
