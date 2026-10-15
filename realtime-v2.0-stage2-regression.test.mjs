import test from "node:test";
import assert from "node:assert/strict";
import { createSyntheticOfflineAudioFrame } from "./realtime-v2.0-audio-frame.mjs";
import {
  createOfflineJitterBuffer,
  dequeueOfflineAudioFrame,
  enqueueOfflineAudioFrame,
} from "./realtime-v2.0-audio-buffer.mjs";
import {
  bargeInOfflineOutput,
  createOfflineAudioTurnController,
  enqueueOfflineOutputFrame,
  resetOfflineOutputAfterInterruption,
  startOfflineOutput,
} from "./realtime-v2.0-audio-turn-controller.mjs";
import {
  acceptOfflineStreamFrame,
  createOfflineAudioStream,
  disconnectOfflineAudioStream,
  reconnectOfflineAudioStream,
} from "./realtime-v2.0-audio-stream.mjs";

function frame({ epoch = 1, sequence, direction = "input", timestampMs = 1_000 + sequence * 20 }) {
  return createSyntheticOfflineAudioFrame({
    streamEpoch: epoch,
    sequence,
    timestampMs,
    direction,
    sampleRateHz: 24_000,
    frameDurationMs: 20,
  }).frame;
}

test("input path accepts synthetic bytes and reorders bounded jitter", () => {
  let stream = createOfflineAudioStream({ direction: "input" }).stream;
  stream = acceptOfflineStreamFrame(stream, frame({ sequence: 1 })).stream;
  assert.equal(stream.lastAcceptedSequence, 1);

  let jitter = createOfflineJitterBuffer({
    direction: "input",
    capacityFrames: 4,
    reorderWindowFrames: 2,
    expectedSequence: 2,
  }).buffer;
  jitter = enqueueOfflineAudioFrame(jitter, frame({ sequence: 3 })).buffer;
  assert.equal(dequeueOfflineAudioFrame(jitter).ready, false);
  jitter = enqueueOfflineAudioFrame(jitter, frame({ sequence: 2 })).buffer;
  const two = dequeueOfflineAudioFrame(jitter);
  assert.equal(two.ready, true);
  assert.equal(two.frame.sequence, 2);
  const three = dequeueOfflineAudioFrame(two.buffer);
  assert.equal(three.frame.sequence, 3);
});

test("backpressure and sequence gaps fail closed", () => {
  let jitter = createOfflineJitterBuffer({ direction: "input", capacityFrames: 2, reorderWindowFrames: 1 }).buffer;
  jitter = enqueueOfflineAudioFrame(jitter, frame({ sequence: 1 })).buffer;
  jitter = enqueueOfflineAudioFrame(jitter, frame({ sequence: 2 })).buffer;
  assert.deepEqual(enqueueOfflineAudioFrame(jitter, frame({ sequence: 3 })), {
    ok: false,
    error: "audio_backpressure",
  });

  let stream = createOfflineAudioStream({ direction: "input" }).stream;
  assert.deepEqual(acceptOfflineStreamFrame(stream, frame({ sequence: 2 })), {
    ok: false,
    error: "audio_sequence_gap",
  });
});

test("barge-in invalidates old output generation", () => {
  let controller = createOfflineAudioTurnController({ capacityFrames: 4 }).controller;
  controller = enqueueOfflineOutputFrame(controller, frame({ sequence: 1, direction: "output" })).controller;
  controller = enqueueOfflineOutputFrame(controller, frame({ sequence: 2, direction: "output" })).controller;
  controller = startOfflineOutput(controller).controller;
  const interrupted = bargeInOfflineOutput(controller, { reason: "synthetic_user_barge_in" });
  assert.equal(interrupted.controller.generation, 2);
  assert.equal(interrupted.controller.queue.length, 0);
  controller = resetOfflineOutputAfterInterruption(interrupted.controller).controller;
  assert.deepEqual(enqueueOfflineOutputFrame(controller, frame({ sequence: 3, direction: "output" }), 1), {
    ok: false,
    error: "stale_output_generation",
  });
  assert.equal(enqueueOfflineOutputFrame(controller, frame({ sequence: 3, direction: "output" }), 2).ok, true);
});

test("reconnect changes epoch and rejects stale media", () => {
  let stream = createOfflineAudioStream({ direction: "input" }).stream;
  stream = acceptOfflineStreamFrame(stream, frame({ sequence: 1 })).stream;
  stream = disconnectOfflineAudioStream(stream, { reason: "synthetic_transport_drop" }).stream;
  const reconnect = reconnectOfflineAudioStream(stream, { resumeSequence: 2 });
  assert.equal(reconnect.ok, true);
  assert.equal(reconnect.stream.streamEpoch, 2);
  assert.deepEqual(acceptOfflineStreamFrame(reconnect.stream, frame({ epoch: 1, sequence: 2 })), {
    ok: false,
    error: "stale_stream_epoch",
  });
  assert.equal(acceptOfflineStreamFrame(reconnect.stream, frame({ epoch: 2, sequence: 2 })).ok, true);
});
