"""Repository for user_provider_configs table."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.provider_config import UserProviderConfig


async def get_all(db: AsyncSession) -> list[UserProviderConfig]:
    result = await db.execute(select(UserProviderConfig).order_by(UserProviderConfig.created_at))
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, config_id: UUID) -> UserProviderConfig | None:
    result = await db.execute(
        select(UserProviderConfig).where(UserProviderConfig.id == config_id)
    )
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    name: str,
    provider_type: str,
    host_url: str | None = None,
    api_key: str | None = None,
    model_name: str | None = None,
    is_enabled: bool = True,
    is_default: bool = False,
    extra_config: dict | None = None,
) -> UserProviderConfig:
    config = UserProviderConfig(
        name=name,
        provider_type=provider_type,
        host_url=host_url,
        api_key=api_key,
        model_name=model_name,
        is_enabled=is_enabled,
        is_default=is_default,
        extra_config=extra_config,
    )
    db.add(config)
    await db.flush()
    await db.refresh(config)
    return config


async def update(
    db: AsyncSession,
    *,
    db_config: UserProviderConfig,
    update_data: dict[str, Any],
) -> UserProviderConfig:
    for field, value in update_data.items():
        setattr(db_config, field, value)
    await db.flush()
    await db.refresh(db_config)
    return db_config


async def delete(db: AsyncSession, config_id: UUID) -> UserProviderConfig | None:
    config = await get_by_id(db, config_id)
    if config:
        await db.delete(config)
        await db.flush()
    return config


async def clear_defaults(db: AsyncSession) -> None:
    """Unset is_default on all configs (called before setting a new default)."""
    all_configs = await get_all(db)
    for c in all_configs:
        c.is_default = False
    await db.flush()
