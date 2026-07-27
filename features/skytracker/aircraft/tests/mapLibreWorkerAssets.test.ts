import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const WORKER_PATH = "public/maplibre/maplibre-gl-worker.mjs";
const SHARED_PATH = "public/maplibre/maplibre-gl-shared.mjs";

test("the local MapLibre worker has its relative shared module", () => {
  assert.equal(existsSync(WORKER_PATH), true);
  assert.equal(existsSync(SHARED_PATH), true);
  assert.ok(statSync(WORKER_PATH).size > 0);
  assert.ok(statSync(SHARED_PATH).size > 0);
  assert.match(readFileSync(WORKER_PATH, "utf8"), /\.\/maplibre-gl-shared\.mjs/);
});
