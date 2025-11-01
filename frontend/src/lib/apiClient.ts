import { config } from '../config/index';

const API_URL = config.getApiUrl();

// Function to decode JWT token and extract user data
function decodeToken(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

// Get user data from localStorage or context
function getUserData() {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
}

// Check if token is expired
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    return true;
  }
}

let refreshPromise: Promise<string | null> | null = null;

// Refresh access token
async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        return null;
      }

      const response = await fetch(`${API_URL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newAccessToken = data.access_token;
        localStorage.setItem('token', newAccessToken);
        return newAccessToken;
      } else {
        // Refresh token is invalid, clear all tokens
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        return null;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// Get valid token (refresh if needed)
async function getValidToken(): Promise<string | null> {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return null;
  }

  if (isTokenExpired(token)) {
    // Token is expired, try to refresh
    const newToken = await refreshAccessToken();
    return newToken;
  }

  return token;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Enhanced auth headers with user information
async function authHeadersWithUser(): Promise<Record<string, string>> {
  const token = await getValidToken();
  const user = getUserData();
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0"
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  if (user) {
    headers["X-User-ID"] = user.user_id;
    headers["X-Username"] = user.username;
    headers["X-User-Email"] = user.email;
    headers["X-User-Role"] = user.role;
  }
  
  return headers;
}

// Auth headers for form data
async function authHeadersFormData(): Promise<Record<string, string>> {
  const token = await getValidToken();
  const user = getUserData();
  
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0"
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  if (user) {
    headers["X-User-ID"] = user.user_id;
    headers["X-Username"] = user.username;
    headers["X-User-Email"] = user.email;
    headers["X-User-Role"] = user.role;
  }
  
  return headers;
}

function serverErrorGuard(res: Response) {
  if (res.status >= 500) {
    try {
      window.alert('Issue with server. Please try again later.');
    } catch (_) {
      // non-browser env, ignore
    }
    const err = new Error('server_error');
    (err as any).code = 'SERVER_ERROR';
    throw err;
  }
}

async function handle(res: Response) {
  serverErrorGuard(res);
  // Generic 4xx handler: display backend-provided detail
  if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 403) {
    try {
      const data = await res.json();
      const detail = (data && (data.detail || data.message)) || `${res.status}`;
      try { alert(detail); } catch (_) {}
      const err = new Error(detail);
      (err as any).code = res.status;
      (err as any).response = { status: res.status, data };
      throw err;
    } catch (_) {
      const txt = await res.text();
      try { alert(txt || `${res.status}`); } catch (_) {}
      const err = new Error(txt || `${res.status}`);
      (err as any).code = res.status;
      (err as any).response = { status: res.status, data: { detail: txt } };
      throw err;
    }
  }
  if (res.status === 401) {
    // Try to refresh token on 401 once, but don't redirect here
    const newToken = await refreshAccessToken();
    if (!newToken) {
      throw new Error("Authentication failed");
    }
    throw new Error("Token refreshed, retry request");
  }
  
  if (res.status === 403) {
    window.location.href = "/access-denied";
    throw new Error("access_denied");
  }
  
  if (!res.ok) {
    try {
      const data = await res.json();
      const err = new Error((data && (data.detail || data.message)) || `${res.status}`);
      (err as any).code = res.status;
      (err as any).response = { status: res.status, data };
      throw err;
    } catch (_) {
      const txt = await res.text();
      const err = new Error(txt || `${res.status}`);
      (err as any).code = res.status;
      (err as any).response = { status: res.status, data: { detail: txt } };
      throw err;
    }
  }
  return res.json();
}

// Enhanced API call function with automatic token refresh
export async function apiCall<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeadersWithUser();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  serverErrorGuard(response);

  if (response.status === 401) {
    // Try to refresh token, coalesced
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry the request with new token
      const newHeaders = await authHeadersWithUser();
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          ...newHeaders,
          ...options.headers,
        },
      });
      
      serverErrorGuard(retryResponse);
      if (!retryResponse.ok) {
        if (retryResponse.status === 401) {
          // Final auth failure; clear and redirect
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/auth';
        }
        try {
          const data = await retryResponse.json();
          const err = new Error((data && (data.detail || data.message)) || `${retryResponse.status}`);
          (err as any).code = retryResponse.status;
          (err as any).response = { status: retryResponse.status, data };
          throw err;
        } catch (_) {
          const txt = await retryResponse.text();
          const err = new Error(txt || `${retryResponse.status}`);
          (err as any).code = retryResponse.status;
          (err as any).response = { status: retryResponse.status, data: { detail: txt } };
          throw err;
        }
      }
      
      return retryResponse.json();
    } else {
      // Refresh failed, redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/auth';
      throw new Error("Authentication failed");
    }
  }
  
  if (!response.ok) {
    throw new Error(await response.text());
  }
  
  return response.json();
}

// Auth API calls
export async function signup(username: string, email: string, password: string, referralCode?: string) {
  const response = await fetch(`${API_URL}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0"
     },
    body: JSON.stringify({ username, email, password, referral_code: referralCode })
  });
  serverErrorGuard(response);
  return handle(response);
}

export async function verifyEmail(token: string) {
  const response = await fetch(`${API_URL}/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  serverErrorGuard(response);
  return handle(response);
}

export async function resendVerificationEmail(email: string) {
  const response = await fetch(`${API_URL}/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  serverErrorGuard(response);
  return handle(response);
}

export async function getMyReferralCode(): Promise<{ referral_code: string }> {
  return apiCall<{ referral_code: string }>(`${API_URL}/me/referral-code`);
}

export async function getMyReferralStats(): Promise<{ referral_code: string; referrals_count: number; total_credits_earned: number }> {
  return apiCall<{ referral_code: string; referrals_count: number; total_credits_earned: number }>(`${API_URL}/me/referral-stats`);
}

export async function checkUsername(username: string): Promise<{ available: boolean }> {
  const url = `${API_URL}/check-username?username=${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  return handle(res);
}

export async function login(email: string, password: string) {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const response = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded',
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0"
     },
    body: formData
  });

  // Map precise errors
  if (response.status === 404) {
    let detail = 'User does not exist';
    try { const j = await response.json(); detail = j.detail || detail; } catch {}
    throw new Error(JSON.stringify({ code: 404, detail }));
  }
  if (response.status === 401) {
    let detail = 'Incorrect password.';
    try { const j = await response.json(); detail = j.detail || detail; } catch {}
    throw new Error(JSON.stringify({ code: 401, detail }));
  }
  if (response.status === 403) {
    let detail = 'Please verify your email before logging in.';
    try { 
      const j = await response.json(); 
      detail = j.detail || detail; 
      const err = new Error(detail);
      (err as any).code = 403;
      (err as any).response = { status: 403, data: j };
      throw err;
    } catch (e) {
      if (e instanceof Error && (e as any).code === 403) throw e;
      const err = new Error(detail);
      (err as any).code = 403;
      (err as any).response = { status: 403, data: { detail } };
      throw err;
    }
  }
  if (!response.ok) {
    // Genuine server failures
    let detail = 'Something went wrong on our side. Please try again.';
    try { const j = await response.json(); if (j && j.detail) detail = j.detail; } catch {}
    throw new Error(JSON.stringify({ code: response.status, detail }));
  }

  const data = await response.json();
  
  // Store tokens
  localStorage.setItem('token', data.access_token);
  localStorage.setItem('refreshToken', data.refresh_token);
  
  // Decode and store user data
  const userData = decodeToken(data.access_token);
  if (userData) {
    localStorage.setItem('user', JSON.stringify(userData));
  }
  
  return data;
}

export async function forgotPassword(email: string) {
  const response = await fetch(`${API_URL}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0"
     },
    body: JSON.stringify({ email })
  });
  return handle(response);
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
  const response = await fetch(`${API_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0"
     },
    body: JSON.stringify({ email, otp, new_password: newPassword })
  });
  return handle(response);
}

export async function verifyOtp(email: string, otp: string) {
  const response = await fetch(`${API_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0"
     },
    body: JSON.stringify({ email, otp })
  });
  return handle(response);
}

// User API calls
export async function getDashboard() {
  return apiCall(`${API_URL}/dashboard`);
}

export async function changePassword(oldPass: string, newPass: string) {
  return apiCall(`${API_URL}/change-password`, {
    method: 'POST',
    body: JSON.stringify({ current_password: oldPass, new_password: newPass })
  });
}

export async function getWallet() {
  return apiCall(`${API_URL}/wallet`);
}

export async function deposit(amount: number) {
  return apiCall(`${API_URL}/wallet/deposit`, {
    method: 'POST',
    body: JSON.stringify({ amount })
  });
}

export async function createWalletPayment(bundle: '1'|'2'|'5'|'10'|'20'|'50') {
  return apiCall(`${API_URL}/wallet/payment/create?bundle=${encodeURIComponent(bundle)}`, {
    method: 'POST'
  });
}

export async function createPaypalOrder(bundle: '1'|'2'|'5'|'10'|'20'|'50') {
  return apiCall(`${API_URL}/wallet/payment/paypal/create?bundle=${encodeURIComponent(bundle)}`, {
    method: 'POST'
  });
}

export async function capturePaypalOrder(orderId: string) {
  return apiCall(`${API_URL}/wallet/payment/paypal/capture?order_id=${encodeURIComponent(orderId)}`, {
    method: 'POST'
  });
}

export async function getSubscriptions() {
  return apiCall(`${API_URL}/subscriptions`);
}

export async function getMe() {
  return apiCall(`${API_URL}/me`);
}

export async function getNotifications() {
  return apiCall(`${API_URL}/notifications`);
}

// Admin API calls
export async function adminAddSubscription(username: string, serviceName: string, duration: string) {
  return apiCall(`${API_URL}/admin/assign-subscription`, {
    method: 'POST',
    body: JSON.stringify({ username, service_name: serviceName, duration })
  });
}

export async function adminUpdateService(service: string, id: string, password: string) {
  return apiCall(`${API_URL}/admin/services/${service}`, {
    method: 'PUT',
    body: JSON.stringify({ id, password })
  });
}

// User data management
export function storeUserData(userData: any) {
  localStorage.setItem('user', JSON.stringify(userData));
}

export function clearUserData() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

// Service API calls
export async function getServices() {
  return apiCall(`${API_URL}/services`);
}

export async function createService(serviceData: {
  name: string;
  image: string;
  accounts: Array<{
    id: string;
    password: string;
    end_date: string;
    is_active: boolean;
  }>;
}) {
  return apiCall(`${API_URL}/admin/services`, {
    method: 'POST',
    body: JSON.stringify(serviceData)
  });
}

export async function updateService(serviceName: string, serviceData: {
  name: string;
  image: string;
  accounts: Array<{
    id: string;
    password: string;
    end_date: string;
    is_active: boolean;
  }>;
}) {
  return apiCall(`${API_URL}/admin/services/${serviceName}`, {
    method: 'PUT',
    body: JSON.stringify(serviceData)
  });
}

export async function getServiceCredits(serviceName: string) {
  return apiCall(`${API_URL}/admin/services/${serviceName}/credits`);
}

export async function putServiceCredits(serviceName: string, creditsMap: Record<string, number>) {
  return apiCall(`${API_URL}/admin/services/${serviceName}/credits`, {
    method: 'PUT',
    body: JSON.stringify(creditsMap)
  });
}

export async function deleteService(serviceName: string) {
  return apiCall(`${API_URL}/admin/services/${serviceName}`, {
    method: 'DELETE'
  });
}

export async function getAdminUserSubscriptions(username: string) {
  return apiCall(`${API_URL}/admin/users/${encodeURIComponent(username)}/subscriptions`);
}

export async function addCredits(username: string, credits: number, serviceId?: string) {
  const body: Record<string, unknown> = { username, credits };
  if (serviceId) body.service_id = serviceId;
  return apiCall(`${API_URL}/admin/add-credits`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function getAdminServices(page: number = 1, size: number = 20, search?: string) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (search && search.trim()) params.append('search', search.trim());
  return apiCall(`${API_URL}/admin/services?${params.toString()}`);
}

export async function getAdminUsers(page: number = 1, size: number = 20, search?: string) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (search && search.trim()) params.append('search', search.trim());
  return apiCall(`${API_URL}/admin/users?${params.toString()}`);
}

export async function purchaseSubscription(serviceName: string, duration: string) {
  return apiCall(`${API_URL}/purchase-subscription`, {
    method: 'POST',
    body: JSON.stringify({ service_name: serviceName, duration })
  });
}

export async function getCurrentSubscriptions() {
  return apiCall(`${API_URL}/user/subscriptions/current`);
}

// Fetch a single service by name
export async function getService(serviceName: string) {
  return apiCall(`${API_URL}/admin/services/${encodeURIComponent(serviceName)}`);
}

// Remove credits globally or for a specific subscription
export async function removeCredits(username: string, credits: number, serviceId?: string) {
  const body: Record<string, unknown> = { username, credits };
  if (serviceId) body.service_id = serviceId;
  return apiCall(`${API_URL}/admin/remove-credits`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

// Update a user's subscription end date
export async function updateUserSubscriptionEndDate(
  username: string,
  serviceId: string,
  endDate: string
) {
  return apiCall(`${API_URL}/admin/users/update-subscription-end-date`, {
    method: 'POST',
    body: JSON.stringify({ username, service_id: serviceId, end_date: endDate })
  });
}

// Remove a user's subscription
export async function removeUserSubscription(username: string, serviceId: string) {
  return apiCall(`${API_URL}/admin/users/remove-subscription`, {
    method: 'POST',
    body: JSON.stringify({ username, service_id: serviceId })
  });
}
