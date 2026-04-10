import { useEffect, useState } from "react";
import { apiGet } from "../services/api";

export default function DeveloperZone() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiGet("/dev/info")
      .then((res) => setData(res))
      .catch((err) => setError(err?.message || "No se pudo cargar la zona de desarrollador."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ marginTop: 0 }}>Zona de desarrolladores</h2>
          <div style={{ color: "#64748b" }}>
            Acceso exclusivo para rol DEVELOPER.
          </div>
        </div>
        <button className="button secondary" onClick={load}>Recargar</button>
      </div>

      {loading && <div style={{ color: "#6b7280", marginTop: 12 }}>Cargando...</div>}
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      {data && !loading && (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <div className="card">
            <div style={{ color: "#64748b" }}>Servicio</div>
            <div style={{ fontWeight: 700 }}>{data.service}</div>
          </div>
          <div className="card">
            <div style={{ color: "#64748b" }}>Entorno</div>
            <div>{data.env}</div>
          </div>
          <div className="card">
            <div style={{ color: "#64748b" }}>Node</div>
            <div>{data.node}</div>
          </div>
          <div className="card">
            <div style={{ color: "#64748b" }}>Uptime</div>
            <div>{Math.floor((data.uptimeSeconds || 0) / 60)} min</div>
          </div>
          <div className="card">
            <div style={{ color: "#64748b" }}>DB</div>
            <div>{data.checks?.db}</div>
          </div>
          <div className="card">
            <div style={{ color: "#64748b" }}>Cache hit rate</div>
            <div>{data.cache?.hitRate ?? 0}%</div>
          </div>
          <div className="card">
            <div style={{ color: "#64748b" }}>Rate limit total</div>
            <div>{data.rateLimit?.total ?? 0}</div>
          </div>
        </div>
      )}
    </div>
  );
}
