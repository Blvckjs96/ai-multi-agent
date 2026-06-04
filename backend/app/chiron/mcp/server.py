"""Chiron FastMCP server — mounted at /chiron/mcp in the FastAPI app.

Claude CLI config to enable Chiron for a session:
    {
        "mcpServers": {
            "chiron": {
                "url": "http://localhost:8000/chiron/mcp",
                "headers": {"x-mcp-token": "<user.mcp_token>"}
            }
        }
    }

All tools require a valid mcp_token (see User.mcp_token) and a workspace_id argument.
"""

from fastmcp import FastMCP

from app.chiron.mcp.tools import register_tools

mcp = FastMCP(
    name="Chiron",
    instructions=(
        "Chiron is the workspace knowledge base for Argo. "
        "Use read_wiki_index first to see what pages exist, then read_wiki_page for full content. "
        "Use search_wiki to find relevant knowledge. "
        "All tools require workspace_id — use the workspace ID for the current session."
    ),
)

register_tools(mcp)


def create_chiron_app():
    """Return the ASGI application to mount at /chiron/mcp."""
    return mcp.http_app(path="/")
