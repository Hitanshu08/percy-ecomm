# CORS Configuration Guide

## Current Setup (Development)

The backend is currently configured to allow all origins (`*`) for development purposes. This allows the frontend to connect from any domain/port.

## Production CORS Setup

### 1. Replace Wildcard Origins

**Current (Development):**
```python
origins = ["*"]
```

**Production (Recommended):**
```python
origins = [
    "https://yourdomain.com",
    "https://www.yourdomain.com",
    "https://app.yourdomain.com",
    # Add your specific frontend domains here
]
```

### 2. Restrict HTTP Methods

**Current (Development):**
```python
allow_methods=["*"]
```

**Production (Recommended):**
```python
allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
```

### 3. Restrict Headers

**Current (Development):**
```python
allow_headers=["*"]
```

**Production (Recommended):**
```python
allow_headers=[
    "Authorization",
    "Content-Type",
    "Accept",
    "Origin",
    "X-Requested-With"
]
```

### 4. Environment-Based Configuration

For better security, use environment variables:

```python
import os

# Development
if os.getenv("ENVIRONMENT") == "development":
    origins = ["*"]
else:
    # Production
    origins = [
        "https://yourdomain.com",
        "https://www.yourdomain.com"
    ]
```

### 5. Security Best Practices

1. **Never use `*` in production**
2. **Be specific about allowed origins**
3. **Use HTTPS in production**
4. **Consider using a proxy (nginx) for additional security**
5. **Regularly audit allowed origins**

### 6. Testing CORS

You can test CORS configuration using:

```bash
# Test from browser console
fetch('https://api.valuesubs.com/health', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

### 7. Common CORS Issues

- **Preflight requests**: Browser sends OPTIONS request before actual request
- **Credentials**: Set `allow_credentials=True` if using cookies/sessions
- **Headers**: Ensure all required headers are in `allow_headers`

### 8. Monitoring

Monitor CORS errors in your application logs and browser console for any blocked requests.

## Quick Production Checklist

- [ ] Replace `*` with specific origins
- [ ] Restrict HTTP methods
- [ ] Restrict headers
- [ ] Use HTTPS
- [ ] Test all endpoints
- [ ] Monitor for CORS errors
- [ ] Document allowed origins 