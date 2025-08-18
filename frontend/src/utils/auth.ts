// Auth utility functions for token management

export const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return null;
    }

    const response = await fetch('http://127.0.0.1:8000/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      return null;
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    return null;
  }
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    return true;
  }
};

export const getValidToken = async (): Promise<string | null> => {
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
}; 