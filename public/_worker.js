const SPA_ROUTES = new Set(['app', 'privacy', 'terms', 'acceptable-use', 'refund', 'subprocessors', 'security', 'accessibility']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/tricord-runtime-config.js') {
      return runtimeConfigResponse(env);
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || isStaticAsset(url.pathname) || !shouldServeSpa(url.pathname)) {
      return response;
    }

    const indexUrl = new URL('/', url);
    const indexRequest = new Request(indexUrl, request);
    const indexResponse = await env.ASSETS.fetch(indexRequest);
    return new Response(indexResponse.body, {
      status: 200,
      headers: indexResponse.headers,
    });
  },
};

function runtimeConfigResponse(env) {
  const config = {
    VITE_SUPABASE_URL: stringValue(env.VITE_SUPABASE_URL),
    VITE_SUPABASE_PUBLISHABLE_KEY: stringValue(env.VITE_SUPABASE_PUBLISHABLE_KEY),
  };

  return new Response(`window.__TRICORD_RUNTIME_CONFIG__ = ${JSON.stringify(config)};\n`, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function shouldServeSpa(pathname) {
  const segment = pathname.split('/').filter(Boolean)[0] || '';
  return SPA_ROUTES.has(segment);
}

function isStaticAsset(pathname) {
  return /\.[a-z0-9]{2,8}$/i.test(pathname);
}
