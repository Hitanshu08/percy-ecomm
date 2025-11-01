#!/usr/bin/env python3
"""
Test runner script for the backend.
"""
import subprocess
import sys
import argparse
import os


def run_command(command, description):
    """Run a command and handle errors."""
    print(f"\n{'='*50}")
    print(f"Running: {description}")
    print(f"Command: {command}")
    print(f"{'='*50}")
    
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=False)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed with exit code {e.returncode}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Run backend tests")
    parser.add_argument(
        "--type",
        choices=["unit", "integration", "all", "coverage"],
        default="all",
        help="Type of tests to run"
    )
    parser.add_argument(
        "--file",
        help="Run specific test file"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Run tests in verbose mode"
    )
    parser.add_argument(
        "--parallel",
        action="store_true",
        help="Run tests in parallel"
    )
    
    args = parser.parse_args()
    
    # Change to backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    
    # Base pytest command
    base_cmd = "python -m pytest"
    
    # Add verbosity
    if args.verbose:
        base_cmd += " -v"
    
    # Add parallel execution
    if args.parallel:
        base_cmd += " -n auto"
    
    # Determine test command based on type
    if args.file:
        # Run specific test file
        command = f"{base_cmd} tests/{args.file}"
        description = f"Running test file: {args.file}"
    elif args.type == "unit":
        command = f"{base_cmd} -m unit tests/"
        description = "Running unit tests"
    elif args.type == "integration":
        command = f"{base_cmd} -m integration tests/"
        description = "Running integration tests"
    elif args.type == "coverage":
        command = f"{base_cmd} --cov=. --cov-report=html --cov-report=term-missing tests/"
        description = "Running tests with coverage report"
    else:  # all
        command = f"{base_cmd} tests/"
        description = "Running all tests"
    
    # Run the tests
    success = run_command(command, description)
    
    if not success:
        sys.exit(1)
    
    print(f"\n🎉 All tests completed successfully!")


if __name__ == "__main__":
    main()
