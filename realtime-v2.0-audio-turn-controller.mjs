/**
 * Infinity Voice v2.0 — offline output turn/barge-in controller.
 * Controls synthetic output generations only; never plays audio or touches devices.
 */
import { validateOfflineAudioFrame } from "./realtime-v2.0-audio-frame.mjs";

function validController(value) {
  return value?.kind === "offline-audio-turn-controller" && Number.isSafeInteger(value.generation) && value.generation >= 1 &&
    Number.isSafeInteger(value.capacityFrames) && value.capacityFrames >= 1 && Array.isArray(value.queue) &&
    ["idle", "playing", "interrupted"].includes(value.status);
}

function freezeQueue(queue) {
  return Object.freeze([...queue]);
}

export function createOfflineAudioTurnController({ capacityFrames = 32 } = {}) {
  if (!Number.isSafeInteger(capacityFrames) || capacityFrames < 1 || capacityFrames > 512) {
    return { ok: false, error: "invalid_turn_controller_config" };
  }
  return {
    ok: true,
    controller: Object.freeze({
      kind: "offline-audio-turn-controller",
      generation: 1,
      capacityFrames,
      queue: freezeQueue([]),
      status: "idle",
      interruptedFrames: 0,
    }),
  };
}

export function enqueueOfflineOutputFrame(controller, rawFrame, generation = controller?.generation) {
  if (!validController(controller)) return { ok: false, error: "invalid_turn_controller" };
  if (!Number.isSafeInteger(generation) || generation !== controller.generation) {
    return { ok: false, error: "stale_output_generation" };
  }
  const checked = validateOfflineAudioFrame(rawFrame);
  if (!checked.ok) return checked;
  if (checked.frame.direction !== "output") return { ok: false, error: "output_frame_required" };
  if (controller.queue.length >= controller.capacityFrames) return { ok: false, error: "output_backpressure" };
  if (controller.queue.some((item) => item.frame.sequence === checked.frame.sequence)) {
    return { ok: false, error: "duplicate_output_frame" };
  }
  const entry = Object.freeze({ generation, frame: checked.frame });
  return {
    ok: true,
    controller: Object.freeze({ ...controller, queue: freezeQueue([...controller.queue, entry]) }),
  };
}

export function startOfflineOutput(controller) {
  if (!validController(controller)) return { ok: false, error: "invalid_turn_controller" };
  if (controller.queue.length === 0) return { ok: false, error: "no_output_queued" };
  return { ok: true, controller: Object.freeze({ ...controller, status: "playing" }) };
}

export function dequeueOfflineOutputFrame(controller) {
  if (!validController(controller)) return { ok: false, error: "invalid_turn_controller" };
  if (controller.status !== "playing" || controller.queue.length === 0) {
    return { ok: true, ready: false, controller };
  }
  const [entry, ...rest] = controller.queue;
  if (entry.generation !== controller.generation) return { ok: false, error: "stale_output_generation" };
  return {
    ok: true,
    ready: true,
    entry,
    controller: Object.freeze({
      ...controller,
      queue: freezeQueue(rest),
      status: rest.length === 0 ? "idle" : "playing",
    }),
  };
}

export function bargeInOfflineOutput(controller, { reason = "user_speech" } = {}) {
  if (!validController(controller) || typeof reason !== "string" || reason.length < 1 || reason.length > 80) {
    return { ok: false, error: "invalid_barge_in" };
  }
  if (controller.status !== "playing") return { ok: false, error: "barge_in_not_active" };
  const interruptedFrames = controller.queue.length;
  return {
    ok: true,
    previousGeneration: controller.generation,
    reason,
    controller: Object.freeze({
      ...controller,
      generation: controller.generation + 1,
      queue: freezeQueue([]),
      status: "interrupted",
      interruptedFrames: controller.interruptedFrames + interruptedFrames,
    }),
  };
}

export function resetOfflineOutputAfterInterruption(controller) {
  if (!validController(controller)) return { ok: false, error: "invalid_turn_controller" };
  if (controller.status !== "interrupted") return { ok: false, error: "not_interrupted" };
  return { ok: true, controller: Object.freeze({ ...controller, status: "idle" }) };
}
