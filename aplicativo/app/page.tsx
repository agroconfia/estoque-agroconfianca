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

type Filter = "all" | "positive" | "zero" | "negative" | "supplier";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const products = inventory as Product[];
const supplierOptions = Array.from(new Set(products.map((item) => item.supplier))).sort((a, b) =>
  a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true }),
);
const assetUrl = (name: string) => `${import.meta.env.BASE_URL}${name}`;
const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "positive", label: "Com saldo" },
  { id: "zero", label: "Zerados" },
  { id: "negative", label: "Negativos" },
  { id: "supplier", label: "Fornecedor" },
];
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

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function formatStock(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "Data não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedSupplier, setSelectedSupplier] = useState(supplierOptions[0] ?? "");
  const [visible, setVisible] = useState(80);
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

  const summary = useMemo(
    () => ({
      positive: products.filter((item) => item.pcnrPlus > 0).length,
      zero: products.filter((item) => item.pcnrPlus === 0).length,
      negative: products.filter((item) => item.pcnrPlus < 0).length,
      totalStock: products.reduce((total, item) => total + item.pcnrPlus, 0),
    }),
    [],
  );

  const filtered = useMemo(() => {
    const search = normalize(query.trim());
    return products.filter((item) => {
      const matchesSearch = !search || normalize(`${item.code} ${item.description} ${item.supplier}`).includes(search);
      const matchesFilter =
        filter === "all" ||
        (filter === "positive" && item.pcnrPlus > 0) ||
        (filter === "zero" && item.pcnrPlus === 0) ||
        (filter === "negative" && item.pcnrPlus < 0) ||
        (filter === "supplier" && item.supplier === selectedSupplier);
      return matchesSearch && matchesFilter;
    });
  }, [query, filter, selectedSupplier]);

  const shown = filtered.slice(0, visible);

  function chooseFilter(next: Filter) {
    setFilter(next);
    setVisible(80);
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
      <header className="topbar">
        <div className="topbar-inner">
          <img src={assetUrl("agroconfianca-branca.png")} alt="AgroConfiança" />
          <span className="topbar-divider" />
          <div className="topbar-title">
            <strong>Consulta de Estoque</strong>
            <span>Código, descrição e todos os saldos</span>
          </div>
          {!installed && (
            <button className="install-button" type="button" onClick={installApp}>
              <span aria-hidden="true">↓</span>
              Instalar no celular
            </button>
          )}
        </div>
      </header>

      {showInstallHelp && !installed && (
        <aside className="install-guide" aria-live="polite">
          <div>
            <strong>Instale a consulta no celular</strong>
            <span>Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.</span>
          </div>
          <button type="button" onClick={() => setShowInstallHelp(false)} aria-label="Fechar instrução de instalação">×</button>
        </aside>
      )}

      <section className="hero">
        <div>
          <p className="eyebrow">AgroConfiança</p>
          <h1>Encontre um produto no estoque.</h1>
          <p className="hero-copy">Pesquise pelo código ou descrição e consulte todas as posições do produto.</p>
        </div>
        <div className="updated">
          <span className="updated-dot" />
          Posição de {formatDate(metadata.referenceDate)}
        </div>
      </section>

      <section className="summary" aria-label="Resumo do estoque">
        <article>
          <span>Produtos</span>
          <strong>{products.length}</strong>
          <small>{summary.positive} com saldo disponível</small>
        </article>
        <article>
          <span>Estoque Físico total</span>
          <strong>{formatStock(summary.totalStock)}</strong>
          <small>valor corrigido da coluna PCNR(+)</small>
        </article>
        <article className={summary.negative ? "attention" : ""}>
          <span>Saldos negativos</span>
          <strong>{summary.negative}</strong>
          <small>{summary.zero} produtos com saldo zero</small>
        </article>
      </section>

      <section className="workspace">
        <div className="search-row">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisible(80);
              }}
              placeholder="Buscar por código ou descrição"
              aria-label="Buscar produto"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca">
                ×
              </button>
            )}
          </label>
          <div className="filter-tabs" aria-label="Filtrar por saldo">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={filter === item.id ? "active" : ""}
                onClick={() => chooseFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filter === "supplier" && (
          <div className="supplier-filter">
            <label htmlFor="supplier-select">Fornecedor</label>
            <select
              id="supplier-select"
              value={selectedSupplier}
              onChange={(event) => {
                setSelectedSupplier(event.target.value);
                setVisible(80);
              }}
            >
              {supplierOptions.map((supplier) => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
            <span>{filtered.length} {filtered.length === 1 ? "produto" : "produtos"} deste fornecedor</span>
          </div>
        )}

        <div className="result-line">
          <strong>{filtered.length}</strong> {filtered.length === 1 ? "produto encontrado" : "produtos encontrados"}
        </div>

        <div className="table-wrap desktop-products">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                {metricColumns.map((metric) => (
                  <th key={metric.key} className={`metric-column ${metric.primary ? "primary-metric" : ""}`}>{metric.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr key={item.code}>
                  <td data-label="Código"><span className="code">{item.code}</span></td>
                  <td data-label="Descrição">
                    <span className="product-description">{item.description}</span>
                    <small className="supplier-name">{item.supplier}</small>
                  </td>
                  {metricColumns.map((metric) => {
                    const value = item[metric.key];
                    return (
                      <td
                        key={metric.key}
                        data-label={metric.label}
                        className={`stock ${metric.primary ? "primary-metric" : ""} ${value < 0 ? "negative" : value === 0 ? "zero" : "positive"}`}
                      >
                        {formatStock(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && (
            <div className="empty">
              <strong>Nenhum produto encontrado.</strong>
              <span>Tente outro código ou descrição.</span>
            </div>
          )}
        </div>

        <div className="mobile-products">
          {shown.map((item) => (
            <article className="product-card" key={item.code}>
              <div className="product-card-heading">
                <span className="code">{item.code}</span>
                <strong className={item.efPlus < 0 ? "negative" : item.efPlus === 0 ? "zero" : "positive"}>
                  EF(+) {formatStock(item.efPlus)}
                </strong>
              </div>
              <h2>{item.description}</h2>
              <p className="product-supplier">{item.supplier}</p>
              <dl>
                {metricColumns.map((metric) => (
                  <div key={metric.key} className={metric.primary ? "primary-metric" : ""}>
                    <dt>{metric.label}</dt>
                    <dd>{formatStock(item[metric.key])}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
          {!shown.length && (
            <div className="empty">
              <strong>Nenhum produto encontrado.</strong>
              <span>Tente outro código ou descrição.</span>
            </div>
          )}
        </div>

        {shown.length < filtered.length && (
          <button className="load-more" type="button" onClick={() => setVisible((current) => current + 80)}>
            Mostrar mais produtos
          </button>
        )}
      </section>

      <footer>
        <img src={assetUrl("agroconfianca-colorida.png")} alt="AgroConfiança" />
        <p>Estoque Físico baseado nos valores corrigidos de PCNR(+).</p>
      </footer>
    </main>
  );
}
