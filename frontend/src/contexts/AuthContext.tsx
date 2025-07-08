import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, storeUserData, clearUserData } from '../api';
import { getValidToken, refreshAccessToken } from '../utils/auth';

interface User {
  username: string;
  email: string;
  user_id: string;
  role: string;
  disabled?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const refreshToken = async (): Promise<boolean> => {
    try {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Extract user data from new token
        const userData = decodeToken(newToken);
        if (userData && userData.sub && userData.email && userData.user_id) {
          const user = {
            username: userData.sub,
            email: userData.email,
            user_id: userData.user_id,
            role: userData.role || 'user'
          };
          setUser(user);
          storeUserData(user);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  };

  const checkAuth = async () => {
    try {
      const token = await getValidToken();
      if (token) {
        // Try to decode user data from token first
        const userData = decodeToken(token);
        if (userData && userData.sub && userData.email && userData.user_id) {
          setUser({
            username: userData.sub,
            email: userData.email,
            user_id: userData.user_id,
            role: userData.role || 'user'
          });
          storeUserData({
            username: userData.sub,
            email: userData.email,
            user_id: userData.user_id,
            role: userData.role || 'user'
          });
        } else {
          // Fallback to /me endpoint if token doesn't contain user data
          const userDataFromAPI = await getMe();
          setUser(userDataFromAPI as User);
          storeUserData(userDataFromAPI);
        }
      } else {
        // No valid token, try to refresh
        const refreshSuccess = await refreshToken();
        if (!refreshSuccess) {
          // Refresh failed, clear everything
          setUser(null);
          clearUserData();
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setUser(null);
      clearUserData();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (token: string) => {
    localStorage.setItem('token', token);
    
    // Extract user data from token
    const userData = decodeToken(token);
    if (userData && userData.sub && userData.email && userData.user_id) {
      const user = {
        username: userData.sub,
        email: userData.email,
        user_id: userData.user_id,
        role: userData.role || 'user'
      };
      setUser(user);
      storeUserData(user);
    } else {
      // Fallback to /me endpoint
      await checkAuth();
    }
    
    navigate('/dashboard');
  };

  const logout = () => {
    clearUserData();
    setUser(null);
    navigate('/auth');
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    checkAuth,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 