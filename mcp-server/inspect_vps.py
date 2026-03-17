
from mcp.server.fastmcp import FastMCP
import inspect

print("--- VPS Inspection ---")
try:
    mcp = FastMCP("test")
    print(f"Dir: {dir(mcp)}")
    
    if hasattr(mcp, 'sse_app'):
        print(f"Type of mcp.sse_app: {type(mcp.sse_app)}")
    else:
        print("No sse_app attribute")
        
    if hasattr(mcp, '_sse_app'):
        print(f"Type of mcp._sse_app: {type(mcp._sse_app)}")
    else:
        print("No _sse_app attribute")
        
except Exception as e:
    print(f"Error: {e}")
