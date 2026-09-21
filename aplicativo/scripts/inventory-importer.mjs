import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const defaultInventoryPath = path.join(appRoot, "app", "data", "inventory.json");
const defaultMetadataPath = path.join(appRoot, "app", "data", "inventory-meta.json");

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizedHeader(value) {
  return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function parseReferenceDate(rows) {
  for (const row of rows) {
    for (const cell of row) {
      const match = cleanText(cell).match(/Data Ref\.\s*(\d{2})\/(\d{2})\/(\d{4})/i);
      if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    }
  }
  throw new Error("Não encontrei a data de referência no relatório.");
}

function findHeader(rows) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 60); rowIndex += 1) {
    const headers = rows[rowIndex].map(normalizedHeader);
    const description = headers.indexOf("descricao do produto");
    const stock = headers.indexOf("pcnr(+)");
    if (description >= 0 && stock >= 0) return { rowIndex, description, stock };
  }
  throw new Error("Não encontrei as colunas 'Descrição do produto' e 'PCNR(+)' na planilha.");
}

function parseNumber(value, rowNumber) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cleanText(value).replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error(`Linha ${rowNumber}: PCNR(+) inválido (${cleanText(value)}).`);
  return number;
}

export async function parseInventoryWorkbook(filePath) {
  const bytes = await fs.readFile(filePath);
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false, codepage: 1252 });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("A planilha não possui abas.");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "" });
  const header = findHeader(rows);
  const referenceDate = parseReferenceDate(rows);
  const items = [];
  const seen = new Map();
  const productPattern = /^\s*(\d+)\s*[-–]\s*(.+)$/;

  for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const descriptionCell = cleanText(rows[rowIndex][header.description]);
    const match = descriptionCell.match(productPattern);
    if (!match) continue;
    const code = match[1].padStart(7, "0");
    const description = cleanText(match[2]);
    const stock = Number(parseNumber(rows[rowIndex][header.stock], rowIndex + 1).toFixed(6));
    if (seen.has(code)) throw new Error(`Código duplicado nas linhas ${seen.get(code)} e ${rowIndex + 1}: ${code}.`);
    seen.set(code, rowIndex + 1);
    items.push({ code, description, stock });
  }

  if (!items.length) throw new Error("A planilha não contém produtos para importar.");
  return { items, sheetName, referenceDate };
}

function compareInventory(currentItems, nextItems) {
  const current = new Map(currentItems.map((item) => [item.code, item]));
  const next = new Map(nextItems.map((item) => [item.code, item]));
  const added = nextItems.filter((item) => !current.has(item.code));
  const changed = nextItems.filter((item) => {
    const before = current.get(item.code);
    return before && (before.description !== item.description || Math.abs(before.stock - item.stock) > 0.000001);
  });
  const removed = currentItems.filter((item) => !next.has(item.code));
  return { added, changed, removed, unchanged: nextItems.length - added.length - changed.length };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function sha256(filePath) {
  return createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const result = { command };
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error(`Argumento inválido: ${name ?? "vazio"}.`);
    result[name.slice(2)] = value;
  }
  return result;
}

async function createPreview(filePath, inventoryPath, metadataPath) {
  const parsed = await parseInventoryWorkbook(filePath);
  const currentItems = await readJson(inventoryPath, []);
  const currentMetadata = await readJson(metadataPath, {});
  const difference = compareInventory(currentItems, parsed.items);
  const warnings = [];
  if (currentItems.length && parsed.items.length < currentItems.length * 0.5) warnings.push("A nova planilha tem menos da metade dos produtos atuais.");
  if (difference.removed.length > 50) warnings.push(`A atualização removerá ${difference.removed.length} produtos.`);
  return {
    source: {
      path: path.resolve(filePath),
      fileName: path.basename(filePath),
      sha256: await sha256(filePath),
      sheetName: parsed.sheetName,
    },
    referenceDate: { current: currentMetadata.referenceDate ?? null, next: parsed.referenceDate },
    counts: {
      current: currentItems.length,
      next: parsed.items.length,
      unchanged: difference.unchanged,
      added: difference.added.length,
      changed: difference.changed.length,
      removed: difference.removed.length,
      positive: parsed.items.filter((item) => item.stock > 0).length,
      zero: parsed.items.filter((item) => item.stock === 0).length,
      negative: parsed.items.filter((item) => item.stock < 0).length,
    },
    totalStock: Number(parsed.items.reduce((total, item) => total + item.stock, 0).toFixed(2)),
    hasChanges: difference.added.length > 0 || difference.changed.length > 0 || difference.removed.length > 0 || currentMetadata.referenceDate !== parsed.referenceDate,
    warnings,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (!["preview", "apply"].includes(args.command) || !args.file || !args.output) {
    throw new Error("Uso: node scripts/inventory-importer.mjs <preview|apply> --file planilha.xls --output resultado.json");
  }
  const inventoryPath = args.inventory ? path.resolve(args.inventory) : defaultInventoryPath;
  const metadataPath = args.metadata ? path.resolve(args.metadata) : defaultMetadataPath;
  const preview = await createPreview(args.file, inventoryPath, metadataPath);
  if (args.command === "apply") {
    if (!args["expected-sha256"] || args["expected-sha256"] !== preview.source.sha256) {
      throw new Error("A planilha mudou depois da análise. Analise novamente antes de publicar.");
    }
    const parsed = await parseInventoryWorkbook(args.file);
    await fs.mkdir(path.dirname(inventoryPath), { recursive: true });
    await fs.writeFile(inventoryPath, `${JSON.stringify(parsed.items, null, 2)}\n`, "utf8");
    await fs.writeFile(metadataPath, `${JSON.stringify({ referenceDate: parsed.referenceDate, sourceFile: path.basename(args.file), productCount: parsed.items.length }, null, 2)}\n`, "utf8");
    preview.applied = true;
  }
  await fs.writeFile(path.resolve(args.output), `${JSON.stringify(preview, null, 2)}\n`, "utf8");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
