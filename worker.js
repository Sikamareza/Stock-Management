// Simple Worker without KV - just to establish connection
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // Health check
    if (path === '/' || path === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'Stock Management API is running!',
        timestamp: new Date().toISOString()
      }), { headers });
    }

    // Test endpoint
    if (path === '/api/test') {
      return new Response(JSON.stringify({
        success: true,
        message: 'API connection successful!',
        data: {
          worker: 'stock-management-api',
          deployed: true,
          ready: true
        }
      }), { headers });
    }

    // Echo endpoint (for testing POST requests)
    if (path === '/api/echo' && request.method === 'POST') {
      try {
        const body = await request.json();
        return new Response(JSON.stringify({
          success: true,
          received: body,
          timestamp: new Date().toISOString()
        }), { headers });
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid JSON'
        }), { status: 400, headers });
      }
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({
      error: 'Not found',
      path: path
    }), { status: 404, headers });
  }
};
