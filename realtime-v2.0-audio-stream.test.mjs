import test from "node:test";
import assert from "node:assert/strict";
import { createSyntheticOfflineAudioFrame } from "./realtime-v2.0-audio-frame.mjs";
import {
  acceptOfflineStreamFrame,
  createOfflineAudioStream,
  disconnectOfflineAudioStream,
  reconnectOfflineAudioStream,
} from "./realtime-v2.0-audio-stream.mjs";

function input(epoch, sequence) {
  return createSyntheticOfflineAudioFrame({
    streamEpoch: epoch,
    sequence,
    timestampMs: 1_000 + sequence * 20,
    direction: "input",
  }).frame;
}

test("accepts only contiguous frames on the active epoch", () => {
  let stream = createOfflineAudioStream({ direction: "input" }).stream;
  let accepted = acceptOfflineStreamFrame(stream, input(1, 1));
  assert.equal(accepted.ok, true);
  stream = accepted.stream;
  accepted = acceptOfflineStreamFrame(stream, input(1, 2));
  assert.equal(accepted.ok, true);
  assert.equal(accepted.stream.lastAcceptedSequence, 2);
});

test("rejects replay, gap and stale epoch", () => {
  let stream = createOfflineAudioStream({ direction: "input" }).stream;
  stream = acceptOfflineStreamFrame(stream, input(1, 1)).stream;
  assert.deepEqual(acceptOfflineStreamFrame(stream, input(1, 1)), { ok: false, error: "audio_replay" });
  assert.deepEqual(acceptOfflineStreamFrame(stream, input(1, 3)), { ok: false, error: "audio_sequence_gap" });
  assert.deepEqual(acceptOfflineStreamFrame(stream, input(2, 2)), { ok: false, error: "stale_stream_epoch" });
});

test("reconnect increments epoch but preserves required next sequence", () => {
  let stream = createOfflineAudioStream({ direction: "input" }).stream;
  stream = acceptOfflineStreamFrame(stream, input(1, 1)).stream;
  stream = disconnectOfflineAudioStream(stream, { reason: "synthetic_drop" }).stream;
  assert.deepEqual(acceptOfflineStreamFrame(stream, input(1, 2)), { ok: false, error: "audio_stream_disconnected" });
  const reconnected = reconnectOfflineAudioStream(stream, { resumeSequence: 2 });
  assert.equal(reconnected.ok, true);
  assert.equal(reconnected.stream.streamEpoch, 2);
  assert.equal(reconnected.nextSequence, 2);
  assert.deepEqual(acceptOfflineStreamFrame(reconnected.stream, input(1, 2)), { ok: false, error: "stale_stream_epoch" });
  assert.equal(acceptOfflineStreamFrame(reconnected.stream, input(2, 2)).ok, true);
});

test("unsafe resume sequence fails closed", () => {
  let stream = createOfflineAudioStream({ direction: "input" }).stream;
  stream = acceptOfflineStreamFrame(stream, input(1, 1)).stream;
  stream = disconnectOfflineAudioStream(stream).stream;
  assert.deepEqual(reconnectOfflineAudioStream(stream, { resumeSequence: 3 }), {
    ok: false,
    error: "unsafe_resume_sequence",
  });
});
