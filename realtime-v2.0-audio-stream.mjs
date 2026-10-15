/**
 * Infinity Voice v2.0 — offline audio stream epoch/reconnect policy.
 * Synthetic frames only. Reconnects are explicit and fail closed on sequence gaps.
 */
import { validateOfflineAudioFrame } from "./realtime-v2.0-audio-frame.mjs";

const DIRECTIONS = new Set(["input", "output"]);

function validState(state) {
  return state?.kind === "offline-audio-stream" && Number.isSafeInteger(state.streamEpoch) && state.streamEpoch >= 1 &&
    DIRECTIONS.has(state.direction) && typeof state.connected === "boolean" &&
    Number.isSafeInteger(state.lastAcceptedSequence) && state.lastAcceptedSequence >= 0;
}

export function createOfflineAudioStream({ direction, streamEpoch = 1 } = {}) {
  if (!DIRECTIONS.has(direction) || !Number.isSafeInteger(streamEpoch) || streamEpoch < 1) {
    return { ok: false, error: "invalid_audio_stream_config" };
  }
  return {
    ok: true,
    stream: Object.freeze({
      kind: "offline-audio-stream",
      direction,
      streamEpoch,
      connected: true,
      lastAcceptedSequence: 0,
      disconnectReason: null,
      reconnects: 0,
    }),
  };
}

export function acceptOfflineStreamFrame(stream, rawFrame) {
  if (!validState(stream)) return { ok: false, error: "invalid_audio_stream" };
  if (!stream.connected) return { ok: false, error: "audio_stream_disconnected" };
  const checked = validateOfflineAudioFrame(rawFrame);
  if (!checked.ok) return checked;
  const frame = checked.frame;
  if (frame.direction !== stream.direction) return { ok: false, error: "audio_direction_mismatch" };
  if (frame.streamEpoch !== stream.streamEpoch) return { ok: false, error: "stale_stream_epoch" };
  const expected = stream.lastAcceptedSequence + 1;
  if (frame.sequence < expected) return { ok: false, error: "audio_replay" };
  if (frame.sequence > expected) return { ok: false, error: "audio_sequence_gap" };
  return {
    ok: true,
    frame,
    stream: Object.freeze({ ...stream, lastAcceptedSequence: frame.sequence }),
  };
}

export function disconnectOfflineAudioStream(stream, { reason = "transport_drop" } = {}) {
  if (!validState(stream) || typeof reason !== "string" || reason.length < 1 || reason.length > 80) {
    return { ok: false, error: "invalid_disconnect" };
  }
  if (!stream.connected) return { ok: false, error: "already_disconnected" };
  return {
    ok: true,
    stream: Object.freeze({ ...stream, connected: false, disconnectReason: reason }),
  };
}

export function reconnectOfflineAudioStream(stream, { resumeSequence } = {}) {
  if (!validState(stream)) return { ok: false, error: "invalid_audio_stream" };
  if (stream.connected) return { ok: false, error: "stream_already_connected" };
  if (!Number.isSafeInteger(resumeSequence) || resumeSequence !== stream.lastAcceptedSequence + 1) {
    return { ok: false, error: "unsafe_resume_sequence" };
  }
  return {
    ok: true,
    nextSequence: resumeSequence,
    stream: Object.freeze({
      ...stream,
      streamEpoch: stream.streamEpoch + 1,
      connected: true,
      disconnectReason: null,
      reconnects: stream.reconnects + 1,
    }),
  };
}
