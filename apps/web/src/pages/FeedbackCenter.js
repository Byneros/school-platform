import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "../services/api";
import { useAuth } from "../context/AuthContext";
import ActionFeedback from "../components/ActionFeedback";
import { feedbackTitles } from "../utils/feedback";
const categoryLabel = {
    OPINION: "Opinion",
    BUG: "Error",
    SUGGESTION: "Sugerencia"
};
const statusLabel = {
    OPEN: "Abierto",
    REVIEWED: "Revisado",
    CLOSED: "Cerrado"
};
export default function FeedbackCenter() {
    const { user } = useAuth();
    const isDeveloper = user?.role === "DEVELOPER";
    const [mine, setMine] = useState([]);
    const [all, setAll] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [form, setForm] = useState({
        category: "SUGGESTION",
        title: "",
        message: ""
    });
    const [responses, setResponses] = useState({});
    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const mineRes = await apiGet("/feedback/mine");
            setMine(mineRes?.data || []);
            if (isDeveloper) {
                const allRes = await apiGet("/feedback");
                setAll(allRes?.data || []);
            }
            else {
                setAll([]);
            }
        }
        catch (err) {
            setError(err?.message || "No se pudo cargar el feedback.");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, [isDeveloper]);
    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        setMessage("");
        try {
            await apiPost("/feedback", form);
            setForm({ category: "SUGGESTION", title: "", message: "" });
            setMessage("Comentario registrado correctamente.");
            await load();
        }
        catch (err) {
            setError(err?.message || "No se pudo registrar el comentario.");
        }
        finally {
            setSaving(false);
        }
    };
    const respond = async (id) => {
        const current = responses[id];
        if (!current?.response?.trim())
            return;
        setSaving(true);
        setError("");
        try {
            await apiPatch(`/feedback/${id}/respond`, {
                status: current.status,
                response: current.response
            });
            setMessage("Respuesta guardada.");
            await load();
        }
        catch (err) {
            setError(err?.message || "No se pudo responder el feedback.");
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs("div", { style: { display: "grid", gap: 16 }, children: [_jsxs("form", { className: "card", onSubmit: submit, children: [_jsx("div", { className: "section-title", children: "Comentarios y feedback" }), _jsx("div", { style: { color: "#64748b", marginBottom: 10 }, children: "Comparte opiniones, reporta errores o deja sugerencias para mejorar el sistema." }), _jsxs("label", { children: ["Tipo", _jsxs("select", { className: "input", value: form.category, onChange: (e) => setForm((prev) => ({ ...prev, category: e.target.value })), children: [_jsx("option", { value: "SUGGESTION", children: "Sugerencia" }), _jsx("option", { value: "BUG", children: "Error" }), _jsx("option", { value: "OPINION", children: "Opinion" })] })] }), _jsxs("label", { children: ["Titulo", _jsx("input", { className: "input", value: form.title, onChange: (e) => setForm((prev) => ({ ...prev, title: e.target.value })), placeholder: "Resume tu comentario" })] }), _jsxs("label", { children: ["Mensaje", _jsx("textarea", { className: "input", rows: 5, value: form.message, onChange: (e) => setForm((prev) => ({ ...prev, message: e.target.value })), placeholder: "Describe con detalle lo que quieres reportar" })] }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.feedback.error, message: error, onDismiss: () => setError(""), style: { marginTop: 8, marginBottom: 0 } }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.feedback.success, message: message, onDismiss: () => setMessage(""), style: { marginTop: 8, marginBottom: 0 } }), _jsx("button", { className: "button", type: "submit", disabled: saving, style: { marginTop: 12 }, children: saving ? "Enviando..." : "Registrar feedback" })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: "Mis comentarios" }), loading ? (_jsx("div", { style: { color: "#64748b" }, children: "Cargando..." })) : mine.length === 0 ? (_jsx("div", { style: { color: "#64748b" }, children: "Todavia no has registrado comentarios." })) : (_jsx("div", { style: { display: "grid", gap: 10 }, children: mine.map((item) => (_jsxs("div", { className: "card", style: { boxShadow: "none" }, children: [_jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }, children: [_jsx("span", { className: "badge", children: categoryLabel[item.category] || item.category }), _jsx("span", { className: "badge", children: statusLabel[item.status] || item.status })] }), _jsx("div", { style: { fontWeight: 700 }, children: item.title }), _jsx("div", { style: { color: "#475569", whiteSpace: "pre-wrap", marginTop: 6 }, children: item.message }), _jsxs("div", { style: { color: "#64748b", fontSize: 12, marginTop: 8 }, children: ["Registrado: ", String(item.createdAt || "").slice(0, 19).replace("T", " ")] }), item.response && (_jsxs("div", { style: { marginTop: 10, padding: 10, background: "#f8fafc", borderRadius: 10 }, children: [_jsx("div", { style: { fontWeight: 600, marginBottom: 4 }, children: "Respuesta del sistema/equipo" }), _jsx("div", { style: { whiteSpace: "pre-wrap" }, children: item.response })] }))] }, item.id))) }))] }), isDeveloper && (_jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: "Bandeja global de feedback" }), all.length === 0 ? (_jsx("div", { style: { color: "#64748b" }, children: "No hay comentarios globales." })) : (_jsx("div", { style: { display: "grid", gap: 10 }, children: all.map((item) => {
                            const current = responses[item.id] || {
                                status: item.status,
                                response: item.response || ""
                            };
                            return (_jsxs("div", { className: "card", style: { boxShadow: "none" }, children: [_jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }, children: [_jsx("span", { className: "badge", children: categoryLabel[item.category] || item.category }), _jsx("span", { className: "badge", children: statusLabel[item.status] || item.status }), item.user && _jsxs("span", { className: "badge", children: [item.user.fullName, " \u00B7 ", item.user.role] })] }), _jsx("div", { style: { fontWeight: 700 }, children: item.title }), _jsx("div", { style: { color: "#475569", whiteSpace: "pre-wrap", marginTop: 6 }, children: item.message }), item.user && (_jsx("div", { style: { color: "#64748b", fontSize: 12, marginTop: 8 }, children: item.user.email })), _jsxs("div", { style: { display: "grid", gap: 8, marginTop: 10 }, children: [_jsxs("select", { className: "input", value: current.status, onChange: (e) => setResponses((prev) => ({
                                                    ...prev,
                                                    [item.id]: { ...current, status: e.target.value }
                                                })), children: [_jsx("option", { value: "OPEN", children: "Abierto" }), _jsx("option", { value: "REVIEWED", children: "Revisado" }), _jsx("option", { value: "CLOSED", children: "Cerrado" })] }), _jsx("textarea", { className: "input", rows: 4, value: current.response, onChange: (e) => setResponses((prev) => ({
                                                    ...prev,
                                                    [item.id]: { ...current, response: e.target.value }
                                                })), placeholder: "Respuesta interna o para el usuario" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => respond(item.id), disabled: saving, children: "Guardar respuesta" })] })] }, item.id));
                        }) }))] }))] }));
}
