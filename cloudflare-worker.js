// ═══════════════════════════════════════════════════════
// LA CUENTA — Cloudflare Worker Proxy
// Protege la API key de Anthropic actuando de intermediario
// ═══════════════════════════════════════════════════════

// Dominio de tu app en GitHub Pages (sin barra final)
// Cámbialo si tu usuario de GitHub es diferente
const ALLOWED_ORIGIN = 'https://adrianac4.github.io';

export default {
  async fetch(request, env) {

    // ── CORS preflight ────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    // ── Solo aceptar POST desde tu dominio ───────────
    const origin = request.headers.get('Origin') || '';
    if (!origin.startsWith(ALLOWED_ORIGIN)) {
      return corsResponse(JSON.stringify({ error: 'Origen no permitido' }), 403);
    }

    if (request.method !== 'POST') {
      return corsResponse(JSON.stringify({ error: 'Método no permitido' }), 405);
    }

    // ── Leer el body que manda la app ─────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse(JSON.stringify({ error: 'Body inválido' }), 400);
    }

    // ── Llamar a Anthropic con la key secreta ─────────
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':        'application/json',
        'x-api-key':           env.ANTHROPIC_API_KEY,   // ← key guardada en secreto
        'anthropic-version':   '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await anthropicResponse.json();
    return corsResponse(JSON.stringify(data), anthropicResponse.status);
  },
};

// ── Helper: añadir cabeceras CORS a la respuesta ──────
function corsResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type',
    },
  });
}
