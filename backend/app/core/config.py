"""Application configuration using Pydantic BaseSettings."""
# ruff: noqa: I001 - Imports structured for Jinja2 template conditionals

from pathlib import Path
from typing import Literal

from pydantic import computed_field, field_validator, ValidationInfo
from pydantic_settings import BaseSettings, SettingsConfigDict


def find_env_file() -> Path | None:
    """Find .env file in current or parent directories."""
    current = Path.cwd()
    for path in [current, current.parent]:
        env_file = path / ".env"
        if env_file.exists():
            return env_file
    return None


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=find_env_file(),
        env_ignore_empty=True,
        extra="ignore",
    )

    # === Project ===
    PROJECT_NAME: str = "ai_multi_agent"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False
    ENVIRONMENT: Literal["development", "local", "staging", "production"] = "local"
    TIMEZONE: str = "UTC"  # IANA timezone (e.g. "UTC", "Europe/Warsaw", "America/New_York")
    MODELS_CACHE_DIR: Path = Path("./models_cache")
    MEDIA_DIR: Path = Path("./media")
    MAX_UPLOAD_SIZE_MB: int = 50  # Max file upload size in MB

    # === Logfire ===
    LOGFIRE_TOKEN: str | None = None
    LOGFIRE_SERVICE_NAME: str = "ai_multi_agent"
    LOGFIRE_ENVIRONMENT: str = "development"

    # === Database (PostgreSQL async) ===
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "ai_multi_agent"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def DATABASE_URL(self) -> str:
        """Build async PostgreSQL connection URL."""
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Build sync PostgreSQL connection URL (for Alembic)."""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Pool configuration
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30

    # === Auth (SECRET_KEY for JWT/Session/Admin) ===
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info: ValidationInfo) -> str:
        """Validate SECRET_KEY is secure in production."""
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        # Get environment from values if available
        env = info.data.get("ENVIRONMENT", "local") if info.data else "local"
        if v == "change-me-in-production-use-openssl-rand-hex-32" and env == "production":
            raise ValueError(
                "SECRET_KEY must be changed in production! "
                "Generate a secure key with: openssl rand -hex 32"
            )
        return v

    # === JWT Settings ===
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # 30 minutes
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ALGORITHM: str = "HS256"

    # === Auth (API Key) ===
    API_KEY: str = "change-me-in-production"
    API_KEY_HEADER: str = "X-API-Key"

    @field_validator("API_KEY")
    @classmethod
    def validate_api_key(cls, v: str, info: ValidationInfo) -> str:
        """Validate API_KEY is set in production."""
        env = info.data.get("ENVIRONMENT", "local") if info.data else "local"
        if v == "change-me-in-production" and env == "production":
            raise ValueError(
                "API_KEY must be changed in production! "
                "Generate a secure key with: openssl rand -hex 32"
            )
        return v

    # === Redis ===
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str | None = None
    REDIS_DB: int = 0

    @computed_field  # type: ignore[prop-decorator]
    @property
    def REDIS_URL(self) -> str:
        """Build Redis connection URL."""
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # === Celery ===
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # === AI Agent (pydantic_ai, anthropic) ===
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL: str = "claude-sonnet-4-6"
    AI_TEMPERATURE: float = 0.7
    AI_AVAILABLE_MODELS: list[str] = [
        "claude-sonnet-4-6",
        "claude-sonnet-4-5-20241022",
        "claude-haiku-3-5-20241022",
    ]
    AI_FRAMEWORK: str = "pydantic_ai"
    LLM_PROVIDER: str = "anthropic"

    # === Pipeline model rotation ===
    PIPELINE_ANTHROPIC_MODEL: str = "claude-haiku-4-5"  # kept for compatibility
    # Task-type routing: reasoning tasks get a stronger model, fast tasks use haiku
    AI_REASONING_MODEL: str = "claude-sonnet-4-6"
    AI_FAST_MODEL: str = "claude-haiku-4-5"
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma4:31b-cloud"

    # === Hybrid Router (Argo) ===
    ROUTING_MODE: Literal["auto", "prefer_local", "prefer_cloud", "force_local", "force_cloud"] = (
        "auto"
    )
    PROVIDER_PROBE_TTL_SECONDS: int = 60  # how long to cache provider availability checks
    CLAUDE_CLI_PATH: str = "claude"  # overridable via env; auto-resolved at startup if not found on PATH

    @field_validator("CLAUDE_CLI_PATH", mode="after")
    @classmethod
    def resolve_claude_cli_path(cls, v: str) -> str:
        import shutil
        if shutil.which(v):
            return v
        # PATH may be minimal in GUI/Tauri context — try extended lookup
        from app.core.cli_utils import find_binary
        resolved = find_binary("claude")
        return resolved if resolved else v

    # === NVIDIA NIM ===
    NIM_API_KEY: str = ""
    NIM_HOST: str = "https://integrate.api.nvidia.com/v1"
    # Default fast model: Mistral Nemotron — agentic, instruction following, function calling
    NIM_FAST_MODEL: str = "mistralai/mistral-nemotron"
    # Default reasoning model: Step-3.5-Flash — 200B sparse MoE, strong at reasoning + planning
    NIM_REASONING_MODEL: str = "stepfun-ai/step-3.5-flash"
    NIM_ENABLED: bool = False  # only enable when NIM_API_KEY is set

    # === Token compression (TokenJuice-inspired) ===
    TOKEN_COMPRESSION_ENABLED: bool = True

    # === OMNI UI/UX Skill Server ===
    # HTTP adapter exposing omni_generate / omni_brand. Empty = disabled.
    OMNI_URL: str = ""

    # === Argomemory (Memory Brain Tier 2) ===
    ARGOMEMORY_URL: str = "http://localhost:3111"
    ARGOMEMORY_SECRET: str = ""
    # Absolute path to dist/standalone.mjs — injected as MCP server into every Claude CLI session.
    # Leave empty to disable argomemory MCP injection (context recall still works via REST).
    ARGOMEMORY_MCP_PATH: str = ""
    ARGOMEMORY_ENABLED: bool = True  # set False to skip all memory calls

    # === OpenAI (optional — kept for future use) ===
    OPENAI_API_KEY: str = ""

    # === MinIO (object storage for Chiron source files) ===
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = ""
    MINIO_SECRET_KEY: str = ""
    MINIO_BUCKET_CHIRON: str = "chiron-sources"
    MINIO_SECURE: bool = False

    # === Chiron MCP (Knowledge Brain Tier 3) ===
    # Base URL for the Chiron MCP HTTP endpoint (mounted at /chiron/mcp).
    # Claude CLI sessions use this URL to call Chiron tools via streamable-http.
    CHIRON_MCP_BASE_URL: str = "http://localhost:8000"

    # === Chiron Embeddings (Ollama — local, free) ===
    # Uses OLLAMA_HOST for the HTTP endpoint. Model must output 768-dimensional vectors.
    # Default: nomic-embed-text (274 MB, 768d, excellent quality/size balance).
    CHIRON_EMBEDDING_MODEL: str = "nomic-embed-text"

    # === GitHub OAuth ===
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:5001/github/callback"

    # === CORS ===
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8080"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = ["*"]
    CORS_ALLOW_HEADERS: list[str] = ["*"]

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, v: list[str], info: ValidationInfo) -> list[str]:
        """Warn if CORS_ORIGINS is too permissive in production."""
        env = info.data.get("ENVIRONMENT", "local") if info.data else "local"
        if "*" in v and env == "production":
            raise ValueError(
                "CORS_ORIGINS cannot contain '*' in production! Specify explicit allowed origins."
            )
        return v


settings = Settings()
