#!/bin/bash

# Comprehensive test runner for the entire project
# This script runs both backend and frontend tests

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to run a command and handle errors
run_command() {
    local description="$1"
    local command="$2"
    
    print_status "Running: $description"
    echo "Command: $command"
    echo "----------------------------------------"
    
    if eval "$command"; then
        print_success "$description completed successfully"
        return 0
    else
        print_error "$description failed"
        return 1
    fi
}

# Function to show test groups information
show_test_groups_info() {
    echo ""
    echo "========================================"
    echo "       TEST GROUPS INFORMATION"
    echo "========================================"
    echo ""
    
    # Show backend test groups
    if [ -f "$BACKEND_DIR/run_tests.py" ]; then
        echo "📦 BACKEND TEST GROUPS:"
        echo "   Run: cd backend && python run_tests.py --info"
        echo ""
        cd "$BACKEND_DIR" && python run_tests.py --info 2>/dev/null || echo "   (Backend test runner not available)"
        cd "$PROJECT_ROOT"
    fi
    
    echo ""
    echo "----------------------------------------"
    echo ""
    
    # Show frontend test groups
    if [ -f "$FRONTEND_DIR/run_tests.js" ]; then
        echo "🌐 FRONTEND TEST GROUPS:"
        echo "   Run: cd frontend && node run_tests.js --info"
        echo ""
        cd "$FRONTEND_DIR" && node run_tests.js --info 2>/dev/null || echo "   (Frontend test runner not available)"
        cd "$PROJECT_ROOT"
    fi
    
    echo ""
    echo "========================================"
    echo ""
    echo "Quick Commands:"
    echo "  Backend:    cd backend && python run_tests.py --info"
    echo "  Frontend:   cd frontend && node run_tests.js --info"
    echo "  All Info:   $0 --info"
    echo ""
    exit 0
}

# Parse command line arguments
BACKEND_TESTS=true
FRONTEND_TESTS=true
BACKEND_TYPE="all"
FRONTEND_TYPE="all"
VERBOSE=false
COVERAGE=false
INSTALL_DEPS=false
SHOW_INFO=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-only)
            FRONTEND_TESTS=false
            shift
            ;;
        --frontend-only)
            BACKEND_TESTS=false
            shift
            ;;
        --backend-type)
            BACKEND_TYPE="$2"
            shift 2
            ;;
        --frontend-type)
            FRONTEND_TYPE="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --coverage|-c)
            COVERAGE=true
            shift
            ;;
        --install-deps)
            INSTALL_DEPS=true
            shift
            ;;
        --info|--list-groups|-i)
            SHOW_INFO=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --backend-only        Run only backend tests"
            echo "  --frontend-only       Run only frontend tests"
            echo "  --backend-type TYPE   Backend test type (unit|integration|all|coverage)"
            echo "  --frontend-type TYPE  Frontend test type (unit|e2e|all)"
            echo "  --verbose, -v         Verbose output"
            echo "  --coverage, -c        Generate coverage reports"
            echo "  --install-deps        Install dependencies before running tests"
            echo "  --info, -i            Show information about available test groups"
            echo "  --help, -h            Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Run all tests"
            echo "  $0 --backend-only --coverage         # Run backend tests with coverage"
            echo "  $0 --frontend-only --frontend-type unit  # Run only frontend unit tests"
            echo "  $0 --install-deps                    # Install dependencies and run all tests"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

print_status "Starting test suite for Percy E-commerce"
print_status "Project root: $PROJECT_ROOT"

# Install dependencies if requested
if [ "$INSTALL_DEPS" = true ]; then
    print_status "Installing dependencies..."
    
    if [ "$BACKEND_TESTS" = true ]; then
        run_command "Installing backend dependencies" "cd $BACKEND_DIR && pip install -r requirements.txt -r requirements-test.txt"
    fi
    
    if [ "$FRONTEND_TESTS" = true ]; then
        run_command "Installing frontend dependencies" "cd $FRONTEND_DIR && npm install"
        run_command "Installing Playwright browsers" "cd $FRONTEND_DIR && npx playwright install"
    fi
fi

# Track test results
BACKEND_SUCCESS=true
FRONTEND_SUCCESS=true

# Run backend tests
if [ "$BACKEND_TESTS" = true ]; then
    print_status "Running backend tests..."
    
    cd "$BACKEND_DIR"
    
    # Build the command based on options
    BACKEND_CMD="python run_tests.py --type $BACKEND_TYPE"
    
    if [ "$VERBOSE" = true ]; then
        BACKEND_CMD="$BACKEND_CMD --verbose"
    fi
    
    if [ "$COVERAGE" = true ] && [ "$BACKEND_TYPE" != "coverage" ]; then
        BACKEND_CMD="$BACKEND_CMD --coverage"
    fi
    
    if ! run_command "Backend tests ($BACKEND_TYPE)" "$BACKEND_CMD"; then
        BACKEND_SUCCESS=false
    fi
fi

# Run frontend tests
if [ "$FRONTEND_TESTS" = true ]; then
    print_status "Running frontend tests..."
    
    cd "$FRONTEND_DIR"
    
    # Build the command based on options
    FRONTEND_CMD="node run_tests.js $FRONTEND_TYPE"
    
    if [ "$VERBOSE" = true ]; then
        FRONTEND_CMD="$FRONTEND_CMD --verbose"
    fi
    
    if [ "$COVERAGE" = true ]; then
        FRONTEND_CMD="$FRONTEND_CMD --coverage"
    fi
    
    if ! run_command "Frontend tests ($FRONTEND_TYPE)" "$FRONTEND_CMD"; then
        FRONTEND_SUCCESS=false
    fi
fi

# Print final results
echo ""
echo "========================================"
echo "           TEST RESULTS SUMMARY"
echo "========================================"

if [ "$BACKEND_TESTS" = true ]; then
    if [ "$BACKEND_SUCCESS" = true ]; then
        print_success "Backend tests: PASSED"
    else
        print_error "Backend tests: FAILED"
    fi
fi

if [ "$FRONTEND_TESTS" = true ]; then
    if [ "$FRONTEND_SUCCESS" = true ]; then
        print_success "Frontend tests: PASSED"
    else
        print_error "Frontend tests: FAILED"
    fi
fi

# Overall result
if [ "$BACKEND_SUCCESS" = true ] && [ "$FRONTEND_SUCCESS" = true ]; then
    echo ""
    print_success "🎉 All tests passed successfully!"
    exit 0
else
    echo ""
    print_error "💥 Some tests failed. Please check the output above."
    exit 1
fi
