import { useEffect, useMemo, useState } from "react";
import ActionFeedback from "../components/ActionFeedback";
import { apiGet, apiPost } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { feedbackTitles } from "../utils/feedback";

type SessionItem = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ip?: string | null;
  userAgent?: string | null;
  deviceLabel?: string | null;
  geoCity?: string | null;
  geoRegion?: string | null;
  geoCountry?: string | null;
  geoCountryCode?: string | null;
  geoTimezone?: string | null;
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

  const getDeviceLabel = (session: SessionItem) => {
    if (session.deviceLabel) return session.deviceLabel;
    const ua = (session.userAgent || "").toLowerCase();
    const os =
      ua.includes("windows") ? "Windows" :
      ua.includes("android") ? "Android" :
      ua.includes("iphone") ? "iPhone" :
      ua.includes("ipad") ? "iPad" :
      ua.includes("mac os x") ? "macOS" :
      ua.includes("linux") ? "Linux" :
      "Dispositivo";
    const browser =
      ua.includes("edg") ? "Edge" :
      ua.includes("chrome") && !ua.includes("edg") ? "Chrome" :
      ua.includes("safari") && !ua.includes("chrome") ? "Safari" :
      ua.includes("firefox") ? "Firefox" :
      ua.includes("opera") || ua.includes("opr/") ? "Opera" :
      "";
    return browser ? `${browser} en ${os}` : os;
  };

  const getDeviceIcon = (session: SessionItem) => {
    const ua = (session.userAgent || "").toLowerCase();
    if (ua.includes("iphone") || ua.includes("android") && ua.includes("mobile")) return "📱";
    if (ua.includes("ipad") || ua.includes("tablet")) return "📲";
    if (ua.includes("android")) return "📱";
    if (ua.includes("mac os x") || ua.includes("windows") || ua.includes("linux")) return "🖥️";
    return "💻";
  };

  const getCountryFlag = (codeRaw?: string | null) => {
    const code = (codeRaw || "").trim().toUpperCase();
    if (code.length !== 2) return "";
    const A = 0x1f1e6;
    const chars = [...code].map((c) => String.fromCodePoint(A + c.charCodeAt(0) - 65));
    return chars.join("");
  };

  const getLocationLabel = (session: SessionItem) => {
    const parts = [session.geoCity, session.geoRegion, session.geoCountry].filter(Boolean);
    if (parts.length === 0) return "-";
    const flag = getCountryFlag(session.geoCountryCode);
    return `${flag ? `${flag} ` : ""}${parts.join(", ")}`;
  };

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

  const renameSession = async (session: SessionItem) => {
    const current = session.deviceLabel || getDeviceLabel(session);
    const next = window.prompt("Nombre del dispositivo:", current);
    if (!next) return;
    const label = next.trim();
    if (!label) return;
    try {
      await apiPost("/auth/sessions/label", { sessionId: session.id, label });
      setMsg("Nombre actualizado.");
      loadSessions();
    } catch {
      setError("No se pudo actualizar el nombre.");
    }
  };

  const logoutAll = async () => {
    setMsg(null);
    if (!window.confirm("Esto cerrara tu sesion actual y todas las demas. Continuar?")) return;
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
    if (!window.confirm(`Esto cerrara TODAS las sesiones de ${label}. Continuar?`)) return;
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

      <ActionFeedback
        tone="success"
        title={feedbackTitles.sessions.success}
        message={msg || ""}
        onDismiss={() => setMsg(null)}
        style={{ marginBottom: 12 }}
      />
      <ActionFeedback
        tone="error"
        title={feedbackTitles.sessions.error}
        message={error || ""}
        onDismiss={() => setError(null)}
        style={{ marginBottom: 12 }}
      />

      {loading ? (
        <div style={{ color: "#6b7280" }}>Cargando sesiones...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Sesion</th>
                <th>Nombre</th>
                <th>IP</th>
                <th>Ubicacion</th>
                <th>Dispositivo</th>
                <th>Creada</th>
                <th>Expira</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedSessions.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ color: "#6b7280" }}>
                    No hay sesiones activas.
                  </td>
                </tr>
              )}
              {sortedSessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.current ? "Actual" : "Otra"}</td>
                  <td>{`${getDeviceIcon(s)} ${getDeviceLabel(s)}`}</td>
                  <td>{s.ip || "-"}</td>
                  <td>{getLocationLabel(s)}</td>
                  <td style={{ maxWidth: 260 }}>{s.userAgent || "-"}</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>{new Date(s.expiresAt).toLocaleString()}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="button secondary"
                      onClick={() => renameSession(s)}
                      style={{ marginRight: 6 }}
                    >
                      Renombrar
                    </button>
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
