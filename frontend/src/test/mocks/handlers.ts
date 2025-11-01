import { http, HttpResponse } from 'msw'

export const handlers = [
  // Auth endpoints
  http.post('/api/v1/login', () => {
    return HttpResponse.json({
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      token_type: 'bearer'
    })
  }),

  http.post('/api/v1/refresh', () => {
    return HttpResponse.json({
      access_token: 'new_access_token',
      refresh_token: 'new_refresh_token',
      token_type: 'bearer'
    })
  }),

  http.post('/api/v1/signup', () => {
    return HttpResponse.json({
      message: 'User created successfully'
    })
  }),

  // User endpoints
  http.get('/api/v1/profile', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'user',
      is_active: true,
      credits: 100.0
    })
  }),

  http.get('/api/v1/check-username', ({ request }) => {
    const url = new URL(request.url)
    const username = url.searchParams.get('username')
    
    if (username === 'existinguser') {
      return HttpResponse.json({ available: false })
    }
    return HttpResponse.json({ available: true })
  }),

  // Services endpoints
  http.get('/api/v1/services', () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Test Service',
        description: 'A test service',
        price: 10.0,
        credits: 100,
        is_active: true
      },
      {
        id: 2,
        name: 'Premium Service',
        description: 'A premium service',
        price: 25.0,
        credits: 250,
        is_active: true
      }
    ])
  }),

  http.post('/api/v1/purchase-subscription', () => {
    return HttpResponse.json({
      message: 'Subscription purchased successfully'
    })
  }),

  http.get('/api/v1/subscriptions', () => {
    return HttpResponse.json([
      {
        id: 1,
        service_name: 'Test Service',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        is_active: true
      }
    ])
  }),

  // Wallet endpoints
  http.get('/api/v1/wallet', () => {
    return HttpResponse.json({
      user_id: 1,
      credits: 100.0,
      transactions: [
        {
          id: 1,
          type: 'deposit',
          amount: 50.0,
          date: '2024-01-01',
          description: 'Credit deposit'
        }
      ]
    })
  }),

  http.post('/api/v1/wallet/deposit', () => {
    return HttpResponse.json({
      message: 'Credits deposited successfully'
    })
  }),

  // Admin endpoints
  http.get('/api/v1/admin/users', () => {
    return HttpResponse.json([
      {
        id: 1,
        username: 'user1',
        email: 'user1@test.com',
        role: 'user',
        credits: 100.0,
        is_active: true
      },
      {
        id: 2,
        username: 'user2',
        email: 'user2@test.com',
        role: 'user',
        credits: 200.0,
        is_active: true
      }
    ])
  }),

  http.post('/api/v1/admin/assign-subscription', () => {
    return HttpResponse.json({
      message: 'Subscription assigned successfully'
    })
  }),

  http.post('/api/v1/admin/add-credits', () => {
    return HttpResponse.json({
      message: 'Credits added successfully'
    })
  }),

  // Health check
  http.get('/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      database: 'connected'
    })
  }),

  // Root endpoint
  http.get('/', () => {
    return HttpResponse.json({
      message: 'Valuesubs E-commerce API',
      version: '1.0.0'
    })
  })
]
