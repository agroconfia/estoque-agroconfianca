import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { compareInventory, parseInventoryWorkbook } from "../scripts/inventory-importer.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = path.resolve(appRoot, "..", "Fatu4184.XLS");

test("imports the current stock report", async () => {
  const parsed = await parseInventoryWorkbook(sourceFile);
  assert.ok(parsed.items.length > 0);
  assert.match(parsed.referenceDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Set(parsed.items.map((item) => item.code)).size, parsed.items.length);
  const descriptions = parsed.items.map((item) => item.description);
  const alphabetical = [...descriptions].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true }),
  );
  assert.deepEqual(descriptions, alphabetical);
  for (const item of parsed.items) {
    assert.match(item.code, /^\d+$/);
    assert.ok(item.description.length > 0);
    assert.equal(Number.isFinite(item.stock), true);
  }
});

test("details additions, stock changes and removals", () => {
  const current = [
    { code: "0000001", description: "Produto alterado", stock: 10 },
    { code: "0000002", description: "Produto removido", stock: 7 },
  ];
  const next = [
    { code: "0000001", description: "Produto alterado", stock: 14.5 },
    { code: "0000003", description: "Produto incluído", stock: 3 },
  ];
  const difference = compareInventory(current, next);
  assert.deepEqual(difference.added, [next[1]]);
  assert.deepEqual(difference.removed, [current[1]]);
  assert.deepEqual(difference.changed, [{
    code: "0000001",
    descriptionBefore: "Produto alterado",
    descriptionAfter: "Produto alterado",
    stockBefore: 10,
    stockAfter: 14.5,
    stockDifference: 4.5,
  }]);
});
