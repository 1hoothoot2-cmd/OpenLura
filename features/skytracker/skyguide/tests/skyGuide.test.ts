import assert from "node:assert/strict";
import test from "node:test";
import {
  classifySkyGuideScope,
  createSkyGuideFoundationResponse,
  inferSkyGuideAudienceMode,
  normalizeSkyGuideQuery,
  SKYGUIDE_ACTIONS,
  SKYGUIDE_CAPABILITIES,
  SKYGUIDE_PLACEHOLDERS,
} from "../domain/skyGuide.ts";

test("normalizes whitespace without changing meaningful text", () => {
  assert.equal(normalizeSkyGuideQuery("  What   is squawk 7700?  "), "What is squawk 7700?");
});

test("accepts supported aviation questions", () => {
  for (const query of [
    "Why is this aircraft flying so low?",
    "Tell me about EHAM airport",
    "What does squawk 7700 mean?",
    "Hoe is het vliegweer boven Frankfurt?",
  ]) {
    assert.equal(classifySkyGuideScope(query).accepted, true, query);
  }
});

test("rejects unrelated and empty questions", () => {
  assert.deepEqual(classifySkyGuideScope("   "), { accepted: false, reason: "empty" });
  assert.deepEqual(classifySkyGuideScope("Give me a pasta recipe"), {
    accepted: false,
    reason: "outside-aviation",
  });
});

test("uses token boundaries instead of accepting aviation substrings", () => {
  assert.equal(classifySkyGuideScope("Explain the plainest option").accepted, false);
});

test("audience policy keeps simple questions concise and recognizes technical language", () => {
  assert.equal(inferSkyGuideAudienceMode("Why does an aircraft fly?"), "beginner");
  assert.equal(inferSkyGuideAudienceMode("Explain this METAR and QNH"), "expert");
});

test("foundation response is honest for accepted questions", () => {
  const response = createSkyGuideFoundationResponse("How does an aircraft maintain altitude?");
  assert.equal(response.accepted, true);
  assert.match(response.message, /future SkyGuide sprint/);
});

test("foundation response politely enforces the aviation scope", () => {
  const response = createSkyGuideFoundationResponse("Write JavaScript for me");
  assert.equal(response.accepted, false);
  assert.match(response.message, /aviation, aircraft, flights and airports/);
});

test("smart actions and placeholders are deterministic and unique", () => {
  assert.equal(SKYGUIDE_ACTIONS.length, 6);
  assert.equal(new Set(SKYGUIDE_ACTIONS.map((action) => action.id)).size, 6);
  assert.ok(SKYGUIDE_PLACEHOLDERS.length >= 5);
  assert.equal(new Set(SKYGUIDE_PLACEHOLDERS).size, SKYGUIDE_PLACEHOLDERS.length);
});

test("future capabilities are explicit and unavailable in the foundation", () => {
  assert.ok(SKYGUIDE_CAPABILITIES.length >= 7);
  assert.ok(SKYGUIDE_CAPABILITIES.every((capability) => !capability.available));
});
