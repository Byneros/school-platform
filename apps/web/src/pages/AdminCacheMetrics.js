import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import ActionFeedback from "../components/ActionFeedback";
import { apiGet } from "../services/api";
import { feedbackTitles } from "../utils/feedback";
function toList(map) {
    return Object.entries(map).map(([key, value]) => ({ key, ...value }));
}
export default function AdminCacheMetrics() {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
    return (_jsxs("div", { className: "card", style: { padding: 18 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }, children: [_jsxs("div", { children: [_jsx("h2", { style: { marginTop: 0 }, children: "Cache metrics" }), metrics && (_jsxs("div", { style: { color: "#64748b" }, children: ["Desde: ", new Date(metrics.startedAt).toLocaleString()] }))] }), _jsx("button", { className: "button secondary", onClick: load, children: "Recargar" })] }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.cache.error, message: error || "", onDismiss: () => setError(null), style: { marginTop: 12 } }), loading && _jsx("div", { style: { color: "#6b7280", marginTop: 12 }, children: "Cargando..." }), metrics && !loading && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }, children: [_jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#64748b" }, children: "Total" }), _jsx("div", { style: { fontSize: 20, fontWeight: 700 }, children: metrics.total })] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#64748b" }, children: "Hit rate" }), _jsxs("div", { style: { fontSize: 20, fontWeight: 700 }, children: [metrics.hitRate, "%"] })] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#64748b" }, children: "Miss rate" }), _jsxs("div", { style: { fontSize: 20, fontWeight: 700 }, children: [metrics.missRate, "%"] })] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#64748b" }, children: "Hits" }), _jsx("div", { style: { fontSize: 20, fontWeight: 700 }, children: metrics.hit })] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#64748b" }, children: "Miss" }), _jsx("div", { style: { fontSize: 20, fontWeight: 700 }, children: metrics.miss })] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#64748b" }, children: "Bypass" }), _jsx("div", { style: { fontSize: 20, fontWeight: 700 }, children: metrics.bypass })] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 20 }, children: [_jsxs("div", { children: [_jsx("h3", { children: "Por prefijo" }), _jsx("div", { style: { overflowX: "auto" }, children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Prefijo" }), _jsx("th", { children: "Hit" }), _jsx("th", { children: "Miss" }), _jsx("th", { children: "Bypass" })] }) }), _jsxs("tbody", { children: [byPrefix.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 4, children: "Sin datos." }) })), byPrefix.map((row) => (_jsxs("tr", { children: [_jsx("td", { children: row.key }), _jsx("td", { children: row.hit }), _jsx("td", { children: row.miss }), _jsx("td", { children: row.bypass })] }, row.key)))] })] }) })] }), _jsxs("div", { children: [_jsx("h3", { children: "Top tags" }), _jsx("div", { style: { overflowX: "auto" }, children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Tag" }), _jsx("th", { children: "Hit" }), _jsx("th", { children: "Miss" }), _jsx("th", { children: "Bypass" })] }) }), _jsxs("tbody", { children: [byTag.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 4, children: "Sin datos." }) })), byTag.slice(0, 20).map((row) => (_jsxs("tr", { children: [_jsx("td", { children: row.key }), _jsx("td", { children: row.hit }), _jsx("td", { children: row.miss }), _jsx("td", { children: row.bypass })] }, row.key)))] })] }) })] })] })] }))] }));
}
