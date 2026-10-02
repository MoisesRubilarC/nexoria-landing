/**
 * Worker de Cloudflare para nexoriachile.com
 *
 * Hace dos cosas:
 *   POST /cotizacion  → envía el formulario del sitio por Resend a contacto@
 *   /auth, /callback  → login de GitHub para el panel /admin (Sveltia CMS)
 *
 * Variables (wrangler secret put <NOMBRE>):
 *   RESEND_API_KEY        clave de Resend
 *   GITHUB_CLIENT_ID      OAuth App de GitHub
 *   GITHUB_CLIENT_SECRET  OAuth App de GitHub
 */

const ORIGENES = ['https://nexoriachile.com', 'https://www.nexoriachile.com'];
const DESTINO = 'contacto@nexoriachile.com';
const REMITENTE = 'Sitio Nexoria <no-responder@nexoriachile.com>';

// Un envío cada 30 s por IP, usando el caché del Worker (sin KV).
const ESPERA_MS = 30_000;

const cors = (origen) => ({
  'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
});

const json = (datos, estado, origen) =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json', ...cors(origen) },
  });

const limpiar = (v, max) => String(v ?? '').trim().slice(0, max);
const escapar = (t) =>
  String(t).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

export default {
  async fetch(peticion, entorno) {
    const url = new URL(peticion.url);
    const origen = peticion.headers.get('Origin') ?? '';

    if (peticion.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origen) });
    }

    if (url.pathname === '/cotizacion' && peticion.method === 'POST') {
      return manejarCotizacion(peticion, entorno, origen);
    }
    if (url.pathname === '/auth') return iniciarOAuth(url, entorno);
    if (url.pathname === '/callback') return cerrarOAuth(url, entorno);

    return new Response('No encontrado', { status: 404 });
  },
};

async function manejarCotizacion(peticion, entorno, origen) {
  if (origen && !ORIGENES.includes(origen)) {
    return json({ error: 'Origen no permitido' }, 403, origen);
  }

  let cuerpo;
  try {
    cuerpo = await peticion.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400, origen);
  }

  // Trampa anti-spam: respondemos OK para no darle pistas al bot.
  if (limpiar(cuerpo.sitio_web, 1)) return json({ ok: true }, 200, origen);

  const nombre = limpiar(cuerpo.nombre, 120);
  const empresa = limpiar(cuerpo.empresa, 120);
  const correo = limpiar(cuerpo.correo, 160);
  const telefono = limpiar(cuerpo.telefono, 40);
  const servicio = limpiar(cuerpo.servicio, 120);
  const mensaje = limpiar(cuerpo.mensaje, 4000);

  if (!nombre || !empresa || !correo || !mensaje) {
    return json({ error: 'Faltan campos obligatorios' }, 400, origen);
  }
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(correo)) {
    return json({ error: 'Correo inválido' }, 400, origen);
  }

  // Límite por IP
  const ip = peticion.headers.get('CF-Connecting-IP') ?? 'desconocida';
  const llave = new Request(`https://limite.local/${encodeURIComponent(ip)}`);
  const cache = caches.default;
  const previo = await cache.match(llave);
  if (previo) {
    return json({ error: 'Espera unos segundos antes de reenviar.' }, 429, origen);
  }
  await cache.put(
    llave,
    new Response('1', { headers: { 'Cache-Control': `max-age=${ESPERA_MS / 1000}` } })
  );

  const filas = [
    ['Nombre', nombre],
    ['Empresa', empresa],
    ['Correo', correo],
    ['Teléfono', telefono || '—'],
    ['Interés', servicio || '—'],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#6f7c99;font-size:14px">${k}</td>` +
        `<td style="padding:6px 0;font-weight:600;color:#121a33;font-size:14px">${escapar(v)}</td></tr>`
    )
    .join('');

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:620px;margin:0 auto;padding:28px">
      <h2 style="color:#222A72;margin:0 0 6px">Nueva solicitud de cotización</h2>
      <p style="color:#6f7c99;font-size:14px;margin:0 0 22px">Enviada desde nexoriachile.com</p>
      <table style="border-collapse:collapse;margin-bottom:22px">${filas}</table>
      <div style="background:#f5f8fc;border-left:3px solid #31A5DD;padding:16px 18px;border-radius:0 8px 8px 0">
        <p style="margin:0;white-space:pre-wrap;color:#121a33;font-size:15px;line-height:1.6">${escapar(mensaje)}</p>
      </div>
    </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${entorno.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: REMITENTE,
      to: [DESTINO],
      reply_to: correo,
      subject: `Cotización — ${empresa} (${nombre})`,
      html,
    }),
  });

  if (!r.ok) {
    console.error('Resend falló', r.status, await r.text());
    return json({ error: 'No se pudo enviar' }, 502, origen);
  }

  return json({ ok: true }, 200, origen);
}

/* ---------- OAuth de GitHub para el panel /admin ---------- */

function iniciarOAuth(url, entorno) {
  const destino = new URL('https://github.com/login/oauth/authorize');
  destino.searchParams.set('client_id', entorno.GITHUB_CLIENT_ID);
  destino.searchParams.set('scope', 'repo,user');
  destino.searchParams.set('redirect_uri', `${url.origin}/callback`);
  return Response.redirect(destino.toString(), 302);
}

async function cerrarOAuth(url, entorno) {
  const codigo = url.searchParams.get('code');
  if (!codigo) return new Response('Falta el código', { status: 400 });

  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: entorno.GITHUB_CLIENT_ID,
      client_secret: entorno.GITHUB_CLIENT_SECRET,
      code: codigo,
    }),
  });
  const datos = await r.json();

  const estado = datos.access_token ? 'success' : 'error';
  const carga = datos.access_token
    ? { token: datos.access_token, provider: 'github' }
    : { message: datos.error_description ?? 'No se pudo autenticar' };

  // El CMS escucha este mensaje en la ventana que abrió el login.
  const pagina = `<!doctype html><meta charset="utf-8"><title>Autenticando…</title>
<body style="font-family:system-ui;padding:40px;text-align:center;color:#121a33">
<p>Conectando con GitHub…</p>
<script>
(function () {
  function avisar(e) {
    window.opener.postMessage(
      'authorization:github:${estado}:${JSON.stringify(carga).replace(/</g, '\\u003c')}',
      e.origin
    );
  }
  window.addEventListener('message', avisar, { once: true });
  window.opener.postMessage('authorizing:github', '*');
})();
</script></body>`;

  return new Response(pagina, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
