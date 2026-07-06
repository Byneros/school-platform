import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import ActionFeedback from "../components/ActionFeedback";
import { apiGet, apiPost } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { feedbackTitles } from "../utils/feedback";
const roleLabels = {
    ADMIN: "Administradores",
    TEACHER: "Docentes",
    PARENT: "Padres"
};
export default function SessionsPage() {
    const { user, logout } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState(null);
    const [error, setError] = useState(null);
    const [revoking, setRevoking] = useState(null);
    const [roleToRevoke, setRoleToRevoke] = useState("TEACHER");
    const getDeviceLabel = (session) => {
        if (session.deviceLabel)
            return session.deviceLabel;
        const ua = (session.userAgent || "").toLowerCase();
        const os = ua.includes("windows") ? "Windows" :
            ua.includes("android") ? "Android" :
                ua.includes("iphone") ? "iPhone" :
                    ua.includes("ipad") ? "iPad" :
                        ua.includes("mac os x") ? "macOS" :
                            ua.includes("linux") ? "Linux" :
                                "Dispositivo";
        const browser = ua.includes("edg") ? "Edge" :
            ua.includes("chrome") && !ua.includes("edg") ? "Chrome" :
                ua.includes("safari") && !ua.includes("chrome") ? "Safari" :
                    ua.includes("firefox") ? "Firefox" :
                        ua.includes("opera") || ua.includes("opr/") ? "Opera" :
                            "";
        return browser ? `${browser} en ${os}` : os;
    };
    const getDeviceIcon = (session) => {
        const ua = (session.userAgent || "").toLowerCase();
        if (ua.includes("iphone") || ua.includes("android") && ua.includes("mobile"))
            return "📱";
        if (ua.includes("ipad") || ua.includes("tablet"))
            return "📲";
        if (ua.includes("android"))
            return "📱";
        if (ua.includes("mac os x") || ua.includes("windows") || ua.includes("linux"))
            return "🖥️";
        return "💻";
    };
    const getCountryFlag = (codeRaw) => {
        const code = (codeRaw || "").trim().toUpperCase();
        if (code.length !== 2)
            return "";
        const A = 0x1f1e6;
        const chars = [...code].map((c) => String.fromCodePoint(A + c.charCodeAt(0) - 65));
        return chars.join("");
    };
    const getLocationLabel = (session) => {
        const parts = [session.geoCity, session.geoRegion, session.geoCountry].filter(Boolean);
        if (parts.length === 0)
            return "-";
        const flag = getCountryFlag(session.geoCountryCode);
        return `${flag ? `${flag} ` : ""}${parts.join(", ")}`;
    };
    const sortedSessions = useMemo(() => [...sessions].sort((a, b) => (a.current === b.current ? 0 : a.current ? -1 : 1)), [sessions]);
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
    const revokeSession = async (sessionId) => {
        setRevoking(sessionId);
        setMsg(null);
        try {
            await apiPost("/auth/logout-session", { sessionId });
            setMsg("Sesion cerrada.");
            loadSessions();
        }
        catch {
            setError("No se pudo cerrar la sesion.");
        }
        finally {
            setRevoking(null);
        }
    };
    const renameSession = async (session) => {
        const current = session.deviceLabel || getDeviceLabel(session);
        const next = window.prompt("Nombre del dispositivo:", current);
        if (!next)
            return;
        const label = next.trim();
        if (!label)
            return;
        try {
            await apiPost("/auth/sessions/label", { sessionId: session.id, label });
            setMsg("Nombre actualizado.");
            loadSessions();
        }
        catch {
            setError("No se pudo actualizar el nombre.");
        }
    };
    const logoutAll = async () => {
        setMsg(null);
        if (!window.confirm("Esto cerrara tu sesion actual y todas las demas. Continuar?"))
            return;
        try {
            await apiPost("/auth/logout-all", {});
            logout();
        }
        catch {
            setError("No se pudieron cerrar todas las sesiones.");
        }
    };
    const revokeRole = async () => {
        setMsg(null);
        const label = roleLabels[roleToRevoke] || roleToRevoke;
        if (!window.confirm(`Esto cerrara TODAS las sesiones de ${label}. Continuar?`))
            return;
        try {
            const res = await apiPost("/auth/logout-role", { role: roleToRevoke });
            setMsg(`Sesiones revocadas: ${res?.revoked ?? 0}.`);
        }
        catch {
            setError("No se pudieron cerrar las sesiones por rol.");
        }
    };
    return (_jsxs("div", { className: "card", style: { padding: 18 }, children: [_jsx("h2", { style: { marginTop: 0 }, children: "Sesiones activas" }), _jsx("p", { style: { color: "#64748b" }, children: "Gestiona tus sesiones abiertas y cierra dispositivos que no reconozcas." }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.sessions.success, message: msg || "", onDismiss: () => setMsg(null), style: { marginBottom: 12 } }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.sessions.error, message: error || "", onDismiss: () => setError(null), style: { marginBottom: 12 } }), loading ? (_jsx("div", { style: { color: "#6b7280" }, children: "Cargando sesiones..." })) : (_jsx("div", { style: { overflowX: "auto" }, children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Sesion" }), _jsx("th", { children: "Nombre" }), _jsx("th", { children: "IP" }), _jsx("th", { children: "Ubicacion" }), _jsx("th", { children: "Dispositivo" }), _jsx("th", { children: "Creada" }), _jsx("th", { children: "Expira" }), _jsx("th", {})] }) }), _jsxs("tbody", { children: [sortedSessions.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 8, style: { color: "#6b7280" }, children: "No hay sesiones activas." }) })), sortedSessions.map((s) => (_jsxs("tr", { children: [_jsx("td", { children: s.current ? "Actual" : "Otra" }), _jsx("td", { children: `${getDeviceIcon(s)} ${getDeviceLabel(s)}` }), _jsx("td", { children: s.ip || "-" }), _jsx("td", { children: getLocationLabel(s) }), _jsx("td", { style: { maxWidth: 260 }, children: s.userAgent || "-" }), _jsx("td", { children: new Date(s.createdAt).toLocaleString() }), _jsx("td", { children: new Date(s.expiresAt).toLocaleString() }), _jsxs("td", { style: { textAlign: "right", whiteSpace: "nowrap" }, children: [_jsx("button", { className: "button secondary", onClick: () => renameSession(s), style: { marginRight: 6 }, children: "Renombrar" }), !s.current && (_jsx("button", { className: "button warning", onClick: () => revokeSession(s.id), disabled: revoking === s.id, children: "Cerrar" }))] })] }, s.id)))] })] }) })), _jsxs("div", { style: { display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }, children: [_jsx("button", { className: "button secondary", onClick: loadSessions, children: "Recargar" }), _jsx("button", { className: "button warning", onClick: logoutAll, children: "Cerrar todas mis sesiones" })] }), user?.role === "ADMIN" && (_jsxs("div", { className: "card", style: { marginTop: 18, background: "#f8fafc" }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "Cerrar sesiones por rol" }), _jsx("p", { style: { color: "#64748b" }, children: "Accion administrativa: cerrara todas las sesiones activas del rol seleccionado." }), _jsxs("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" }, children: [_jsxs("select", { className: "input", value: roleToRevoke, onChange: (e) => setRoleToRevoke(e.target.value), children: [_jsx("option", { value: "TEACHER", children: "Docentes" }), _jsx("option", { value: "PARENT", children: "Padres" }), _jsx("option", { value: "ADMIN", children: "Administradores" })] }), _jsx("button", { className: "button warning", onClick: revokeRole, children: "Cerrar sesiones del rol" })] })] }))] }));
}
