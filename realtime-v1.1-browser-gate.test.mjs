import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("browser voice gate is statically disabled",async()=>{
 const src=await readFile(new URL("./realtime-v1.1-candidate.js",import.meta.url),"utf8");
 assert.match(src,/const REALTIME_BROWSER_ENABLED = false;/);
 assert.match(src,/if \(!REALTIME_BROWSER_ENABLED\)/);
 assert.match(src,/\$\("start"\)\.disabled = !REALTIME_BROWSER_ENABLED;/);
});
test("no persistent API secret embedded in browser",async()=>{
 const src=await readFile(new URL("./realtime-v1.1-candidate.js",import.meta.url),"utf8");
 assert.doesNotMatch(src,/sk-[A-Za-z0-9_-]{16,}/);
});
