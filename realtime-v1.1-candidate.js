// Infinity Voice v1.1 — isolated Realtime browser candidate.
// No OpenAI key here. This client requires an authenticated, lab-only token endpoint.
// Intentionally not linked from index.html and never auto-starts.
const REALTIME_BROWSER_ENABLED = false; // Release gate: no paid audio without explicit review.
const $ = id => document.getElementById(id);
const state = { pc: null, mic: null, remote: null, token: null, busy: false };
const status = message => { $("status").textContent = message; };
function stop() {
  try { state.pc?.close(); } catch {}
  try { state.mic?.getTracks().forEach(track => track.stop()); } catch {}
  if (state.remote) state.remote.srcObject = null;
  state.pc = null; state.mic = null; state.busy = false;
  $("start").disabled = false; $("stop").disabled = true;
  status("Desconectado. Micrófono liberado.");
}
async function start() {
  if (!REALTIME_BROWSER_ENABLED) {
    status("Pruebas de voz desactivadas. Se requiere autorización técnica y presupuestal.");
    return;
  }
  if (state.busy || state.pc) return;
  state.busy = true; $("start").disabled = true; $("stop").disabled = false;
  status("Solicitando autorización del laboratorio...");
  try {
    const response = await fetch("/api/realtime/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "omit", cache: "no-store",
      body: JSON.stringify({ purpose: "internal-voice-test" })
    });
    if (!response.ok) throw new Error("Laboratorio no habilitado o autorización rechazada (" + response.status + ")");
    const payload = await response.json();
    if (!payload.client_secret?.value || !payload.model) throw new Error("Respuesta de sesión inválida");
    state.mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    const pc = new RTCPeerConnection();
    state.pc = pc;
    for (const track of state.mic.getAudioTracks()) pc.addTrack(track, state.mic);
    state.remote = $("remote");
    pc.ontrack = event => { state.remote.srcObject = event.streams[0]; };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) stop();
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + payload.client_secret.value,
        "Content-Type": "application/sdp"
      },
      body: offer.sdp
    });
    if (!sdpResponse.ok) throw new Error("No se pudo establecer audio Realtime (" + sdpResponse.status + ")");
    await pc.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() });
    status("Sesión de prueba conectada. Identifica que eres una IA.");
  } catch (error) {
    stop();
    status(error.message || "Error de conexión");
  }
}
$("start").disabled = !REALTIME_BROWSER_ENABLED;
$("start").addEventListener("click", start);
$("stop").addEventListener("click", stop);
window.addEventListener("pagehide", stop);
