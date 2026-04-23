from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
import os

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "AI HR Copilot"
    API_V1_STR: str = "/api/v1"
    
    # Ollama API
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5-coder:7b"
    
    # Database
    DATABASE_URL: str
    
    # Optional settings with defaults
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # Path settings
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(Path(__file__).resolve().parent.parent.parent, ".env"),
        env_file_encoding='utf-8',
        extra='ignore'
    )

settings = Settings()
