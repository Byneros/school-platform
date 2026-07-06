import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import ActionFeedback from "../components/ActionFeedback";
import { ApiError, apiGet, apiPost, clearDeveloperAccessToken, getDeveloperAccessToken, setDeveloperAccessToken } from "../services/api";
import { feedbackTitles } from "../utils/feedback";
export default function DeveloperZone() {
    const [accessToken, setAccessTokenInput] = useState(getDeveloperAccessToken());
    const [data, setData] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [purgeConfirmation, setPurgeConfirmation] = useState("");
    const [purgeBusy, setPurgeBusy] = useState(false);
    const [purgeError, setPurgeError] = useState(null);
    const [purgeResult, setPurgeResult] = useState(null);
    const load = () => {
        setLoading(true);
        setError(null);
        Promise.all([apiGet("/dev/info"), apiGet("/dev/users")])
            .then(([infoRes, usersRes]) => {
            setData(infoRes);
            setUsers(usersRes?.data || []);
        })
            .catch((err) => {
            const message = err instanceof ApiError && err.status === 404
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
    const purgeDatabase = async () => {
        setPurgeError(null);
        setPurgeResult(null);
        if (purgeConfirmation.trim() !== "BORRAR BASE DE DATOS") {
            setPurgeError("Escribe exactamente BORRAR BASE DE DATOS para confirmar.");
            return;
        }
        const confirmed = window.confirm("Esta accion borrara estudiantes, matriculas, acudientes, docentes, administradores, pagos, reportes, notificaciones y todo dato operativo. Solo conservara usuarios desarrolladores. Continuar?");
        if (!confirmed)
            return;
        setPurgeBusy(true);
        try {
            const result = await apiPost("/dev/database/purge", { confirmation: purgeConfirmation.trim() });
            setPurgeResult(result);
            setPurgeConfirmation("");
            load();
        }
        catch (err) {
            setPurgeError(err?.message || "No se pudo borrar la base de datos.");
        }
        finally {
            setPurgeBusy(false);
        }
    };
    return (_jsxs("div", { style: { display: "grid", gap: 16 }, children: [_jsxs("div", { className: "card", style: { padding: 18 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: [_jsxs("div", { children: [_jsx("h2", { style: { marginTop: 0, marginBottom: 6 }, children: "Zona de desarrollador" }), _jsx("div", { style: { color: "#64748b" }, children: "Consola privada con diagnostico, usuarios, metricas y control avanzado." })] }), _jsx("button", { className: "button secondary", onClick: load, children: "Recargar" })] }), _jsxs("div", { style: { display: "grid", gap: 8, marginTop: 14 }, children: [_jsxs("label", { children: ["Token especial de desarrollador", _jsx("input", { className: "input", type: "password", value: accessToken, onChange: (e) => setAccessTokenInput(e.target.value), placeholder: "Ingresa el token configurado en el backend" })] }), _jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [_jsx("button", { className: "button", type: "button", onClick: saveToken, children: "Guardar token" }), _jsx("button", { className: "button secondary", type: "button", onClick: clearToken, children: "Limpiar token" })] })] })] }), loading && _jsx("div", { className: "card", children: "Cargando zona developer..." }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.developer.accessError, message: error || "", onDismiss: () => setError(null) }), data && !loading && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }, children: [_jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#64748b" }, children: "Servicio" }), _jsx("div", { style: { fontWeight: 700 }, children: data.service })] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#64748b" }, children: "Entorno" }), _jsx("div", { children: data.env })] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#64748b" }, children: "Base de datos" }), _jsx("div", { children: data.checks?.db || "-" })] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#64748b" }, children: "Sesiones activas" }), _jsx("div", { children: data.metrics?.activeSessions ?? 0 })] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#64748b" }, children: "Feedback abierto" }), _jsx("div", { children: data.metrics?.feedbackOpen ?? 0 })] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#64748b" }, children: "Cache hit rate" }), _jsxs("div", { children: [data.cache?.hitRate ?? 0, "%"] })] })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: "Usuarios por rol" }), _jsx("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", color: "#334155" }, children: Object.entries(data.metrics?.usersByRole || {}).map(([role, count]) => (_jsxs("div", { className: "badge", children: [role, ": ", count] }, role))) })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: "Usuarios recientes" }), users.length === 0 ? (_jsx("div", { style: { color: "#64748b" }, children: "No hay usuarios para mostrar." })) : (_jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Nombre" }), _jsx("th", { children: "Correo" }), _jsx("th", { children: "Rol" }), _jsx("th", { children: "Estado" })] }) }), _jsx("tbody", { children: users.slice(0, 20).map((user) => (_jsxs("tr", { children: [_jsx("td", { children: user.fullName }), _jsx("td", { children: user.email }), _jsx("td", { children: user.role }), _jsx("td", { children: user.isActive ? "Activo" : "Inactivo" })] }, user.id))) })] }) }))] }), _jsxs("div", { className: "card", style: { borderColor: "#fecaca", background: "#fff7f7" }, children: [_jsx("div", { className: "section-title", children: "Borrar base de datos" }), _jsx("div", { style: { color: "#991b1b", marginBottom: 10 }, children: "Elimina todos los datos operativos y todos los usuarios excepto los usuarios con rol DEVELOPER." }), _jsxs("label", { children: ["Confirmacion requerida", _jsx("input", { className: "input", value: purgeConfirmation, onChange: (e) => setPurgeConfirmation(e.target.value), placeholder: "BORRAR BASE DE DATOS" })] }), _jsx("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }, children: _jsx("button", { className: "button danger", type: "button", onClick: purgeDatabase, disabled: purgeBusy || purgeConfirmation.trim() !== "BORRAR BASE DE DATOS", children: purgeBusy ? "Borrando..." : "Borrar todo excepto desarrolladores" }) }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.developer.accessError, message: purgeError || "", onDismiss: () => setPurgeError(null), style: { marginTop: 10 } }), purgeResult && (_jsxs("div", { style: { marginTop: 10, color: "#166534" }, children: [purgeResult.message || "Base borrada.", _jsx("pre", { style: { whiteSpace: "pre-wrap", marginTop: 8 }, children: JSON.stringify(purgeResult.deleted || {}, null, 2) })] }))] })] }))] }));
}
