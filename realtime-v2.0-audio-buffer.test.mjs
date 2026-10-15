import test from "node:test";
import assert from "node:assert/strict";
import { createSyntheticOfflineAudioFrame } from "./realtime-v2.0-audio-frame.mjs";
import {
  createOfflineJitterBuffer,
  dequeueOfflineAudioFrame,
  enqueueOfflineAudioFrame,
} from "./realtime-v2.0-audio-buffer.mjs";

function frame(sequence) {
  return createSyntheticOfflineAudioFrame({
    streamEpoch: 1,
    sequence,
    timestampMs: 1_000 + sequence * 20,
    direction: "input",
  }).frame;
}

test("reorders in-window frames and emits only contiguous sequence", () => {
  let buffer = createOfflineJitterBuffer({ direction: "input", capacityFrames: 4, reorderWindowFrames: 2 }).buffer;
  buffer = enqueueOfflineAudioFrame(buffer, frame(2)).buffer;
  let pending = dequeueOfflineAudioFrame(buffer);
  assert.equal(pending.ready, false);
  buffer = enqueueOfflineAudioFrame(buffer, frame(1)).buffer;
  const first = dequeueOfflineAudioFrame(buffer);
  assert.equal(first.ready, true);
  assert.equal(first.frame.sequence, 1);
  const second = dequeueOfflineAudioFrame(first.buffer);
  assert.equal(second.ready, true);
  assert.equal(second.frame.sequence, 2);
});

test("rejects duplicate replay wrong stream binding and excessive jitter", () => {
  let buffer = createOfflineJitterBuffer({ direction: "input", capacityFrames: 4, reorderWindowFrames: 2 }).buffer;
  buffer = enqueueOfflineAudioFrame(buffer, frame(2)).buffer;
  assert.deepEqual(enqueueOfflineAudioFrame(buffer, frame(2)), { ok: false, error: "audio_replay_or_duplicate" });
  assert.deepEqual(enqueueOfflineAudioFrame(buffer, frame(4)), { ok: false, error: "jitter_window_exceeded" });
  const wrong = createSyntheticOfflineAudioFrame({
    streamEpoch: 2,
    sequence: 1,
    timestampMs: 1_020,
    direction: "input",
  }).frame;
  assert.deepEqual(enqueueOfflineAudioFrame(buffer, wrong), { ok: false, error: "audio_stream_binding_mismatch" });
});

test("enforces bounded capacity with explicit backpressure", () => {
  let buffer = createOfflineJitterBuffer({ direction: "input", capacityFrames: 2, reorderWindowFrames: 1 }).buffer;
  buffer = enqueueOfflineAudioFrame(buffer, frame(1)).buffer;
  buffer = enqueueOfflineAudioFrame(buffer, frame(2)).buffer;
  assert.deepEqual(enqueueOfflineAudioFrame(buffer, frame(3)), {
    ok: false,
    error: "audio_backpressure",
  });
});

test("rejects unsafe buffer configuration", () => {
  assert.deepEqual(createOfflineJitterBuffer({ direction: "input", capacityFrames: 4, reorderWindowFrames: 4 }), {
    ok: false,
    error: "invalid_jitter_buffer_config",
  });
});
