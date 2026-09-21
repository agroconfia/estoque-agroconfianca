import { useMemo, useState } from "react";
import inventory from "./data/inventory.json";
import metadata from "./data/inventory-meta.json";

type Product = {
  code: string;
  description: string;
  stock: number;
};

type Filter = "all" | "positive" | "zero" | "negative";

const products = inventory as Product[];
const assetUrl = (name: string) => `${import.meta.env.BASE_URL}${name}`;
const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "positive", label: "Com saldo" },
  { id: "zero", label: "Zerados" },
  { id: "negative", label: "Negativos" },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function formatStock(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
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
  const [visible, setVisible] = useState(80);

  const summary = useMemo(
    () => ({
      positive: products.filter((item) => item.stock > 0).length,
      zero: products.filter((item) => item.stock === 0).length,
      negative: products.filter((item) => item.stock < 0).length,
      totalStock: products.reduce((total, item) => total + item.stock, 0),
    }),
    [],
  );

  const filtered = useMemo(() => {
    const search = normalize(query.trim());
    return products.filter((item) => {
      const matchesSearch = !search || normalize(`${item.code} ${item.description}`).includes(search);
      const matchesFilter =
        filter === "all" ||
        (filter === "positive" && item.stock > 0) ||
        (filter === "zero" && item.stock === 0) ||
        (filter === "negative" && item.stock < 0);
      return matchesSearch && matchesFilter;
    });
  }, [query, filter]);

  const shown = filtered.slice(0, visible);

  function chooseFilter(next: Filter) {
    setFilter(next);
    setVisible(80);
  }

  return (
    <main>
      <header className="topbar">
        <div className="topbar-inner">
          <img src={assetUrl("agroconfianca-branca.png")} alt="AgroConfiança" />
          <span className="topbar-divider" />
          <div>
            <strong>Consulta de Estoque</strong>
            <span>Código, descrição e estoque físico</span>
          </div>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">AgroConfiança</p>
          <h1>Encontre um produto no estoque.</h1>
          <p className="hero-copy">Pesquise pelo código ou por qualquer parte da descrição.</p>
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
          <span>EF(+) total</span>
          <strong>{formatStock(summary.totalStock)}</strong>
          <small>estoque físico em unidades básicas</small>
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

        <div className="result-line">
          <strong>{filtered.length}</strong> {filtered.length === 1 ? "produto encontrado" : "produtos encontrados"}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th className="stock-column">EF(+)</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr key={item.code}>
                  <td data-label="Código"><span className="code">{item.code}</span></td>
                  <td data-label="Descrição">{item.description}</td>
                  <td data-label="EF(+)" className={`stock ${item.stock < 0 ? "negative" : item.stock === 0 ? "zero" : "positive"}`}>
                    {formatStock(item.stock)}
                  </td>
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

        {shown.length < filtered.length && (
          <button className="load-more" type="button" onClick={() => setVisible((current) => current + 80)}>
            Mostrar mais produtos
          </button>
        )}
      </section>

      <footer>
        <img src={assetUrl("agroconfianca-colorida.png")} alt="AgroConfiança" />
        <p>Consulta baseada no relatório de estoque físico EF(+).</p>
      </footer>
    </main>
  );
}
