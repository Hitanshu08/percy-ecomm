import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import { getServices, createService, updateService, deleteService, adminAddSubscription } from './api';
import { useApi } from './hooks/useApi';
import { config } from './config';

interface ServiceAccount {
  id: string;
  password: string;
  end_date: string;
  is_active: boolean;
}

interface Service {
  name: string;
  image: string;
  accounts: ServiceAccount[];
}

interface User {
  username: string;
  email: string;
  role: string;
  credits?: number;
  services: Array<{
    service_id: string;
    end_date: string;
    is_active: boolean;
  }>;
}

export default function Admin() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { callApi } = useApi();
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'services' | 'users' | 'credits'>('services');
  
  // Service management state
  const [newService, setNewService] = useState({
    name: '',
    image: '',
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
  // const serviceCredits = {
  //   "Quillbot": {
  //     "7days": 1,
  //     "1month": 2,
  //     "3months": 12,
  //     "6months": 20,
  //     "1year": 35
  //   },
  //   "Grammarly": {
  //     "7days": 2,
  //     "1month": 4,
  //     "3months": 10,
  //     "6months": 18,
  //     "1year": 30
  //   },
  //   "ChatGPT": {
  //     "7days": 3,
  //     "1month": 6,
  //     "3months": 15,
  //     "6months": 25,
  //     "1year": 45
  //   }
  // };

  // const getServiceCreditsForDuration = (serviceName: string, duration: string): number => {
    // const service = serviceCredits[serviceName as keyof typeof serviceCredits];
    // if (service && duration in service) {
    //   return (service as any)[duration];
    // }
    // return 0;
  // };

  const fetchData = async () => {
    try {
              const [servicesRes, usersRes] = await Promise.all([
          fetch('https://www.api.webmixo.com/admin/services', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }),
          fetch('https://www.api.webmixo.com/admin/users', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          })
        ]);

      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        setServices(servicesData.services || []);
      } else {
        console.error('Failed to fetch services:', servicesRes.status);
        setServices([]);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      } else {
        console.error('Failed to fetch users:', usersRes.status);
        setUsers([]);
      }
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
      const response = await fetch('https://www.api.webmixo.com/admin/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newService)
      });

      if (response.ok) {
        alert('Service created successfully!');
        setNewService({
          name: '',
          image: '',
          accounts: [{ id: '', password: '', end_date: '', is_active: true }]
        });
        fetchData();
      } else {
        const error = await response.text();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error creating service:', error);
      alert('Error creating service');
    }
  };

      const handleEditService = async (serviceName: string) => {
      try {
        const response = await fetch(`https://www.api.webmixo.com/admin/services/${serviceName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newService)
      });

      if (response.ok) {
        alert('Service updated successfully!');
        setEditingService(null);
        setShowEditForm(false);
        setNewService({
          name: '',
          image: '',
          accounts: [{ id: '', password: '', end_date: '', is_active: true }]
        });
        fetchData();
      } else {
        const error = await response.text();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error updating service:', error);
      alert('Error updating service');
    }
  };

      const startEditService = async (serviceName: string) => {
      try {
        const response = await fetch(`https://www.api.webmixo.com/admin/services/${serviceName}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const serviceData = await response.json();
        setNewService({
          name: serviceData.name,
          image: serviceData.image,
          accounts: serviceData.accounts.map((acc: any) => ({
            id: acc.id,
            password: '', // Don't show existing passwords
            end_date: acc.end_date,
            is_active: acc.is_active
          }))
        });
        setEditingService(serviceName);
        setShowEditForm(true);
      } else {
        const error = await response.text();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error fetching service:', error);
      alert('Error fetching service details');
    }
  };

  const handleDeleteService = async (serviceName: string) => {
    if (!confirm(`Are you sure you want to delete ${serviceName}? This will also remove all user subscriptions to this service.`)) return;

    try {
              const response = await fetch(`https://www.api.webmixo.com/admin/services/${serviceName}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const result = await response.json();
        const message = `Service deleted successfully!\n\n${result.message}\nUsers updated: ${result.users_updated || 0}\nAccount IDs removed: ${result.account_ids_removed?.join(', ') || 'None'}`;
        alert(message);
        
        // Refresh data and update any expanded user subscriptions
        await fetchData();
        
        // If any user has expanded subscriptions, refresh them to show updated data
        if (expandedUser && subsByUser[expandedUser]) {
          await fetchUserSubscriptions(expandedUser);
        }
      } else {
        const error = await response.text();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Error deleting service');
    }
  };

  const handleAddSubscription = async () => {
    if (!selectedUser || !selectedService || !selectedDuration) {
      alert('Please select user, service, and duration');
      return;
    }

    setAddingSubscription(true);
    try {
      const result = await callApi<any>('https://www.api.webmixo.com/admin/assign-subscription', {
        method: 'POST',
        body: JSON.stringify({
          username: selectedUser,
          service_name: selectedService,
          duration: selectedDuration
        })
      });

      const message = `Success! ${result.message}`;
      alert(message);
      if (selectedUser && expandedUser === selectedUser) {
        await fetchUserSubscriptions(selectedUser);
      }
      setSelectedUser('');
      setSelectedService('');
      setSelectedDuration('');
      fetchData();
    } catch (error) {
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
      const requestBody: any = {
        username: creditUser,
        credits: creditAmount
      };

      if (selectedSubscription) {
        requestBody.service_id = selectedSubscription;
      }

      const response = await fetch('https://www.api.webmixo.com/admin/remove-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const message = selectedSubscription 
          ? `Removed ${creditAmount} credits from subscription ${selectedSubscription} for ${creditUser}`
          : `Removed ${creditAmount} credits from ${creditUser}`;
        alert(message);
        setCreditUser('');
        setSelectedSubscription('');
        setCreditAmount(0);
        fetchData();
      } else {
        const error = await response.text();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error removing credits:', error);
      alert('Error removing credits');
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
      const response = await fetch('https://www.api.webmixo.com/admin/remove-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ username, credits: amount, service_id: serviceId })
      });
      if (response.ok) {
        alert(`Removed ${amount} credits from ${username}'s subscription ${serviceId}`);
        await fetchUserSubscriptions(username);
        fetchData();
      } else {
        const error = await response.text();
        alert(`Error: ${error}`);
      }
    } catch (e) {
      console.error('Error removing credits from subscription', e);
      alert('Error removing credits');
    }
  };

  const fetchUserSubscriptions = async (username: string) => {
    if (!username) return;
    try {
      setLoadingSubsFor(username);
              const res = await fetch(`https://www.api.webmixo.com/admin/users/${encodeURIComponent(username)}/subscriptions`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
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
      const requestBody: any = {
        username: creditUser,
        credits: creditAmount
      };

      // If a subscription is selected, add it to the request
      if (selectedSubscription) {
        requestBody.service_id = selectedSubscription;
      }

      const response = await fetch('https://www.api.webmixo.com/admin/add-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        const message = selectedSubscription 
          ? `Added ${creditAmount} credits to subscription ${selectedSubscription} for ${creditUser}`
          : `Added ${creditAmount} credits to ${creditUser}`;
        alert(message);
        setCreditUser('');
        setSelectedSubscription('');
        setCreditAmount(0);
        fetchData();
      } else {
        const error = await response.text();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error adding credits:', error);
      alert('Error adding credits');
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
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
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
                <input
                  type="text"
                  placeholder="Service Name"
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Image URL"
                  value={newService.image}
                  onChange={(e) => setNewService({ ...newService, image: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
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
                        placeholder="Account ID"
                        value={account.id}
                        onChange={(e) => updateAccountField(index, 'id', e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={account.password}
                        onChange={(e) => updateAccountField(index, 'password', e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                      <input
                        type="date"
                        value={formatDateForInput(account.end_date)}
                        onChange={(e) => updateAccountField(index, 'end_date', formatDateForDisplay(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={account.is_active}
                          onChange={(e) => updateAccountField(index, 'is_active', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">Active</label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={editingService ? () => handleEditService(editingService) : handleCreateService}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingService ? 'Update Service' : 'Create Service'}
                </button>
                {editingService && (
                  <button
                    onClick={() => {
                      setEditingService(null);
                      setShowEditForm(false);
                      setNewService({
                        name: '',
                        image: '',
                        accounts: [{ id: '', password: '', end_date: '', is_active: true }]
                      });
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Cancel Edit
                  </button>
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
                        <button
                          onClick={() => startEditService(service.name)}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          Edit
                        </button>
                        {/* Edit Credits hidden for now */}
                        <button
                          onClick={() => handleDeleteService(service.name)}
                          className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </div>
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
                <button
                  onClick={handleAddSubscription}
                  disabled={addingSubscription}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingSubscription ? 'Adding...' : 'Add Subscription'}
                </button>
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
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm">
                                      <div><span className="font-medium">Service:</span> {s.service_name}</div>
                                      <div><span className="font-medium">Account:</span> {s.account_id}</div>
                                      <div><span className="font-medium">End Date:</span> {s.end_date}</div>
                                      <div><span className="font-medium">Active:</span> {s.is_active ? 'Yes' : 'No'}</div>
                                      <div />
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
                              <div><span className="font-medium">Service:</span> {s.service_name}</div>
                              <div><span className="font-medium">Account:</span> {s.account_id}</div>
                              <div><span className="font-medium">End Date:</span> {s.end_date}</div>
                              <div><span className="font-medium">Active:</span> {s.is_active ? 'Yes' : 'No'}</div>
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
                                      type="text"
                                      placeholder="DD-MM-YYYY"
                                      value={endDateEdits[s.account_id] ?? ''}
                                      onChange={(e) => setEndDateEdits(prev => ({ ...prev, [s.account_id]: e.target.value }))}
                                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-xs"
                                    />
                                    <button
                                      onClick={async () => {
                                        const input = (endDateEdits[s.account_id] || '').trim();
                                        if (!/^\d{2}-\d{2}-\d{4}$/.test(input)) {
                                          alert('Please enter date in DD-MM-YYYY format');
                                          return;
                                        }
                                        const ddmmyyyy = input.replace(/-/g, '/');
                                        try {
                                          const res = await fetch(`https://www.api.webmixo.com/admin/users/update-subscription-end-date`, {
                                            method: 'POST',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              'Authorization': `Bearer ${localStorage.getItem('token')}`
                                            },
                                            body: JSON.stringify({ username: userSubs.username, service_id: s.account_id, end_date: ddmmyyyy })
                                          });
                                          if (!res.ok) throw new Error(await res.text());
                                          const refreshed = await fetch(`https://www.api.webmixo.com/admin/users/${encodeURIComponent(userSubs.username)}/subscriptions`, {
                                            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                                          });
                                          if (refreshed.ok) {
                                            const data = await refreshed.json();
                                            setUserSubs(data);
                                          }
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
                                      const res = await fetch(`https://www.api.webmixo.com/admin/users/remove-subscription`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'Authorization': `Bearer ${localStorage.getItem('token')}`
                                        },
                                        body: JSON.stringify({ username: userSubs.username, service_id: s.account_id })
                                      });
                                      if (!res.ok) throw new Error(await res.text());
                                      const refreshed = await fetch(`https://www.api.webmixo.com/admin/users/${encodeURIComponent(userSubs.username)}/subscriptions`, {
                                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                                      });
                                      if (refreshed.ok) {
                                        const data = await refreshed.json();
                                        setUserSubs(data);
                                      }
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
                <button
                  onClick={handleAddCredits}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Add Credits
                </button>
                <button
                  onClick={handleRemoveCredits}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Remove Credits
                </button>
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
                <p>• Quillbot: 100 (7d) → 3500 (1y)</p>
                <p>• Grammarly: 80 (7d) → 3000 (1y)</p>
                <p>• ChatGPT: 150 (7d) → 4500 (1y)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
