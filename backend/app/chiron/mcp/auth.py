"""Auth helper for Chiron MCP tools — resolves identity or raises PermissionError."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.mcp_auth import MCPAuthService, ResolvedIdentity


async def resolve_identity_or_raise(db: AsyncSession, token: str | None) -> ResolvedIdentity:
    """Verify the MCP token. Raises PermissionError if invalid or missing."""
    identity = await MCPAuthService(db).verify_token(token)
    if identity is None:
        raise PermissionError(
            "Invalid or missing X-Mcp-Token. Ensure your Chiron MCP token is set."
        )
    return identity
