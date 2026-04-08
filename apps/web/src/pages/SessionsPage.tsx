import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../services/api";
import { useAuth } from "../context/AuthContext";

type SessionItem = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ip?: string | null;
  userAgent?: string | null;
  current: boolean;
};

const roleLabels: Record<string, string> = {
  ADMIN: "Administradores",
  TEACHER: "Docentes",
  PARENT: "Padres"
};

export default function SessionsPage() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [roleToRevoke, setRoleToRevoke] = useState("TEACHER");

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => (a.current === b.current ? 0 : a.current ? -1 : 1)),
    [sessions]
  );

  const loadSessions = () => {
    setLoading(true);
    setError(null);
    apiGet("/auth/sessions")
      .then((res) => {
        setSessions(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => setError("No se pudieron cargar las sesiones."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const revokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    setMsg(null);
    try {
      await apiPost("/auth/logout-session", { sessionId });
      setMsg("Sesion cerrada.");
      loadSessions();
    } catch {
      setError("No se pudo cerrar la sesion.");
    } finally {
      setRevoking(null);
    }
  };

  const logoutAll = async () => {
    setMsg(null);
    if (!window.confirm("Esto cerrara tu sesion actual y todas las demas. ¿Continuar?")) return;
    try {
      await apiPost("/auth/logout-all", {});
      logout();
    } catch {
      setError("No se pudieron cerrar todas las sesiones.");
    }
  };

  const revokeRole = async () => {
    setMsg(null);
    const label = roleLabels[roleToRevoke] || roleToRevoke;
    if (!window.confirm(`Esto cerrara TODAS las sesiones de ${label}. ¿Continuar?`)) return;
    try {
      const res = await apiPost("/auth/logout-role", { role: roleToRevoke });
      setMsg(`Sesiones revocadas: ${res?.revoked ?? 0}.`);
    } catch {
      setError("No se pudieron cerrar las sesiones por rol.");
    }
  };

  return (
    <div className="card" style={{ padding: 18 }}>
      <h2 style={{ marginTop: 0 }}>Sesiones activas</h2>
      <p style={{ color: "#64748b" }}>
        Gestiona tus sesiones abiertas y cierra dispositivos que no reconozcas.
      </p>

      {msg && <div className="success" style={{ marginBottom: 12 }}>{msg}</div>}
      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ color: "#6b7280" }}>Cargando sesiones...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Sesion</th>
                <th>IP</th>
                <th>Dispositivo</th>
                <th>Creada</th>
                <th>Expira</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedSessions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: "#6b7280" }}>
                    No hay sesiones activas.
                  </td>
                </tr>
              )}
              {sortedSessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.current ? "Actual" : "Otra"}</td>
                  <td>{s.ip || "-"}</td>
                  <td style={{ maxWidth: 260 }}>{s.userAgent || "-"}</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>{new Date(s.expiresAt).toLocaleString()}</td>
                  <td style={{ textAlign: "right" }}>
                    {!s.current && (
                      <button
                        className="button warning"
                        onClick={() => revokeSession(s.id)}
                        disabled={revoking === s.id}
                      >
                        Cerrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button className="button secondary" onClick={loadSessions}>
          Recargar
        </button>
        <button className="button warning" onClick={logoutAll}>
          Cerrar todas mis sesiones
        </button>
      </div>

      {user?.role === "ADMIN" && (
        <div className="card" style={{ marginTop: 18, background: "#f8fafc" }}>
          <h3 style={{ marginTop: 0 }}>Cerrar sesiones por rol</h3>
          <p style={{ color: "#64748b" }}>
            Accion administrativa: cerrara todas las sesiones activas del rol seleccionado.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              className="input"
              value={roleToRevoke}
              onChange={(e) => setRoleToRevoke(e.target.value)}
            >
              <option value="TEACHER">Docentes</option>
              <option value="PARENT">Padres</option>
              <option value="ADMIN">Administradores</option>
            </select>
            <button className="button warning" onClick={revokeRole}>
              Cerrar sesiones del rol
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
