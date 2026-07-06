import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiGet, apiPost } from "../services/api";
import { isDueProcessNotification, prioritizeDueProcess } from "../utils/notificationPriority";
const convivenciaTemplates = [
    {
        key: "debido_proceso",
        label: "Debido proceso disciplinario",
        title: "Activacion de debido proceso escolar",
        body: "Se informa la activacion del debido proceso, garantizando el derecho de defensa, contradiccion y acompanamiento familiar, conforme a la Ley 1620 de 2013 y Decreto 1965 de 2013."
    },
    {
        key: "comite_convivencia",
        label: "Comite escolar de convivencia",
        title: "Citacion a Comite Escolar de Convivencia",
        body: "Se cita a acudientes para seguimiento de convivencia escolar segun ruta institucional y lineamientos del Sistema Nacional de Convivencia Escolar."
    },
    {
        key: "corresponsabilidad_familia",
        label: "Corresponsabilidad familia-escuela",
        title: "Compromiso de corresponsabilidad familia-escuela",
        body: "Se solicita acompanamiento familiar para fortalecer compromisos academicos y de convivencia, en armonia con Ley 115 de 1994 y Ley 1098 de 2006."
    }
];
const legalReferenceLabels = {
    LEY_1620_2013: "Ley 1620 de 2013",
    DECRETO_1965_2013: "Decreto 1965 de 2013",
    LEY_115_1994: "Ley 115 de 1994",
    LEY_1098_2006: "Ley 1098 de 2006"
};
export default function TeacherComms() {
    const [students, setStudents] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [adminNotifications, setAdminNotifications] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [adminPage, setAdminPage] = useState(1);
    const [adminTotal, setAdminTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState("");
    const [form, setForm] = useState({ studentId: "", legalReference: "LEY_1620_2013", templateKey: "", title: "", body: "" });
    const prioritizedNotifications = useMemo(() => prioritizeDueProcess(notifications), [notifications]);
    const prioritizedAdminNotifications = useMemo(() => prioritizeDueProcess(adminNotifications), [adminNotifications]);
    const load = () => {
        apiGet("/teacher/students").then((res) => setStudents(res)).catch(() => undefined);
        apiGet(`/teacher/notifications?page=${page}&pageSize=10${statusFilter ? `&status=${statusFilter}` : ""}`).then((res) => {
            setNotifications(res.data || []);
            setTotal(res.total || 0);
        }).catch(() => undefined);
        apiGet(`/teacher/admin-notifications?page=${adminPage}&pageSize=10${statusFilter ? `&status=${statusFilter}` : ""}`).then((res) => {
            setAdminNotifications(res.data || []);
            setAdminTotal(res.total || 0);
        }).catch(() => undefined);
    };
    useEffect(() => {
        load();
    }, [page, adminPage, statusFilter]);
    const create = async (e) => {
        e.preventDefault();
        if (!form.title || !form.body)
            return;
        await apiPost("/notifications", {
            title: form.title,
            body: form.body,
            studentId: form.studentId || undefined,
            legalReference: form.legalReference || undefined
        });
        setForm({ studentId: "", legalReference: "LEY_1620_2013", templateKey: "", title: "", body: "" });
        load();
    };
    const applyTemplate = (templateKey) => {
        const tpl = convivenciaTemplates.find((t) => t.key === templateKey);
        if (!tpl)
            return;
        setForm((prev) => ({ ...prev, templateKey, title: tpl.title, body: tpl.body }));
    };
    return (_jsxs(Section, { title: "Comunicaciones", children: [_jsx("div", { className: "help-card", children: "El docente crea notificaciones para padres de familia. Requiere aprobacion del administrador antes del envio." }), _jsxs("form", { className: "card", onSubmit: create, children: [_jsx("div", { className: "section-title", children: "Nueva notificacion" }), _jsxs("label", { children: ["Estudiante (opcional)", _jsxs("select", { className: "input", value: form.studentId, onChange: (e) => setForm({ ...form, studentId: e.target.value }), children: [_jsx("option", { value: "", children: "Todos" }), students.map((s) => (_jsx("option", { value: s.id, children: s.fullName }, s.id)))] })] }), _jsxs("label", { children: ["Base normativa", _jsxs("select", { className: "input", value: form.legalReference, onChange: (e) => setForm({ ...form, legalReference: e.target.value }), children: [_jsx("option", { value: "LEY_1620_2013", children: "Ley 1620 de 2013" }), _jsx("option", { value: "DECRETO_1965_2013", children: "Decreto 1965 de 2013" }), _jsx("option", { value: "LEY_115_1994", children: "Ley 115 de 1994" }), _jsx("option", { value: "LEY_1098_2006", children: "Ley 1098 de 2006" })] })] }), _jsxs("label", { children: ["Plantilla Manual de convivencia", _jsxs("select", { className: "input", value: form.templateKey, onChange: (e) => applyTemplate(e.target.value), children: [_jsx("option", { value: "", children: "Sin plantilla" }), convivenciaTemplates.map((tpl) => (_jsx("option", { value: tpl.key, children: tpl.label }, tpl.key)))] })] }), _jsxs("label", { children: ["Titulo", _jsx("input", { className: "input", value: form.title, onChange: (e) => setForm({ ...form, title: e.target.value }) })] }), _jsxs("label", { children: ["Mensaje", _jsx("textarea", { className: "input", rows: 4, value: form.body, onChange: (e) => setForm({ ...form, body: e.target.value }) })] }), _jsx("button", { className: "button", style: { marginTop: 10 }, children: "Enviar" })] }), _jsx("div", { style: { display: "flex", gap: 8, marginBottom: 8 }, children: _jsxs("select", { className: "input", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los estados" }), _jsx("option", { value: "PENDING", children: "Pendiente" }), _jsx("option", { value: "APPROVED", children: "Aprobado" }), _jsx("option", { value: "REJECTED", children: "Rechazado" }), _jsx("option", { value: "SENT", children: "Enviado" })] }) }), _jsx(DataTable, { columns: [
                    { key: "title", label: "Titulo" },
                    { key: "legalReference", label: "Base normativa" },
                    { key: "status", label: "Estado" },
                    { key: "date", label: "Fecha" }
                ], rowStyle: (row) => row.__priority
                    ? { background: "#fef2f2", borderLeft: "4px solid #ef4444" }
                    : undefined, rows: prioritizedNotifications.map((n) => {
                    const dueProcess = isDueProcessNotification(n);
                    return {
                        __priority: dueProcess,
                        title: (_jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("span", { children: n.title }), dueProcess && (_jsx("span", { style: { padding: "2px 8px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 12 }, children: "Prioridad" }))] })),
                        legalReference: legalReferenceLabels[String(n.legalReference || "")] || "-",
                        status: n.status,
                        date: n.createdAt.slice(0, 10)
                    };
                }) }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: page <= 1, onClick: () => setPage(page - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", page, " de ", Math.max(1, Math.ceil(total / 10))] }), _jsx("button", { className: "button secondary", disabled: page >= Math.ceil(total / 10), onClick: () => setPage(page + 1), children: "Siguiente" })] }), _jsxs("div", { className: "card", style: { marginTop: 12 }, children: [_jsx("div", { className: "section-title", children: "Comunicados institucionales para docentes" }), _jsx(DataTable, { columns: [
                            { key: "title", label: "Titulo" },
                            { key: "body", label: "Mensaje" },
                            { key: "status", label: "Estado" },
                            { key: "date", label: "Fecha" }
                        ], rowStyle: (row) => row.__priority
                            ? { background: "#fef2f2", borderLeft: "4px solid #ef4444" }
                            : undefined, rows: prioritizedAdminNotifications.map((n) => {
                            const dueProcess = isDueProcessNotification(n);
                            return {
                                __priority: dueProcess,
                                title: (_jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("span", { children: n.title }), dueProcess && (_jsx("span", { style: { padding: "2px 8px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 12 }, children: "Prioridad" }))] })),
                                body: n.body || "",
                                status: n.status,
                                date: n.createdAt.slice(0, 10)
                            };
                        }) }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: adminPage <= 1, onClick: () => setAdminPage(adminPage - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", adminPage, " de ", Math.max(1, Math.ceil(adminTotal / 10))] }), _jsx("button", { className: "button secondary", disabled: adminPage >= Math.ceil(adminTotal / 10), onClick: () => setAdminPage(adminPage + 1), children: "Siguiente" })] })] })] }));
}
