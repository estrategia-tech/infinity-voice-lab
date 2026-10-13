const SERVICE = "infinity-voice-api-lab";
const VERSION = "0.4.0";

export default {
  async fetch(request) {
      const url = new URL(request.url);

          const headers = {
                "Content-Type": "application/json; charset=utf-8",
                      "Cache-Control": "no-store",
                            "X-Content-Type-Options": "nosniff"
                                };

                                    const respond = (data, status = 200) =>
                                          new Response(JSON.stringify(data), { status, headers });

                                              if (url.pathname === "/health" && request.method === "GET") {
                                                    return respond({
                                                            service: SERVICE,
                                                                    version: VERSION,
                                                                            status: "operational",
                                                                                    mode: "laboratory",
                                                                                            openai_sessions_enabled: false
                                                                                                  });
                                                                                                      }

                                                                                                          if (/^\/(session|sessions|realtime|openai)(\/|$)/i.test(url.pathname)) {
                                                                                                                return respond({
                                                                                                                        error: "sessions_disabled",
                                                                                                                                message: "Las sesiones de OpenAI permanecen deshabilitadas en este laboratorio."
                                                                                                                                      }, 403);
                                                                                                                                          }

                                                                                                                                              return respond({
                                                                                                                                                    error: "not_found",
                                                                                                                                                          message: "Ruta no encontrada."
                                                                                                                                                              }, 404);
                                                                                                                                                                }
                                                                                                                                                                };
