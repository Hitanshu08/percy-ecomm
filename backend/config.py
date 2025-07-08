import json
import os
from typing import Dict, Any, Optional
from pathlib import Path

class Config:
    """Configuration manager for the application"""
    
    def __init__(self, config_file: str = "config.json"):
        self.config_file = config_file
        self._config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file"""
        config_path = Path(__file__).parent / self.config_file
        
        if not config_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            
            return config
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in configuration file: {e}")
        except Exception as e:
            raise Exception(f"Error loading configuration: {e}")
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key (supports dot notation)"""
        keys = key.split('.')
        value = self._config
        
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
    
    def get_cors_config(self, environment: str = "development") -> Dict[str, Any]:
        """Get CORS configuration for specified environment"""
        return self._config.get("cors", {}).get(environment, {})
    
    def get_credits_config(self) -> Dict[str, Any]:
        """Get credits configuration"""
        return self._config.get("credits", {})
    
    def get_subscription_durations(self) -> Dict[str, Any]:
        """Get subscription durations configuration"""
        return self._config.get("subscription_durations", {})
    
    def get_api_config(self) -> Dict[str, Any]:
        """Get API configuration"""
        return self._config.get("api", {})
    
    def get_logging_config(self) -> Dict[str, Any]:
        """Get logging configuration"""
        return self._config.get("logging", {})
    
    def reload(self):
        """Reload configuration from file"""
        self._config = self._load_config()
    
    def get_all(self) -> Dict[str, Any]:
        """Get all configuration"""
        return self._config.copy()

# Global configuration instance
config = Config() 