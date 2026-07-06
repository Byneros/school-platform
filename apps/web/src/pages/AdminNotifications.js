import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import Autocomplete from "../components/Autocomplete";
import ActionFeedback from "../components/ActionFeedback";
import { apiGet, apiPatch, apiPost } from "../services/api";
import useSuggestions from "../hooks/useSuggestions";
import { isDueProcessNotification, prioritizeDueProcess } from "../utils/notificationPriority";
import { feedbackTitles } from "../utils/feedback";
const convivenciaTemplates = [
    {
        key: "debido_proceso",
        label: "Debido proceso disciplinario",
        title: "Activacion de debido proceso escolar",
        legalReferences: ["LEY_1620_2013", "DECRETO_1965_2013"],
        body: "Se informa la activacion del debido proceso, garantizando el derecho de defensa, contradiccion y acompanamiento familiar, conforme a la Ley 1620 de 2013 y Decreto 1965 de 2013. Favor presentarse en coordinacion para ruta de atencion."
    },
    {
        key: "promocion_derechos",
        label: "Promocion de derechos y convivencia",
        title: "Jornada de promocion de derechos y convivencia",
        legalReferences: ["LEY_1620_2013"],
        body: "Se convoca a jornada institucional de convivencia, participacion y prevencion de violencia escolar, conforme al Sistema Nacional de Convivencia Escolar (Ley 1620 de 2013)."
    },
    {
        key: "comite_convivencia",
        label: "Comite escolar de convivencia",
        title: "Citacion a Comite Escolar de Convivencia",
        legalReferences: ["DECRETO_1965_2013"],
        body: "Se cita al Comite Escolar de Convivencia para analisis y seguimiento del caso reportado, segun Decreto 1965 de 2013. Se solicita presencia puntual y soportes del caso."
    },
    {
        key: "ruta_atencion",
        label: "Ruta de atencion integral",
        title: "Activacion de ruta de atencion integral",
        legalReferences: ["DECRETO_1965_2013"],
        body: "Se informa activacion de la Ruta de Atencion Integral para la Convivencia Escolar ante presunta situacion tipo II/III. Se adelantara acompanamiento institucional y articulacion con entidades competentes."
    },
    {
        key: "corresponsabilidad_familia",
        label: "Corresponsabilidad familia-escuela",
        title: "Compromiso de corresponsabilidad familia-escuela",
        legalReferences: ["LEY_115_1994", "LEY_1098_2006"],
        body: "Se solicita acompanamiento familiar para fortalecimiento del proceso formativo, convivencia y cumplimiento de acuerdos pedagogicos, en armonia con la Ley 115 de 1994 y Ley 1098 de 2006."
    }
];
const legalReferenceLabels = {
    LEY_1620_2013: "Ley 1620 de 2013",
    DECRETO_1965_2013: "Decreto 1965 de 2013",
    LEY_115_1994: "Ley 115 de 1994",
    LEY_1098_2006: "Ley 1098 de 2006"
};
export default function AdminNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [studentSearch, setStudentSearch] = useState("");
    const [teacherSearch, setTeacherSearch] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState("");
    const [createBusy, setCreateBusy] = useState(false);
    const [createError, setCreateError] = useState("");
    const [createMessage, setCreateMessage] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const [statusError, setStatusError] = useState("");
    const [createForm, setCreateForm] = useState({
        audience: "BOTH",
        legalReference: "LEY_1620_2013",
        templateKey: "",
        title: "",
        body: "",
        studentId: "",
        targetUserId: ""
    });
    const [editingId, setEditingId] = useState("");
    const [editingBusy, setEditingBusy] = useState(false);
    const [editingError, setEditingError] = useState("");
    const [editingMessage, setEditingMessage] = useState("");
    const [editingForm, setEditingForm] = useState({ title: "", body: "" });
    const studentSuggestions = useSuggestions({
        endpoint: "/suggestions?type=students",
        query: studentSearch
    });
    const teacherSuggestions = useSuggestions({
        endpoint: "/suggestions?type=teachers",
        query: teacherSearch
    });
    const filteredTemplates = convivenciaTemplates.filter((tpl) => tpl.legalReferences.includes(createForm.legalReference));
    const selectedTemplate = convivenciaTemplates.find((tpl) => tpl.key === createForm.templateKey);
    const prioritizedNotifications = useMemo(() => prioritizeDueProcess(notifications), [notifications]);
    const load = () => apiGet(`/notifications?page=${page}&pageSize=10${statusFilter ? `&status=${statusFilter}` : ""}`)
        .then((res) => {
        setNotifications(res.data || []);
        setTotal(res.total || 0);
    })
        .catch(() => undefined);
    useEffect(() => {
        load();
    }, [page, statusFilter]);
    const approve = async (id) => {
        setStatusMessage("");
        setStatusError("");
        try {
            await apiPost(`/notifications/${id}/approve`, {});
            setStatusMessage("Notificacion aprobada satisfactoriamente.");
            load();
            window.dispatchEvent(new Event("notifications-updated"));
        }
        catch (error) {
            setStatusError(error?.message || "No se pudo aprobar la notificacion");
        }
    };
    const reject = async (id) => {
        setStatusMessage("");
        setStatusError("");
        try {
            await apiPost(`/notifications/${id}/reject`, {});
            setStatusMessage("Notificacion rechazada satisfactoriamente.");
            load();
            window.dispatchEvent(new Event("notifications-updated"));
        }
        catch (error) {
            setStatusError(error?.message || "No se pudo rechazar la notificacion");
        }
    };
    const startEdit = (notification) => {
        setEditingError("");
        setEditingMessage("");
        setEditingId(notification.id);
        setEditingForm({ title: notification.title, body: notification.body || "" });
    };
    const saveEdit = async (e) => {
        e.preventDefault();
        if (!editingId)
            return;
        setEditingBusy(true);
        setEditingError("");
        setEditingMessage("");
        try {
            const updated = await apiPatch(`/notifications/${editingId}`, editingForm);
            setNotifications((prev) => prev.map((n) => (n.id === editingId ? { ...n, ...updated } : n)));
            setEditingMessage("Notificacion actualizada satisfactoriamente.");
        }
        catch (error) {
            setEditingError(error?.message || "No se pudo actualizar la notificacion");
        }
        finally {
            setEditingBusy(false);
        }
    };
    const applyTemplate = (templateKey) => {
        const tpl = convivenciaTemplates.find((t) => t.key === templateKey);
        if (!tpl)
            return;
        setCreateForm((prev) => ({
            ...prev,
            templateKey,
            title: tpl.title,
            body: tpl.body,
            legalReference: tpl.legalReferences[0] || prev.legalReference
        }));
    };
    const selectStudent = (student) => {
        setCreateForm((prev) => ({ ...prev, studentId: student?.id || "" }));
        setStudentSearch(student ? student.label || student.value : "");
    };
    const selectTeacher = (teacher) => {
        setCreateForm((prev) => ({ ...prev, targetUserId: teacher?.id || "" }));
        setTeacherSearch(teacher ? teacher.label || teacher.value : "");
    };
    const createByAdmin = async (e) => {
        e.preventDefault();
        if (!createForm.title.trim() || !createForm.body.trim())
            return;
        setCreateBusy(true);
        setCreateError("");
        setCreateMessage("");
        try {
            await apiPost("/notifications/admin", {
                title: createForm.title.trim(),
                body: createForm.body.trim(),
                audience: createForm.audience,
                legalReference: createForm.legalReference || undefined,
                ...(createForm.studentId ? { studentId: createForm.studentId } : {}),
                ...(createForm.targetUserId ? { targetUserId: createForm.targetUserId } : {})
            });
            setCreateMessage("Notificacion creada y enviada correctamente.");
            setCreateForm({ audience: "BOTH", legalReference: "LEY_1620_2013", templateKey: "", title: "", body: "", studentId: "", targetUserId: "" });
            load();
            window.dispatchEvent(new Event("notifications-updated"));
        }
        catch (error) {
            setCreateError(error?.message || "No se pudo crear la notificacion");
        }
        finally {
            setCreateBusy(false);
        }
    };
    return (_jsxs(Section, { title: "Notificaciones", children: [_jsx("div", { className: "help-card", children: "Aprueba/rechaza comunicaciones docentes y crea comunicados directos para docentes, padres o ambos." }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.notifications.createSuccess, message: createMessage, onDismiss: () => setCreateMessage("") }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.notifications.createError, message: createError, onDismiss: () => setCreateError("") }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.notifications.statusSuccess, message: statusMessage, onDismiss: () => setStatusMessage("") }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.notifications.statusError, message: statusError, onDismiss: () => setStatusError("") }), _jsxs("form", { className: "card", onSubmit: createByAdmin, children: [_jsx("div", { className: "section-title", children: "Nueva notificacion institucional (Administrador)" }), _jsxs("label", { children: ["Destinatarios", _jsxs("select", { className: "input", value: createForm.audience, onChange: (e) => {
                                    const audience = e.target.value;
                                    setCreateForm((prev) => ({
                                        ...prev,
                                        audience,
                                        ...(audience === "PARENTS" ? { targetUserId: "" } : {}),
                                        ...(audience === "TEACHERS" ? { studentId: "" } : {})
                                    }));
                                    setStudentSearch("");
                                    setTeacherSearch("");
                                }, children: [_jsx("option", { value: "BOTH", children: "Docentes y padres" }), _jsx("option", { value: "TEACHERS", children: "Solo docentes" }), _jsx("option", { value: "PARENTS", children: "Solo padres" })] })] }), (createForm.audience === "PARENTS" || createForm.audience === "BOTH") && (_jsxs("label", { children: ["Estudiante (opcional, para notificacion individual a acudientes)", _jsx(Autocomplete, { className: "input", placeholder: "Buscar estudiante", value: studentSearch, options: studentSuggestions, onChange: (value) => {
                                    setStudentSearch(value);
                                    setCreateForm((prev) => ({ ...prev, studentId: "" }));
                                }, onSelectOption: (option) => selectStudent(option) }), _jsx("div", { style: { marginTop: 6 }, children: _jsx("button", { type: "button", className: "button secondary", onClick: () => selectStudent(), children: "Todos los padres" }) })] })), (createForm.audience === "TEACHERS" || createForm.audience === "BOTH") && (_jsxs("label", { children: ["Docente (opcional, para notificacion individual)", _jsx(Autocomplete, { className: "input", placeholder: "Buscar docente", value: teacherSearch, options: teacherSuggestions, onChange: (value) => {
                                    setTeacherSearch(value);
                                    setCreateForm((prev) => ({ ...prev, targetUserId: "" }));
                                }, onSelectOption: (option) => selectTeacher(option) }), _jsx("div", { style: { marginTop: 6 }, children: _jsx("button", { type: "button", className: "button secondary", onClick: () => selectTeacher(), children: "Todos los docentes" }) })] })), _jsxs("label", { children: ["Base normativa", _jsxs("select", { className: "input", value: createForm.legalReference, onChange: (e) => {
                                    const legalReference = e.target.value;
                                    setCreateForm((prev) => ({
                                        ...prev,
                                        legalReference,
                                        ...(prev.templateKey && !convivenciaTemplates.find((t) => t.key === prev.templateKey)?.legalReferences.includes(legalReference)
                                            ? { templateKey: "" }
                                            : {})
                                    }));
                                }, children: [_jsx("option", { value: "LEY_1620_2013", children: "Ley 1620 de 2013" }), _jsx("option", { value: "DECRETO_1965_2013", children: "Decreto 1965 de 2013" }), _jsx("option", { value: "LEY_115_1994", children: "Ley 115 de 1994" }), _jsx("option", { value: "LEY_1098_2006", children: "Ley 1098 de 2006" })] })] }), _jsxs("label", { children: ["Plantilla Manual de convivencia (MEN Colombia)", _jsxs("select", { className: "input", value: createForm.templateKey, onChange: (e) => applyTemplate(e.target.value), children: [_jsx("option", { value: "", children: "Sin plantilla (escribir manual)" }), filteredTemplates.map((tpl) => (_jsx("option", { value: tpl.key, children: tpl.label }, tpl.key)))] })] }), selectedTemplate && selectedTemplate.legalReferences.length > 1 && (_jsxs("div", { style: { color: "#64748b", marginTop: -6 }, children: ["Base normativa sugerida: ", selectedTemplate.legalReferences.map((ref) => legalReferenceLabels[ref]).join(" / ")] })), _jsxs("label", { children: ["Titulo", _jsx("input", { className: "input", value: createForm.title, onChange: (e) => setCreateForm((prev) => ({ ...prev, title: e.target.value })) })] }), _jsxs("label", { children: ["Mensaje", _jsx("textarea", { className: "input", rows: 4, value: createForm.body, onChange: (e) => setCreateForm((prev) => ({ ...prev, body: e.target.value })) })] }), _jsx("button", { className: "button", disabled: createBusy, children: createBusy ? "Enviando..." : "Crear y enviar" })] }), _jsx(DataTable, { columns: [
                    { key: "title", label: "Titulo" },
                    { key: "audience", label: "Destinatarios" },
                    { key: "target", label: "Individual" },
                    { key: "legalReference", label: "Base normativa" },
                    { key: "status", label: "Estado" },
                    { key: "date", label: "Fecha" },
                    { key: "actions", label: "Acciones" }
                ], rowStyle: (row) => row.__priority
                    ? { background: "#fef2f2", borderLeft: "4px solid #ef4444" }
                    : undefined, rows: prioritizedNotifications.map((n) => {
                    const dueProcess = isDueProcessNotification(n);
                    return {
                        __priority: dueProcess,
                        title: (_jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("span", { children: n.title }), dueProcess && (_jsx("span", { style: { padding: "2px 8px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 12 }, children: "Prioridad" }))] })),
                        audience: n.audience === "TEACHERS"
                            ? "Docentes"
                            : n.audience === "BOTH"
                                ? "Docentes y padres"
                                : n.audience === "ADMINS"
                                    ? "Administracion"
                                    : "Padres",
                        target: n.targetUser
                            ? `Docente: ${n.targetUser.fullName}`
                            : n.student
                                ? `Padres: ${n.student.fullName}`
                                : "Todos",
                        legalReference: legalReferenceLabels[String(n.legalReference || "")] || "-",
                        status: String(n.status || "").toUpperCase(),
                        date: n.createdAt.slice(0, 10),
                        actions: (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("button", { className: "button secondary", onClick: () => approve(n.id), children: "Aprobar" }), _jsx("button", { className: "button danger", onClick: () => reject(n.id), children: "Rechazar" })] }))
                    };
                }) }), editingId && (_jsxs("form", { className: "card", onSubmit: saveEdit, children: [_jsx("div", { className: "section-title", children: "Editar notificacion" }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.notifications.updateSuccess, message: editingMessage, onDismiss: () => setEditingMessage("") }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.notifications.updateError, message: editingError, onDismiss: () => setEditingError("") }), _jsxs("label", { children: ["Titulo", _jsx("input", { className: "input", value: editingForm.title, onChange: (e) => setEditingForm({ ...editingForm, title: e.target.value }) })] }), _jsxs("label", { children: ["Mensaje", _jsx("input", { className: "input", value: editingForm.body, onChange: (e) => setEditingForm({ ...editingForm, body: e.target.value }) })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 10 }, children: [_jsx("button", { className: "button", disabled: editingBusy, children: editingBusy ? "Guardando..." : "Guardar cambios" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => {
                                    setEditingId("");
                                    setEditingMessage("");
                                    setEditingError("");
                                }, children: "Cancelar" })] })] })), _jsx("div", { style: { display: "flex", gap: 8, marginTop: 8 }, children: _jsxs("select", { className: "input", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los estados" }), _jsx("option", { value: "PENDING", children: "Pendiente" }), _jsx("option", { value: "APPROVED", children: "Aprobado" }), _jsx("option", { value: "REJECTED", children: "Rechazado" }), _jsx("option", { value: "SENT", children: "Enviado" })] }) }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: page <= 1, onClick: () => setPage(page - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", page, " de ", Math.max(1, Math.ceil(total / 10))] }), _jsx("button", { className: "button secondary", disabled: page >= Math.ceil(total / 10), onClick: () => setPage(page + 1), children: "Siguiente" })] })] }));
}
