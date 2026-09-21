import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseInventoryWorkbook } from "../scripts/inventory-importer.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = path.resolve(appRoot, "..", "Fatu4184.XLS");

test("imports the current stock report", async () => {
  const parsed = await parseInventoryWorkbook(sourceFile);
  assert.ok(parsed.items.length > 0);
  assert.match(parsed.referenceDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Set(parsed.items.map((item) => item.code)).size, parsed.items.length);
  for (const item of parsed.items) {
    assert.match(item.code, /^\d+$/);
    assert.ok(item.description.length > 0);
    assert.equal(Number.isFinite(item.stock), true);
  }
});
