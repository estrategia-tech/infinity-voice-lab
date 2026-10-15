import test from "node:test";
import assert from "node:assert/strict";
import { createSyntheticOfflineAudioFrame } from "./realtime-v2.0-audio-frame.mjs";
import {
  bargeInOfflineOutput,
  createOfflineAudioTurnController,
  dequeueOfflineOutputFrame,
  enqueueOfflineOutputFrame,
  resetOfflineOutputAfterInterruption,
  startOfflineOutput,
} from "./realtime-v2.0-audio-turn-controller.mjs";

function out(sequence) {
  return createSyntheticOfflineAudioFrame({
    streamEpoch: 1,
    sequence,
    timestampMs: 1_000 + sequence * 20,
    direction: "output",
  }).frame;
}

test("queues and drains one output generation", () => {
  let controller = createOfflineAudioTurnController({ capacityFrames: 4 }).controller;
  controller = enqueueOfflineOutputFrame(controller, out(1)).controller;
  controller = enqueueOfflineOutputFrame(controller, out(2)).controller;
  controller = startOfflineOutput(controller).controller;
  const first = dequeueOfflineOutputFrame(controller);
  assert.equal(first.ready, true);
  assert.equal(first.entry.generation, 1);
  assert.equal(first.entry.frame.sequence, 1);
  const second = dequeueOfflineOutputFrame(first.controller);
  assert.equal(second.ready, true);
  assert.equal(second.controller.status, "idle");
});

test("barge-in invalidates queued old generation and starts a clean generation", () => {
  let controller = createOfflineAudioTurnController({ capacityFrames: 4 }).controller;
  controller = enqueueOfflineOutputFrame(controller, out(1)).controller;
  controller = enqueueOfflineOutputFrame(controller, out(2)).controller;
  controller = startOfflineOutput(controller).controller;
  const interrupted = bargeInOfflineOutput(controller, { reason: "synthetic_user_speech" });
  assert.equal(interrupted.ok, true);
  assert.equal(interrupted.previousGeneration, 1);
  assert.equal(interrupted.controller.generation, 2);
  assert.equal(interrupted.controller.queue.length, 0);
  assert.equal(interrupted.controller.interruptedFrames, 2);
  controller = resetOfflineOutputAfterInterruption(interrupted.controller).controller;
  assert.deepEqual(enqueueOfflineOutputFrame(controller, out(3), 1), {
    ok: false,
    error: "stale_output_generation",
  });
  controller = enqueueOfflineOutputFrame(controller, out(3), 2).controller;
  assert.equal(controller.queue[0].generation, 2);
});

test("rejects input frames duplicate output and output overflow", () => {
  let controller = createOfflineAudioTurnController({ capacityFrames: 1 }).controller;
  const input = createSyntheticOfflineAudioFrame({
    streamEpoch: 1, sequence: 1, timestampMs: 1_000, direction: "input",
  }).frame;
  assert.deepEqual(enqueueOfflineOutputFrame(controller, input), { ok: false, error: "output_frame_required" });
  controller = enqueueOfflineOutputFrame(controller, out(1)).controller;
  assert.deepEqual(enqueueOfflineOutputFrame(controller, out(1)), { ok: false, error: "output_backpressure" });
  assert.deepEqual(enqueueOfflineOutputFrame(controller, out(2)), { ok: false, error: "output_backpressure" });
});

test("barge-in is denied unless output is actively playing", () => {
  const controller = createOfflineAudioTurnController().controller;
  assert.deepEqual(bargeInOfflineOutput(controller), { ok: false, error: "barge_in_not_active" });
});
