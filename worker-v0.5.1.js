const SERVICE = "infinity-voice-api-lab";
const VERSION = "0.5.1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "null"
    }
  });
}

function isAuthorized(request, env) {
  const expected = env.LAB_ACCESS_TOKEN;

  if (!expected || expected.length < 32) {
    return false;
  }

  const header = request.headers.get("Authorization") || "";

  if (!header.startsWith("Bearer ")) {
    return false;
  }

  const received = header.slice(7);

  if (received.length !== expected.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < expected.length; i++) {
    difference |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  }

  return difference === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/health" && request.method === "GET") {
      return json({
        service: SERVICE,
        version: VERSION,
        status: "operational",
        mode: "laboratory",
        openai_sessions_enabled: false
      });
    }

    if (/^\/(session|sessions|realtime|openai)(\/|$)/i.test(path)) {
      return json({
        error: "sessions_disabled",
        message: "Las sesiones de OpenAI permanecen deshabilitadas."
      }, 403);
    }

    if (path === "/security") {
      if (request.method !== "GET") {
        return json({ error: "method_not_allowed" }, 405);
      }

      if (!env.LAB_ACCESS_TOKEN || env.LAB_ACCESS_TOKEN.length < 32) {
        return json({ error: "security_not_configured" }, 503);
      }

      if (!isAuthorized(request, env)) {
        return json({ error: "unauthorized" }, 401);
      }

      return json({
        service: SERVICE,
        version: VERSION,
        authenticated: true,
        openai_sessions_enabled: false
      });
    }

    return json({
      error: "not_found",
      message: "Ruta no encontrada."
    }, 404);
  }
};
