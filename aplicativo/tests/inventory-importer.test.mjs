import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { compareInventory, inventoryMetrics, parseInventoryWorkbook } from "../scripts/inventory-importer.mjs";

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
    for (const metric of inventoryMetrics) assert.equal(Number.isFinite(item[metric.key]), true);
  }
  const workbook = XLSX.read(fs.readFileSync(sourceFile), { type: "buffer", cellDates: false, codepage: 1252 });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: true, defval: "" });
  const sourceRow = rows.find((row) => /^\s*\d+\s*[-–]\s*/.test(String(row[1] ?? "")));
  const sourceCode = String(sourceRow[1]).match(/^\s*(\d+)/)[1].padStart(7, "0");
  const importedItem = parsed.items.find((item) => item.code === sourceCode);
  assert.deepEqual(
    inventoryMetrics.map((metric) => importedItem[metric.key]),
    sourceRow.slice(7, 17).map(Number),
  );
});

test("details additions, stock changes and removals", () => {
  const metrics = Object.fromEntries(inventoryMetrics.map((metric) => [metric.key, 0]));
  const current = [
    { code: "0000001", description: "Produto alterado", ...metrics, efPlus: 10 },
    { code: "0000002", description: "Produto removido", ...metrics, pcnrPlus: 7 },
  ];
  const next = [
    { code: "0000001", description: "Produto alterado", ...metrics, efPlus: 14.5 },
    { code: "0000003", description: "Produto incluído", ...metrics, pcnrPlus: 3 },
  ];
  const difference = compareInventory(current, next);
  assert.deepEqual(difference.added, [next[1]]);
  assert.deepEqual(difference.removed, [current[1]]);
  assert.deepEqual(difference.changed, [{
    code: "0000001",
    descriptionBefore: "Produto alterado",
    descriptionAfter: "Produto alterado",
    changes: [{ field: "efPlus", label: "EF(+)", before: 10, after: 14.5, difference: 4.5 }],
  }]);
});
