# Testing Guide for Percy E-commerce

This document provides comprehensive information about the testing setup for both the backend and frontend of the Percy E-commerce application.

## Table of Contents

- [Overview](#overview)
- [Backend Testing](#backend-testing)
- [Frontend Testing](#frontend-testing)
- [E2E Testing](#e2e-testing)
- [Running Tests](#running-tests)
- [Test Commands](#test-commands)
- [Coverage Reports](#coverage-reports)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)

## Overview

The testing suite includes:

- **Backend Unit Tests**: FastAPI endpoints, services, and business logic
- **Backend Integration Tests**: Complete API flows and database interactions
- **Frontend Unit Tests**: React components, hooks, and utilities
- **Frontend E2E Tests**: Complete user workflows using Playwright

## Backend Testing

### Test Framework
- **pytest**: Main testing framework
- **pytest-asyncio**: For testing async functions
- **httpx**: For testing FastAPI endpoints
- **pytest-cov**: For coverage reporting
- **faker**: For generating test data

### Test Structure
```
backend/
├── tests/
│   ├── __init__.py
│   ├── conftest.py              # Pytest configuration and fixtures
│   ├── test_auth.py             # Authentication tests
│   ├── test_users.py            # User management tests
│   ├── test_services.py         # Service and subscription tests
│   ├── test_wallet.py           # Wallet and payment tests
│   ├── test_admin.py            # Admin functionality tests
│   └── test_integration.py      # Integration tests
├── pytest.ini                  # Pytest configuration
├── requirements-test.txt        # Testing dependencies
└── run_tests.py                # Test runner script
```

### Key Features
- **Async Support**: Full support for testing async FastAPI endpoints
- **Database Mocking**: SQLite test database with automatic cleanup
- **API Testing**: Complete HTTP request/response testing
- **Mocking**: Comprehensive mocking of external dependencies
- **Fixtures**: Reusable test data and setup

## Frontend Testing

### Test Framework
- **Vitest**: Fast unit test runner (Vite-native)
- **React Testing Library**: Component testing utilities
- **MSW (Mock Service Worker)**: API mocking
- **Playwright**: E2E testing
- **jsdom**: DOM environment for unit tests

### Test Structure
```
frontend/
├── src/
│   └── test/
│       ├── setup.ts             # Test setup and global mocks
│       ├── mocks/
│       │   ├── server.ts        # MSW server setup
│       │   └── handlers.ts      # API mock handlers
│       ├── components/          # Component unit tests
│       ├── pages/               # Page component tests
│       └── utils/               # Utility function tests
├── tests/
│   └── e2e/                     # E2E tests
│       ├── auth.spec.ts         # Authentication flows
│       ├── dashboard.spec.ts    # Dashboard functionality
│       ├── shop.spec.ts         # Shop and purchasing
│       └── navigation.spec.ts   # Navigation and routing
├── vitest.config.ts             # Vitest configuration
├── playwright.config.ts         # Playwright configuration
└── run_tests.js                 # Test runner script
```

### Key Features
- **Component Testing**: Isolated component testing with React Testing Library
- **API Mocking**: Realistic API responses using MSW
- **E2E Testing**: Cross-browser testing with Playwright
- **Coverage**: Comprehensive code coverage reporting
- **Responsive Testing**: Mobile and desktop viewport testing

## E2E Testing

### Playwright Configuration
- **Multi-browser**: Chrome, Firefox, Safari
- **Mobile Testing**: iPhone and Android viewports
- **Screenshots**: Automatic screenshots on failure
- **Video Recording**: Video recording for failed tests
- **Parallel Execution**: Tests run in parallel for speed

### Test Scenarios
1. **Authentication Flow**: Login, signup, password reset
2. **Dashboard**: User dashboard with data display
3. **Shop**: Service browsing and purchasing
4. **Navigation**: Menu navigation and routing
5. **Admin Panel**: Admin-only functionality
6. **Responsive Design**: Mobile and desktop layouts

## Running Tests

### Prerequisites

1. **Backend Dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt -r requirements-test.txt
   ```

2. **Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   npx playwright install
   ```

### Quick Start

Run all tests:
```bash
./run_all_tests.sh
```

## Test Commands

### Backend Tests

#### Individual Test Files
```bash
# Run specific test file
python run_tests.py --file test_auth.py

# Run with verbose output
python run_tests.py --file test_auth.py --verbose
```

#### Test Types
```bash
# Unit tests only
python run_tests.py --type unit

# Integration tests only
python run_tests.py --type integration

# All tests
python run_tests.py --type all

# Coverage report
python run_tests.py --type coverage
```

#### Advanced Options
```bash
# Parallel execution
python run_tests.py --parallel

# Verbose output
python run_tests.py --verbose

# Specific markers
pytest -m auth tests/
pytest -m "not slow" tests/
```

### Frontend Tests

#### Unit Tests
```bash
# Run unit tests
npm run test:run

# Watch mode
npm run test:watch

# With UI
npm run test:ui

# Coverage report
npm run test:coverage
```

#### E2E Tests
```bash
# Run e2e tests
npm run test:e2e

# With UI
npm run test:e2e:ui

# Headed mode (see browser)
npm run test:e2e:headed

# Specific browser
npx playwright test --project=chromium
```

#### Using Test Runner Script
```bash
# Unit tests
node run_tests.js unit

# E2E tests
node run_tests.js e2e

# All tests
node run_tests.js all

# With options
node run_tests.js unit --coverage --verbose
node run_tests.js e2e --ui
```

### Combined Testing

#### Run All Tests
```bash
# All tests (backend + frontend)
./run_all_tests.sh

# Backend only
./run_all_tests.sh --backend-only

# Frontend only
./run_all_tests.sh --frontend-only

# With coverage
./run_all_tests.sh --coverage

# Install dependencies first
./run_all_tests.sh --install-deps
```

#### Specific Test Types
```bash
# Backend unit tests with coverage
./run_all_tests.sh --backend-type unit --coverage

# Frontend e2e tests only
./run_all_tests.sh --frontend-type e2e

# Verbose output
./run_all_tests.sh --verbose
```

## Coverage Reports

### Backend Coverage
```bash
# Generate HTML coverage report
python run_tests.py --type coverage

# View report
open backend/htmlcov/index.html
```

### Frontend Coverage
```bash
# Generate coverage report
npm run test:coverage

# View report
open frontend/coverage/index.html
```

### Coverage Thresholds
- **Backend**: 80% minimum coverage
- **Frontend**: 80% minimum coverage
- **Critical Paths**: 90% minimum coverage

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: cd backend && pip install -r requirements.txt -r requirements-test.txt
      - run: cd backend && python run_tests.py --type all

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm install
      - run: cd frontend && npx playwright install
      - run: cd frontend && npm run test:run
      - run: cd frontend && npm run test:e2e
```

## Best Practices

### Backend Testing
1. **Use Fixtures**: Leverage pytest fixtures for common setup
2. **Mock External Dependencies**: Mock database, external APIs, and services
3. **Test Edge Cases**: Include error conditions and boundary cases
4. **Async Testing**: Use `pytest-asyncio` for async function testing
5. **Database Isolation**: Use separate test database for each test

### Frontend Testing
1. **Test User Behavior**: Focus on what users can see and do
2. **Mock APIs**: Use MSW for realistic API mocking
3. **Accessibility**: Test with screen readers and keyboard navigation
4. **Responsive Testing**: Test on multiple viewport sizes
5. **Component Isolation**: Test components in isolation with proper mocking

### E2E Testing
1. **Realistic Scenarios**: Test complete user workflows
2. **Cross-browser Testing**: Test on multiple browsers
3. **Mobile Testing**: Include mobile viewport testing
4. **Data Cleanup**: Clean up test data after each test
5. **Parallel Execution**: Use parallel execution for faster feedback

### General Guidelines
1. **Write Tests First**: Follow TDD when possible
2. **Keep Tests Fast**: Optimize for speed without sacrificing quality
3. **Clear Test Names**: Use descriptive test names that explain the scenario
4. **Single Responsibility**: Each test should verify one specific behavior
5. **Maintainable Tests**: Keep tests simple and easy to understand

## Troubleshooting

### Common Issues

#### Backend Tests
- **Database Connection**: Ensure test database is properly configured
- **Async Issues**: Use `pytest-asyncio` for async test functions
- **Import Errors**: Check Python path and module imports

#### Frontend Tests
- **MSW Issues**: Ensure MSW handlers are properly configured
- **Component Rendering**: Check for missing providers or context
- **API Mocking**: Verify mock handlers match actual API endpoints

#### E2E Tests
- **Browser Installation**: Run `npx playwright install`
- **Port Conflicts**: Ensure test server ports are available
- **Timing Issues**: Add appropriate waits for async operations

### Debug Mode
```bash
# Backend debug
pytest --pdb tests/

# Frontend debug
npm run test:run -- --reporter=verbose

# E2E debug
npx playwright test --debug
```

## Contributing

When adding new tests:

1. **Follow Naming Conventions**: Use descriptive test names
2. **Add to Appropriate Suite**: Place tests in the correct directory
3. **Update Documentation**: Update this guide if needed
4. **Maintain Coverage**: Ensure new code is covered by tests
5. **Review Test Quality**: Ensure tests are reliable and maintainable

For questions or issues with the testing setup, please refer to the project documentation or create an issue in the repository.
