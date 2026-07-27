import { useEffect, useState } from "react";

import ActionFeedback from "../components/ActionFeedback";
import { apiGet } from "../services/api";
import { feedbackTitles } from "../utils/feedback";

type MetricBucket = {
  total: number;
  hit: number;
  miss: number;
  bypass: number;
  set: number;
  readErr: number;
  writeErr: number;
};

type CacheMetrics = {
  startedAt: string;
  total: number;
  hit: number;
  miss: number;
  bypass: number;
  set: number;
  readErr: number;
  writeErr: number;
  hitRate: number;
  missRate: number;
  byPrefix: Record<string, MetricBucket>;
  byTag: Record<string, MetricBucket>;
};

function toList(map: Record<string, MetricBucket>) {
  return Object.entries(map).map(([key, value]) => ({ key, ...value }));
}

export default function AdminCacheMetrics() {
  const [metrics, setMetrics] = useState<CacheMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiGet("/ops/cache")
      .then((res) => setMetrics(res))
      .catch(() => setError("No se pudieron cargar las metricas de cache."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const byPrefix = metrics ? toList(metrics.byPrefix) : [];
  const byTag = metrics ? toList(metrics.byTag) : [];

  return (
    <div className="card" style={{ padding: 18 }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
      >
        <div>
          <h2 style={{ marginTop: 0 }}>Cache metrics</h2>
          {metrics && (
            <div style={{ color: "#64748b" }}>
              Desde: {new Date(metrics.startedAt).toLocaleString()}
            </div>
          )}
        </div>
        <button className="button secondary" onClick={load}>
          Recargar
        </button>
      </div>

      <ActionFeedback
        tone="error"
        title={feedbackTitles.cache.error}
        message={error || ""}
        onDismiss={() => setError(null)}
        style={{ marginTop: 12 }}
      />
      {loading && <div style={{ color: "#6b7280", marginTop: 12 }}>Cargando...</div>}

      {metrics && !loading && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <div className="card">
              <div style={{ color: "#64748b" }}>Total</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{metrics.total}</div>
            </div>
            <div className="card">
              <div style={{ color: "#64748b" }}>Hit rate</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{metrics.hitRate}%</div>
            </div>
            <div className="card">
              <div style={{ color: "#64748b" }}>Miss rate</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{metrics.missRate}%</div>
            </div>
            <div className="card">
              <div style={{ color: "#64748b" }}>Hits</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{metrics.hit}</div>
            </div>
            <div className="card">
              <div style={{ color: "#64748b" }}>Miss</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{metrics.miss}</div>
            </div>
            <div className="card">
              <div style={{ color: "#64748b" }}>Bypass</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{metrics.bypass}</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
              marginTop: 20,
            }}
          >
            <div>
              <h3>Por prefijo</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Prefijo</th>
                      <th>Hit</th>
                      <th>Miss</th>
                      <th>Bypass</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPrefix.length === 0 && (
                      <tr>
                        <td colSpan={4}>Sin datos.</td>
                      </tr>
                    )}
                    {byPrefix.map((row) => (
                      <tr key={row.key}>
                        <td>{row.key}</td>
                        <td>{row.hit}</td>
                        <td>{row.miss}</td>
                        <td>{row.bypass}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3>Top tags</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Hit</th>
                      <th>Miss</th>
                      <th>Bypass</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byTag.length === 0 && (
                      <tr>
                        <td colSpan={4}>Sin datos.</td>
                      </tr>
                    )}
                    {byTag.slice(0, 20).map((row) => (
                      <tr key={row.key}>
                        <td>{row.key}</td>
                        <td>{row.hit}</td>
                        <td>{row.miss}</td>
                        <td>{row.bypass}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
