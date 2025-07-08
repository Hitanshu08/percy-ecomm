import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getServices, createService, updateService, deleteService, adminAddSubscription } from '../api';

interface ServiceAccount {
  id: string;
  password: string;
  end_date: string;
  is_active: boolean;
}

interface Service {
  name: string;
  accounts: ServiceAccount[];
}

interface ServiceData {
  name: string;
  accounts: ServiceAccount[];
}

export default function AdminPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServiceData>({
    name: '',
    accounts: [{ id: '', password: '', end_date: '', is_active: true }]
  });
  const [subscriptionForm, setSubscriptionForm] = useState({
    username: '',
    service_name: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const data = await getServices();
      setServices(Object.entries(data.services).map(([name, service]: [string, any]) => ({
        name,
        accounts: service.accounts || []
      })));
    } catch (err: any) {
      setError('Failed to load services');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAccountChange = (index: number, field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      accounts: prev.accounts.map((account, i) => 
        i === index ? { ...account, [field]: value } : account
      )
    }));
  };

  const addAccount = () => {
    setFormData(prev => ({
      ...prev,
      accounts: [...prev.accounts, { id: '', password: '', end_date: '', is_active: true }]
    }));
  };

  const removeAccount = (index: number) => {
    setFormData(prev => ({
      ...prev,
      accounts: prev.accounts.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingService) {
        await updateService(editingService, formData);
        setSuccess(`Service ${formData.name} updated successfully`);
      } else {
        await createService(formData);
        setSuccess(`Service ${formData.name} created successfully`);
      }
      
      setShowCreateForm(false);
      setEditingService(null);
      setFormData({ name: '', accounts: [{ id: '', password: '', end_date: '', is_active: true }] });
      loadServices();
    } catch (err: any) {
      setError(err.message || 'Failed to save service');
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service.name);
    setFormData({
      name: service.name,
      accounts: service.accounts.map(acc => ({
        id: acc.id,
        password: '', // Don't show existing passwords
        end_date: acc.end_date,
        is_active: acc.is_active
      }))
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (serviceName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${serviceName}?`)) return;
    
    try {
      await deleteService(serviceName);
      setSuccess(`Service ${serviceName} deleted successfully`);
      loadServices();
    } catch (err: any) {
      setError(err.message || 'Failed to delete service');
    }
  };

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await adminAddSubscription(subscriptionForm.username, subscriptionForm.service_name);
      setSuccess(`Subscription added for ${subscriptionForm.username}`);
      setSubscriptionForm({ username: '', service_name: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to add subscription');
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingService(null);
              setFormData({ name: '', accounts: [{ id: '', password: '', end_date: '', is_active: true }] });
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              theme === 'dark' 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            Add New Service
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* Create/Edit Service Form */}
        {showCreateForm && (
          <div className={`mb-8 p-4 rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
            <h2 className="text-2xl font-bold mb-6">
              {editingService ? 'Edit Service' : 'Create New Service'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Service Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                    theme === 'dark' 
                      ? 'border-gray-600 focus:border-blue-500 bg-gray-700 text-white' 
                      : 'border-gray-300 focus:border-blue-500 bg-white text-gray-900'
                  }`}
                  placeholder="Enter service name"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium">Accounts</label>
                  <button
                    type="button"
                    onClick={addAccount}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      theme === 'dark' 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    Add Account
                  </button>
                </div>

                {formData.accounts.map((account, index) => (
                  <div key={index} className={`p-4 rounded-lg border mb-4 ${theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium">Account {index + 1}</h4>
                      {formData.accounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAccount(index)}
                          className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                            theme === 'dark' 
                              ? 'bg-red-600 hover:bg-red-700 text-white' 
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          }`}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Account ID</label>
                        <input
                          type="text"
                          value={account.id}
                          onChange={(e) => handleAccountChange(index, 'id', e.target.value)}
                          className={`w-full px-3 py-2 rounded border transition-colors ${
                            theme === 'dark' 
                              ? 'border-gray-600 focus:border-blue-500 bg-gray-600 text-white' 
                              : 'border-gray-300 focus:border-blue-500 bg-white text-gray-900'
                          }`}
                          placeholder="Account ID"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Password</label>
                        <input
                          type="password"
                          value={account.password}
                          onChange={(e) => handleAccountChange(index, 'password', e.target.value)}
                          className={`w-full px-3 py-2 rounded border transition-colors ${
                            theme === 'dark' 
                              ? 'border-gray-600 focus:border-blue-500 bg-gray-600 text-white' 
                              : 'border-gray-300 focus:border-blue-500 bg-white text-gray-900'
                          }`}
                          placeholder={editingService ? 'Leave blank to keep current' : 'Password'}
                          required={!editingService}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">End Date</label>
                        <input
                          type="date"
                          value={account.end_date}
                          onChange={(e) => handleAccountChange(index, 'end_date', e.target.value)}
                          className={`w-full px-3 py-2 rounded border transition-colors ${
                            theme === 'dark' 
                              ? 'border-gray-600 focus:border-blue-500 bg-gray-600 text-white' 
                              : 'border-gray-300 focus:border-blue-500 bg-white text-gray-900'
                          }`}
                          required
                        />
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`active-${index}`}
                          checked={account.is_active}
                          onChange={(e) => handleAccountChange(index, 'is_active', e.target.checked)}
                          className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                            theme === 'dark' ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                          }`}
                        />
                        <label htmlFor={`active-${index}`} className="ml-2 text-sm font-medium">
                          Active
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    theme === 'dark' 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {editingService ? 'Update Service' : 'Create Service'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingService(null);
                    setFormData({ name: '', accounts: [{ id: '', password: '', end_date: '', is_active: true }] });
                  }}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    theme === 'dark' 
                      ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                      : 'bg-gray-600 hover:bg-gray-700 text-white'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Services List */}
        <div className={`p-4 rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <h2 className="text-2xl font-bold mb-6">Services</h2>
          
          {isLoading ? (
            <div className="text-center py-8">Loading services...</div>
          ) : services.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No services found</div>
          ) : (
            <div className="space-y-6">
              {services.map((service) => (
                <div key={service.name} className={`p-4 rounded-lg border ${theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold">{service.name}</h3>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                        {service.accounts.length} account{service.accounts.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(service)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          theme === 'dark' 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(service.name)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          theme === 'dark' 
                            ? 'bg-red-600 hover:bg-red-700 text-white' 
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {service.accounts.map((account, index) => (
                      <div key={index} className={`p-3 rounded border ${theme === 'dark' ? 'border-gray-500 bg-gray-600' : 'border-gray-200 bg-white'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium">ID:</span> {account.id}
                          </div>
                          <div>
                            <span className="font-medium">End Date:</span> {account.end_date}
                          </div>
                          <div>
                            <span className="font-medium">Status:</span>
                            <span className={`ml-1 px-2 py-1 rounded text-xs ${
                              account.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {account.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Subscription Form */}
        <div className={`mt-8 p-4 rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <h2 className="text-2xl font-bold mb-6">Add User Subscription</h2>
          
          <form onSubmit={handleAddSubscription} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Username</label>
                <input
                  type="text"
                  value={subscriptionForm.username}
                  onChange={(e) => setSubscriptionForm(prev => ({ ...prev, username: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                    theme === 'dark' 
                      ? 'border-gray-600 focus:border-blue-500 bg-gray-700 text-white' 
                      : 'border-gray-300 focus:border-blue-500 bg-white text-gray-900'
                  }`}
                  placeholder="Enter username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Service</label>
                <select
                  value={subscriptionForm.service_name}
                  onChange={(e) => setSubscriptionForm(prev => ({ ...prev, service_name: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                    theme === 'dark' 
                      ? 'border-gray-600 focus:border-blue-500 bg-gray-700 text-white' 
                      : 'border-gray-300 focus:border-blue-500 bg-white text-gray-900'
                  }`}
                  required
                >
                  <option value="">Select a service</option>
                  {services.map((service) => (
                    <option key={service.name} value={service.name}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                theme === 'dark' 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              Add Subscription
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 