"""Argon-specific configuration — extends Argo's core settings.

All Argon settings live here. They read from the same .env file as Argo
(using the ARGON_ prefix to avoid collisions) and are accessible via
`argon_settings` throughout the argon module.
"""

from pydantic import Field
from pydantic_settings import BaseSettings


class ArgonSettings(BaseSettings):
    """Argon module configuration.

    Infrastructure settings only. AI provider credentials (LLM/Embedding/Vision
    API keys) are stored encrypted in the database via app.argon.services.config_service.
    """

    # --- MinIO (object storage for wiki files, skill zips, source documents) ---
    argon_minio_endpoint: str = Field(default="localhost:9000")
    argon_minio_public_endpoint: str = Field(
        default="",
        description="Public-facing MinIO address for presigned URLs. "
                    "Defaults to argon_minio_endpoint if not set.",
    )
    argon_minio_access_key: str = Field(default="minioadmin")
    argon_minio_secret_key: str = Field(default="minioadmin123")
    argon_minio_bucket: str = Field(default="argon-files")
    argon_minio_secure: bool = Field(default=False)
    argon_minio_presign_expiry_hours: int = Field(default=24)

    # --- MCP token security ---
    argon_mcp_token_pepper: str = Field(
        default="change-me-argon-pepper",
        description="HMAC pepper for hashing Argon MCP bearer tokens. "
                    "Set once and keep stable — rotating invalidates all tokens.",
    )

    # --- arq Worker (Argon uses arq for document ingestion tasks) ---
    argon_worker_max_jobs: int = Field(default=3, description="Max concurrent ingestion jobs")
    argon_worker_job_timeout: int = Field(default=1800, description="Job timeout in seconds")

    # --- MRP Pipeline ---
    argon_mrp_auto_approve_plan: bool = Field(
        default=False,
        description="If True, compilation plans are auto-approved without human review.",
    )

    # --- SMTP (email notifications) ---
    argon_smtp_host: str = Field(default="localhost")
    argon_smtp_port: int = Field(default=587)
    argon_smtp_user: str = Field(default="")
    argon_smtp_password: str = Field(default="")
    argon_smtp_from: str = Field(default="argon@localhost")
    argon_notifications_enabled: bool = Field(default=False)

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def minio_endpoint(self) -> str:
        return self.argon_minio_endpoint

    @property
    def minio_public_endpoint(self) -> str:
        return self.argon_minio_public_endpoint or self.argon_minio_endpoint

    @property
    def minio_access_key(self) -> str:
        return self.argon_minio_access_key

    @property
    def minio_secret_key(self) -> str:
        return self.argon_minio_secret_key

    @property
    def minio_bucket(self) -> str:
        return self.argon_minio_bucket

    @property
    def minio_secure(self) -> bool:
        return self.argon_minio_secure

    @property
    def minio_presign_expiry_hours(self) -> int:
        return self.argon_minio_presign_expiry_hours

    @property
    def mcp_token_pepper(self) -> str:
        return self.argon_mcp_token_pepper

    @property
    def worker_max_jobs(self) -> int:
        return self.argon_worker_max_jobs

    @property
    def worker_job_timeout(self) -> int:
        return self.argon_worker_job_timeout

    @property
    def mrp_auto_approve_plan(self) -> bool:
        return self.argon_mrp_auto_approve_plan

    # --- Redis (delegated to Argo core settings) ---

    @property
    def redis_host(self) -> str:
        from app.core.config import settings as argo_settings
        return getattr(argo_settings, "REDIS_HOST", "localhost")

    @property
    def redis_port(self) -> int:
        from app.core.config import settings as argo_settings
        return getattr(argo_settings, "REDIS_PORT", 6379)

    @property
    def redis_db(self) -> int:
        from app.core.config import settings as argo_settings
        return getattr(argo_settings, "REDIS_DB", 0)

    @property
    def redis_password(self) -> str | None:
        from app.core.config import settings as argo_settings
        return getattr(argo_settings, "REDIS_PASSWORD", None)


argon_settings = ArgonSettings()
