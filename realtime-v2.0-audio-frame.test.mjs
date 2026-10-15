import test from "node:test";
import assert from "node:assert/strict";
import {
  createSyntheticOfflineAudioFrame,
  expectedPcm16FrameBytes,
  validateOfflineAudioFrame,
} from "./realtime-v2.0-audio-frame.mjs";

test("accepts exact-size synthetic PCM16 frames", () => {
  assert.equal(expectedPcm16FrameBytes(24_000, 20, 1), 960);
  assert.equal(expectedPcm16FrameBytes(16_000, 10, 1), 320);
  const result = createSyntheticOfflineAudioFrame({
    streamEpoch: 1,
    sequence: 1,
    timestampMs: 1_000,
    direction: "input",
    sampleRateHz: 24_000,
    frameDurationMs: 20,
    fillByte: 7,
  });
  assert.equal(result.ok, true);
  assert.equal(result.frame.payload.byteLength, 960);
  assert.equal(result.frame.codec, "pcm16le");
});

test("rejects wrong payload size", () => {
  const result = validateOfflineAudioFrame({
    streamEpoch: 1,
    sequence: 1,
    timestampMs: 1_000,
    direction: "input",
    codec: "pcm16le",
    sampleRateHz: 24_000,
    channels: 1,
    frameDurationMs: 20,
    payload: new Uint8Array(959),
  });
  assert.deepEqual(result, { ok: false, error: "audio_payload_size_mismatch" });
});

test("rejects unsupported codec rate channels duration and unexpected fields", () => {
  const base = {
    streamEpoch: 1,
    sequence: 1,
    timestampMs: 1_000,
    direction: "input",
    codec: "pcm16le",
    sampleRateHz: 24_000,
    channels: 1,
    frameDurationMs: 20,
    payload: new Uint8Array(960),
  };
  assert.equal(validateOfflineAudioFrame({ ...base, codec: "opus" }).ok, false);
  assert.equal(validateOfflineAudioFrame({ ...base, sampleRateHz: 44_100 }).ok, false);
  assert.equal(validateOfflineAudioFrame({ ...base, channels: 2 }).ok, false);
  assert.equal(validateOfflineAudioFrame({ ...base, frameDurationMs: 40 }).ok, false);
  assert.deepEqual(validateOfflineAudioFrame({ ...base, secret: "x" }), {
    ok: false,
    error: "unexpected_audio_field",
  });
});

test("returns an isolated payload copy", () => {
  const payload = new Uint8Array(960).fill(3);
  const result = validateOfflineAudioFrame({
    streamEpoch: 1,
    sequence: 1,
    timestampMs: 1_000,
    direction: "output",
    codec: "pcm16le",
    sampleRateHz: 24_000,
    channels: 1,
    frameDurationMs: 20,
    payload,
  });
  assert.equal(result.ok, true);
  payload[0] = 99;
  assert.equal(result.frame.payload[0], 3);
});
