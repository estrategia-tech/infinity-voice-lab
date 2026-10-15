/**
 * Infinity Voice v2.0 — bounded offline jitter/reorder buffer.
 * Synthetic frames only. No device, network or provider I/O.
 */
import { validateOfflineAudioFrame } from "./realtime-v2.0-audio-frame.mjs";

const DIRECTIONS = new Set(["input", "output"]);

function validBuffer(buffer) {
  return buffer?.kind === "offline-jitter-buffer" && Number.isSafeInteger(buffer.streamEpoch) && buffer.streamEpoch >= 1 &&
    DIRECTIONS.has(buffer.direction) && Number.isSafeInteger(buffer.capacityFrames) && buffer.capacityFrames >= 1 &&
    Number.isSafeInteger(buffer.reorderWindowFrames) && buffer.reorderWindowFrames >= 0 &&
    Number.isSafeInteger(buffer.expectedSequence) && buffer.expectedSequence >= 1 && Array.isArray(buffer.frames);
}

function freezeFrames(frames) {
  return Object.freeze([...frames]);
}

export function createOfflineJitterBuffer({
  streamEpoch = 1,
  direction,
  capacityFrames = 8,
  reorderWindowFrames = 3,
  expectedSequence = 1,
} = {}) {
  if (!Number.isSafeInteger(streamEpoch) || streamEpoch < 1 || !DIRECTIONS.has(direction) ||
      !Number.isSafeInteger(capacityFrames) || capacityFrames < 1 || capacityFrames > 256 ||
      !Number.isSafeInteger(reorderWindowFrames) || reorderWindowFrames < 0 || reorderWindowFrames >= capacityFrames ||
      !Number.isSafeInteger(expectedSequence) || expectedSequence < 1) {
    return { ok: false, error: "invalid_jitter_buffer_config" };
  }
  return {
    ok: true,
    buffer: Object.freeze({
      kind: "offline-jitter-buffer",
      streamEpoch,
      direction,
      capacityFrames,
      reorderWindowFrames,
      expectedSequence,
      frames: freezeFrames([]),
      accepted: 0,
      emitted: 0,
    }),
  };
}

export function enqueueOfflineAudioFrame(buffer, rawFrame) {
  if (!validBuffer(buffer)) return { ok: false, error: "invalid_jitter_buffer" };
  const checked = validateOfflineAudioFrame(rawFrame);
  if (!checked.ok) return checked;
  const frame = checked.frame;
  if (frame.streamEpoch !== buffer.streamEpoch || frame.direction !== buffer.direction) {
    return { ok: false, error: "audio_stream_binding_mismatch" };
  }
  if (frame.sequence < buffer.expectedSequence || buffer.frames.some((item) => item.sequence === frame.sequence)) {
    return { ok: false, error: "audio_replay_or_duplicate" };
  }
  if (buffer.frames.length >= buffer.capacityFrames) return { ok: false, error: "audio_backpressure" };
  if (frame.sequence > buffer.expectedSequence + buffer.reorderWindowFrames) {
    return { ok: false, error: "jitter_window_exceeded" };
  }
  const frames = [...buffer.frames, frame].sort((a, b) => a.sequence - b.sequence);
  return {
    ok: true,
    buffer: Object.freeze({ ...buffer, frames: freezeFrames(frames), accepted: buffer.accepted + 1 }),
  };
}

export function dequeueOfflineAudioFrame(buffer) {
  if (!validBuffer(buffer)) return { ok: false, error: "invalid_jitter_buffer" };
  if (buffer.frames.length === 0 || buffer.frames[0].sequence !== buffer.expectedSequence) {
    return { ok: true, ready: false, reason: "sequence_wait", buffer };
  }
  const [frame, ...rest] = buffer.frames;
  return {
    ok: true,
    ready: true,
    frame,
    buffer: Object.freeze({
      ...buffer,
      expectedSequence: buffer.expectedSequence + 1,
      frames: freezeFrames(rest),
      emitted: buffer.emitted + 1,
    }),
  };
}
