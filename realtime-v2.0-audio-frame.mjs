/**
 * Infinity Voice v2.0 — offline realtime-ready audio frame contract.
 * Handles synthetic byte payloads only. No microphone, speaker, WebRTC, SIP or network.
 */
const SAMPLE_RATES = new Set([16_000, 24_000, 48_000]);
const FRAME_DURATIONS = new Set([10, 20, 30]);
const DIRECTIONS = new Set(["input", "output"]);
const CODEC = "pcm16le";

function safeInt(value, min = 0) {
  return Number.isSafeInteger(value) && value >= min;
}

export function expectedPcm16FrameBytes(sampleRateHz, frameDurationMs, channels = 1) {
  if (!SAMPLE_RATES.has(sampleRateHz) || !FRAME_DURATIONS.has(frameDurationMs) || channels !== 1) return null;
  return (sampleRateHz * frameDurationMs * channels * 2) / 1000;
}

export function validateOfflineAudioFrame(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "invalid_audio_frame" };
  const allowed = new Set([
    "streamEpoch", "sequence", "timestampMs", "direction", "codec",
    "sampleRateHz", "channels", "frameDurationMs", "payload",
  ]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) return { ok: false, error: "unexpected_audio_field" };
  if (!safeInt(raw.streamEpoch, 1) || !safeInt(raw.sequence, 1) || !safeInt(raw.timestampMs) ||
      !DIRECTIONS.has(raw.direction) || raw.codec !== CODEC || !SAMPLE_RATES.has(raw.sampleRateHz) ||
      raw.channels !== 1 || !FRAME_DURATIONS.has(raw.frameDurationMs) || !(raw.payload instanceof Uint8Array)) {
    return { ok: false, error: "invalid_audio_frame_metadata" };
  }
  const expectedBytes = expectedPcm16FrameBytes(raw.sampleRateHz, raw.frameDurationMs, raw.channels);
  if (raw.payload.byteLength !== expectedBytes) return { ok: false, error: "audio_payload_size_mismatch" };
  const payload = Uint8Array.from(raw.payload);
  return {
    ok: true,
    frame: Object.freeze({
      streamEpoch: raw.streamEpoch,
      sequence: raw.sequence,
      timestampMs: raw.timestampMs,
      direction: raw.direction,
      codec: CODEC,
      sampleRateHz: raw.sampleRateHz,
      channels: 1,
      frameDurationMs: raw.frameDurationMs,
      payload,
    }),
  };
}

export function createSyntheticOfflineAudioFrame({
  streamEpoch = 1,
  sequence,
  timestampMs,
  direction,
  sampleRateHz = 24_000,
  frameDurationMs = 20,
  fillByte = 0,
} = {}) {
  const bytes = expectedPcm16FrameBytes(sampleRateHz, frameDurationMs, 1);
  if (bytes === null || !safeInt(fillByte) || fillByte > 255) return { ok: false, error: "invalid_synthetic_frame_config" };
  return validateOfflineAudioFrame({
    streamEpoch,
    sequence,
    timestampMs,
    direction,
    codec: CODEC,
    sampleRateHz,
    channels: 1,
    frameDurationMs,
    payload: new Uint8Array(bytes).fill(fillByte),
  });
}
