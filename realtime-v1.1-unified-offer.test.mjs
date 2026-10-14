import test from "node:test";
import assert from "node:assert/strict";
import {prepareUnifiedOffer,validateSdpOffer} from "./realtime-v1.1-unified-offer.mjs";
const sdp="v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
test("valid audio SDP prepared without network call",()=>{
 const result=prepareUnifiedOffer({sdp});assert.equal(result.ok,true);
 assert.equal(JSON.parse(result.session).model,"gpt-realtime-2.1");
});
test("empty and video-only offers denied",()=>{
 assert.equal(validateSdpOffer("").ok,false);
 assert.equal(validateSdpOffer("v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96").ok,false);
});
test("oversized SDP and unsupported model denied",()=>{
 assert.equal(validateSdpOffer("v=0\r\nm=audio "+"a".repeat(40000)).ok,false);
 assert.equal(prepareUnifiedOffer({sdp,model:"arbitrary"}).ok,false);
});
