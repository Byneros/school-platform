import { useEffect, useState } from "react";
import ActionFeedback from "../components/ActionFeedback";
import {
  ApiError,
  apiGet,
  clearDeveloperAccessToken,
  getDeveloperAccessToken,
  setDeveloperAccessToken
} from "../services/api";
import { feedbackTitles } from "../utils/feedback";

type DeveloperInfo = {
  service: string;
  env: string;
  node: string;
  uptimeSeconds: number;
  timestamp: string;
  checks?: { db?: string };
  metrics?: {
    usersByRole?: Record<string, number>;
    activeSessions?: number;
    feedbackOpen?: number;
  };
  cache?: { hitRate?: number; total?: number };
  rateLimit?: { total?: number; blocked?: number };
};

export default function DeveloperZone() {
  const [accessToken, setAccessTokenInput] = useState(getDeveloperAccessToken());
  const [data, setData] = useState<DeveloperInfo | null>(null);
  const [users, setUsers] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([apiGet("/dev/info"), apiGet("/dev/users")])
      .then(([infoRes, usersRes]) => {
        setData(infoRes);
        setUsers(usersRes?.data || []);
      })
      .catch((err) => {
        const message =
          err instanceof ApiError && err.status === 404
            ? "Acceso developer bloqueado. Verifica el token especial o la IP permitida."
            : err?.message || "No se pudo cargar la zona de desarrollador.";
        setError(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const saveToken = () => {
    setDeveloperAccessToken(accessToken);
    load();
  };

  const clearToken = () => {
    clearDeveloperAccessToken();
    setAccessTokenInput("");
    load();
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Zona de desarrollador</h2>
            <div style={{ color: "#64748b" }}>
              Consola privada con diagnostico, usuarios, metricas y control avanzado.
            </div>
          </div>
          <button className="button secondary" onClick={load}>Recargar</button>
        </div>

        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          <label>
            Token especial de desarrollador
            <input
              className="input"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessTokenInput(e.target.value)}
              placeholder="Ingresa el token configurado en el backend"
            />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="button" type="button" onClick={saveToken}>
              Guardar token
            </button>
            <button className="button secondary" type="button" onClick={clearToken}>
              Limpiar token
            </button>
          </div>
        </div>
      </div>

      {loading && <div className="card">Cargando zona developer...</div>}
      <ActionFeedback
        tone="error"
        title={feedbackTitles.developer.accessError}
        message={error || ""}
        onDismiss={() => setError(null)}
      />

      {data && !loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div className="card">
              <div style={{ color: "#64748b" }}>Servicio</div>
              <div style={{ fontWeight: 700 }}>{data.service}</div>
            </div>
            <div className="card">
              <div style={{ color: "#64748b" }}>Entorno</div>
              <div>{data.env}</div>
            </div>
            <div className="card">
              <div style={{ color: "#64748b" }}>Base de datos</div>
              <div>{data.checks?.db || "-"}</div>
            </div>
            <div className="card">
              <div style={{ color: "#64748b" }}>Sesiones activas</div>
              <div>{data.metrics?.activeSessions ?? 0}</div>
            </div>
            <div className="card">
              <div style={{ color: "#64748b" }}>Feedback abierto</div>
              <div>{data.metrics?.feedbackOpen ?? 0}</div>
            </div>
            <div className="card">
              <div style={{ color: "#64748b" }}>Cache hit rate</div>
              <div>{data.cache?.hitRate ?? 0}%</div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Usuarios por rol</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: "#334155" }}>
              {Object.entries(data.metrics?.usersByRole || {}).map(([role, count]) => (
                <div key={role} className="badge">{role}: {count}</div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title">Usuarios recientes</div>
            {users.length === 0 ? (
              <div style={{ color: "#64748b" }}>No hay usuarios para mostrar.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Rol</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.slice(0, 20).map((user) => (
                      <tr key={user.id}>
                        <td>{user.fullName}</td>
                        <td>{user.email}</td>
                        <td>{user.role}</td>
                        <td>{user.isActive ? "Activo" : "Inactivo"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
