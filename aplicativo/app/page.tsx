import { useEffect, useMemo, useState } from "react";
import inventory from "./data/inventory.json";
import metadata from "./data/inventory-meta.json";

type Product = {
  code: string;
  description: string;
  supplier: string;
  calculatedStock: number;
  efPlus: number;
  pcnrPlus: number;
  pvneMinus: number;
  cfPlus: number;
  vfMinus: number;
  rdrMinus: number;
  rdePlus: number;
  caPlus: number;
  vaMinus: number;
};

type MetricKey = Exclude<keyof Product, "code" | "description" | "supplier">;
type Situation = "all" | "positive" | "zero" | "negative";
type BalanceMetric = "calculatedStock" | "efPlus" | "pcnrPlus" | "pvneMinus";
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const products = inventory as Product[];
const supplierOptions = Array.from(new Set(products.map((item) => item.supplier))).sort((a, b) =>
  a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true }),
);
const metricColumns: Array<{ key: MetricKey; label: string; primary?: boolean }> = [
  { key: "calculatedStock", label: "Estoque calculado" },
  { key: "efPlus", label: "EF(+)", primary: true },
  { key: "pcnrPlus", label: "PCNR(+)" },
  { key: "pvneMinus", label: "PVNE(-)" },
  { key: "cfPlus", label: "CF(+)" },
  { key: "vfMinus", label: "VF(-)" },
  { key: "rdrMinus", label: "RDR(-)" },
  { key: "rdePlus", label: "RDE(+)" },
  { key: "caPlus", label: "CA(+)" },
  { key: "vaMinus", label: "VA(-)" },
];
const balanceMetricOptions: Array<{ key: BalanceMetric; label: string }> = [
  { key: "calculatedStock", label: "Estoque Calculado" },
  { key: "efPlus", label: "EF(+)" },
  { key: "pcnrPlus", label: "PCNR(+)" },
  { key: "pvneMinus", label: "PVNE(-)" },
];
const assetUrl = (name: string) => `${import.meta.env.BASE_URL}${name}`;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function formatStock(value: number) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "Data não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function statusFor(value: number) {
  if (value < 0) return { label: "Saldo negativo", className: "negative" };
  if (value === 0) return { label: "Sem saldo", className: "zero" };
  return { label: "Com saldo", className: "positive" };
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [balanceMetric, setBalanceMetric] = useState<BalanceMetric>("pcnrPlus");
  const [situation, setSituation] = useState<Situation>("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const confirmInstallation = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowInstallHelp(false);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", confirmInstallation);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", confirmInstallation);
    };
  }, []);

  const summary = useMemo(() => ({
    positive: products.filter((item) => item.pcnrPlus > 0).length,
    zero: products.filter((item) => item.pcnrPlus === 0).length,
    negative: products.filter((item) => item.pcnrPlus < 0).length,
    totalStock: products.reduce((total, item) => total + item.pcnrPlus, 0),
    suppliers: supplierOptions.length,
  }), []);

  const filtered = useMemo(() => {
    const search = normalize(query.trim());
    return products.filter((item) => {
      const balance = item[balanceMetric];
      const matchesSearch = !search || normalize(`${item.code} ${item.description} ${item.supplier}`).includes(search);
      const matchesSituation =
        situation === "all" ||
        (situation === "positive" && balance > 0) ||
        (situation === "zero" && balance === 0) ||
        (situation === "negative" && balance < 0);
      const matchesSupplier = selectedSupplier === "all" || item.supplier === selectedSupplier;
      return matchesSearch && matchesSituation && matchesSupplier;
    });
  }, [query, balanceMetric, situation, selectedSupplier]);

  useEffect(() => setPage(1), [query, balanceMetric, situation, selectedSupplier, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const firstResult = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastResult = Math.min(safePage * pageSize, filtered.length);
  const shown = filtered.slice(firstResult ? firstResult - 1 : 0, lastResult);
  const pageStart = Math.max(1, Math.min(safePage - 2, pageCount - 4));
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => pageStart + index);

  function clearFilters() {
    setQuery("");
    setBalanceMetric("pcnrPlus");
    setSituation("all");
    setSelectedSupplier("all");
  }

  async function installApp() {
    if (!installPrompt) {
      setShowInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

  return (
    <main>
      <header className="app-header">
        <div className="header-inner">
          <img className="header-logo" src={assetUrl("agroconfianca-branca.png")} alt="AgroConfiança" />
          <nav aria-label="Seção atual"><span>Estoque</span></nav>
          <label className="header-search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto, código ou descrição..." aria-label="Buscar produto" />
          </label>
          <div className="header-date">
            <span>Posição de</span>
            <strong>{formatDate(metadata.referenceDate)}</strong>
          </div>
          {!installed && <button className="install-button" type="button" onClick={installApp}>Instalar</button>}
        </div>
      </header>

      {showInstallHelp && !installed && (
        <aside className="install-guide" aria-live="polite">
          <div><strong>Instale a consulta no celular</strong><span>Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.</span></div>
          <button type="button" onClick={() => setShowInstallHelp(false)} aria-label="Fechar instrução">×</button>
        </aside>
      )}

      <section className="hero">
        <div className="hero-leaf" aria-hidden="true" />
        <p className="eyebrow">Estoque</p>
        <h1>Encontre um produto no estoque.</h1>
        <p>Pesquise pelo código ou descrição e consulte todas as posições do produto.</p>
      </section>

      <section className="kpi-grid" aria-label="Resumo do estoque">
        <article className="kpi-card green-card"><span className="kpi-icon">PR</span><div><small>Produtos</small><strong>{products.length}</strong><p>{summary.positive} com saldo disponível</p></div></article>
        <article className="kpi-card green-card"><span className="kpi-icon">EF</span><div><small>Estoque Físico total</small><strong>{formatStock(summary.totalStock)}</strong><p>Valor corrigido da coluna PCNR(+)</p></div></article>
        <article className="kpi-card amber-card"><span className="kpi-icon">!</span><div><small>Saldos negativos</small><strong>{summary.negative}</strong><p>{summary.zero} produtos com saldo zero</p></div></article>
        <article className="kpi-card blue-card"><span className="kpi-icon">FO</span><div><small>Fornecedores</small><strong>{summary.suppliers}</strong><p>Fornecedores na lista atual</p></div></article>
      </section>

      <section className="filter-panel" aria-label="Filtros do estoque">
        <label className="main-search">
          <span aria-hidden="true">⌕</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por código, descrição ou fornecedor..." />
        </label>
        <label className="filter-field"><span>Coluna de estoque</span><select value={balanceMetric} onChange={(event) => setBalanceMetric(event.target.value as BalanceMetric)}>{balanceMetricOptions.map((metric) => <option key={metric.key} value={metric.key}>{metric.label}</option>)}</select></label>
        <label className="filter-field"><span>Situação</span><select value={situation} onChange={(event) => setSituation(event.target.value as Situation)}><option value="all">Todos</option><option value="positive">Com saldo</option><option value="zero">Zerados</option><option value="negative">Negativos</option></select></label>
        <label className="filter-field supplier-field"><span>Fornecedor</span><select value={selectedSupplier} onChange={(event) => setSelectedSupplier(event.target.value)}><option value="all">Todos</option>{supplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}</select></label>
        <button className="clear-button" type="button" onClick={clearFilters}>Limpar filtros</button>
      </section>

      <section className="results-panel">
        <div className="results-header"><p><strong>{filtered.length}</strong> {filtered.length === 1 ? "produto encontrado" : "produtos encontrados"}</p><span>Filtro de saldo: {balanceMetricOptions.find((metric) => metric.key === balanceMetric)?.label} · EF(+) em destaque</span></div>

        <div className="table-shell desktop-products">
          <table className="inventory-table">
            <thead><tr><th>Código</th><th>Descrição</th><th>Fornecedor</th>{metricColumns.map((metric) => <th key={metric.key} className={metric.primary ? "primary-metric" : ""}>{metric.label}</th>)}<th>Situação</th></tr></thead>
            <tbody>
              {shown.map((item) => {
                const status = statusFor(item[balanceMetric]);
                return <tr key={item.code}><td><span className="code">{item.code}</span></td><td>{item.description}</td><td className="supplier-cell">{item.supplier}</td>{metricColumns.map((metric) => { const value = item[metric.key]; return <td key={metric.key} className={`stock ${metric.primary ? "primary-metric" : ""} ${value < 0 ? "negative" : value === 0 ? "zero" : "positive"}`}>{formatStock(value)}</td>; })}<td><span className={`status-badge ${status.className}`}>{status.label}</span></td></tr>;
              })}
            </tbody>
          </table>
          {!shown.length && <div className="empty"><strong>Nenhum produto encontrado.</strong><span>Altere os filtros e tente novamente.</span></div>}
        </div>

        <div className="mobile-products">
          {shown.map((item) => { const status = statusFor(item[balanceMetric]); return <article className="product-card" key={item.code}><div className="product-card-heading"><span className="code">{item.code}</span><span className={`status-badge ${status.className}`}>{status.label}</span></div><h2>{item.description}</h2><p>{item.supplier}</p><dl>{metricColumns.map((metric) => <div key={metric.key} className={metric.primary ? "primary-metric" : ""}><dt>{metric.label}</dt><dd>{formatStock(item[metric.key])}</dd></div>)}</dl></article>; })}
          {!shown.length && <div className="empty"><strong>Nenhum produto encontrado.</strong><span>Altere os filtros e tente novamente.</span></div>}
        </div>

        <div className="pagination">
          <span>Exibindo {firstResult} a {lastResult} de {filtered.length}</span>
          <label><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={12}>12 por página</option><option value={24}>24 por página</option><option value={48}>48 por página</option></select></label>
          <div className="page-buttons"><button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button>{pageNumbers.map((number) => <button type="button" key={number} className={number === safePage ? "active" : ""} onClick={() => setPage(number)}>{number}</button>)}<button type="button" disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>›</button></div>
        </div>
      </section>

      <footer><img src={assetUrl("agroconfianca-colorida.png")} alt="AgroConfiança" /><p>Estoque Físico baseado nos valores corrigidos de PCNR(+).</p></footer>
    </main>
  );
}
