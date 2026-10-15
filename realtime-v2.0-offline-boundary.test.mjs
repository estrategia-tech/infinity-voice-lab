import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const FORBIDDEN = [
  /\bfetch\s*\(/,
  /\bWebSocket\s*\(/,
  /\bprocess\.env\b/,
  /from\s+["']node:(?:http|https|net|tls|dgram|child_process)["']/,
  /require\s*\(\s*["'](?:http|https|net|tls|dgram|child_process)["']\s*\)/,
  /\b(?:OPENAI|TWILIO|CLOUDFLARE|WHATSAPP|META)_[A-Z0-9_]*(?:KEY|TOKEN|SECRET)\b/,
];

function runtimeV2Files() {
  return readdirSync(".")
    .filter((name) => name.startsWith("realtime-v2.0-") && name.endsWith(".mjs") && !name.endsWith(".test.mjs"))
    .sort();
}

test("v2 runtime modules preserve the offline/no-secret/no-network boundary", () => {
  const files = runtimeV2Files();
  assert.ok(files.length >= 10, "expected v2 runtime modules to scan");
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN) {
      assert.equal(pattern.test(source), false, `${file} matched forbidden runtime pattern ${pattern}`);
    }
  }
});
