import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActionFeedback from "../components/ActionFeedback";
import Section from "../components/Section";
import KpiCard from "../components/KpiCard";
import DataTable from "../components/DataTable";
import { apiDelete, apiDownload, apiGet, apiPatch, apiPost } from "../services/api";
import { gradeLabel } from "../services/grades";
import { isDueProcessNotification, prioritizeDueProcess } from "../utils/notificationPriority";
import { feedbackTitles, inferFeedbackTone } from "../utils/feedback";
export default function AdminAlerts() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [statusFilter, setStatusFilter] = useState("PENDING");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [pendingAdmissions, setPendingAdmissions] = useState([]);
    const [pendingNotifications, setPendingNotifications] = useState([]);
    const [pendingCertificates, setPendingCertificates] = useState([]);
    const [overdueInvoices, setOverdueInvoices] = useState([]);
    const [followUps, setFollowUps] = useState([]);
    const [pendingParents, setPendingParents] = useState([]);
    const load = () => {
        setLoading(true);
        setMessage("");
        const statusParam = statusFilter ? `&status=${statusFilter}` : "";
        Promise.all([
            apiGet(`/admissions?page=1&pageSize=80${statusParam}`),
            apiGet(`/notifications?page=1&pageSize=80${statusParam}`),
            apiGet(`/reports/certificate/requests?page=1&pageSize=80${statusParam}`),
            statusFilter === "PENDING" ? apiGet("/invoices?page=1&pageSize=200&status=PENDING") : Promise.resolve({ data: [] }),
            statusFilter === "PENDING" ? apiGet("/student-observations/follow-ups?days=7&status=PENDING") : Promise.resolve({ data: [] }),
            statusFilter === "PENDING" ? apiGet("/users/parents/pending-account") : Promise.resolve({ data: [] })
        ])
            .then(([admissionsRes, notificationsRes, certificateRes, invoicesRes, followRes, parentsRes]) => {
            const admissions = admissionsRes?.data || [];
            const notifications = notificationsRes?.data || [];
            const certificates = certificateRes?.data || [];
            const invoices = invoicesRes?.data || [];
            const follow = followRes?.data || [];
            const parents = parentsRes?.data || [];
            setPendingAdmissions(admissions);
            setPendingNotifications(notifications);
            setPendingCertificates(certificates);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const overdue = invoices.filter((inv) => {
                if (!inv?.dueDate)
                    return false;
                const due = new Date(inv.dueDate);
                return !Number.isNaN(due.getTime()) && due < today;
            });
            setOverdueInvoices(overdue.slice(0, 8));
            setFollowUps(follow);
            setPendingParents(parents);
        })
            .catch((err) => {
            setMessage(err?.message || "No se pudo cargar el centro de alertas.");
        })
            .finally(() => setLoading(false));
    };
    useEffect(() => {
        load();
    }, [statusFilter]);
    const withinDateRange = (dateValue) => {
        if (!fromDate && !toDate)
            return true;
        if (!dateValue)
            return false;
        const parsed = new Date(dateValue);
        if (Number.isNaN(parsed.getTime()))
            return false;
        const start = fromDate ? new Date(fromDate) : null;
        const end = toDate ? new Date(toDate) : null;
        if (start)
            start.setHours(0, 0, 0, 0);
        if (end)
            end.setHours(23, 59, 59, 999);
        if (start && parsed < start)
            return false;
        if (end && parsed > end)
            return false;
        return true;
    };
    const filteredAdmissions = useMemo(() => pendingAdmissions.filter((a) => withinDateRange(a.createdAt)), [pendingAdmissions, fromDate, toDate]);
    const filteredNotifications = useMemo(() => pendingNotifications.filter((n) => withinDateRange(n.createdAt)), [pendingNotifications, fromDate, toDate]);
    const prioritizedNotifications = useMemo(() => prioritizeDueProcess(filteredNotifications), [filteredNotifications]);
    const filteredCertificates = useMemo(() => pendingCertificates.filter((c) => withinDateRange(c.requestedAt)), [pendingCertificates, fromDate, toDate]);
    const filteredInvoices = useMemo(() => overdueInvoices.filter((i) => withinDateRange(i.dueDate)), [overdueInvoices, fromDate, toDate]);
    const filteredFollowUps = useMemo(() => followUps.filter((f) => withinDateRange(f.followUpDate)), [followUps, fromDate, toDate]);
    const shouldShowOperational = statusFilter === "PENDING";
    const visibleInvoices = shouldShowOperational ? filteredInvoices : [];
    const visibleFollowUps = shouldShowOperational ? filteredFollowUps : [];
    const visibleParents = shouldShowOperational ? pendingParents : [];
    const exportPdf = async () => {
        const query = new URLSearchParams({
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(fromDate ? { fromDate } : {}),
            ...(toDate ? { toDate } : {})
        }).toString();
        try {
            const blob = await apiDownload(`/reports/alerts/pdf${query ? `?${query}` : ""}`);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "centro-alertas.pdf";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }
        catch (err) {
            setMessage(err?.message || "No se pudo exportar el PDF.");
        }
    };
    const exportExcel = async () => {
        const query = new URLSearchParams({
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(fromDate ? { fromDate } : {}),
            ...(toDate ? { toDate } : {})
        }).toString();
        try {
            const blob = await apiDownload(`/reports/alerts/excel${query ? `?${query}` : ""}`);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "centro-alertas.xlsx";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }
        catch (err) {
            setMessage(err?.message || "No se pudo exportar el Excel.");
        }
    };
    const approveNotification = async (id) => {
        try {
            await apiPost(`/notifications/${id}/approve`, {});
            window.dispatchEvent(new Event("notifications-updated"));
            load();
        }
        catch (err) {
            setMessage(err?.message || "No se pudo aprobar la notificacion.");
        }
    };
    const rejectNotification = async (id) => {
        try {
            await apiPost(`/notifications/${id}/reject`, {});
            window.dispatchEvent(new Event("notifications-updated"));
            load();
        }
        catch (err) {
            setMessage(err?.message || "No se pudo rechazar la notificacion.");
        }
    };
    const approveCertificate = async (id) => {
        try {
            await apiPost(`/reports/certificate/requests/${id}/approve`, {});
            window.dispatchEvent(new Event("certificate-requests-updated"));
            load();
        }
        catch (err) {
            setMessage(err?.message || "No se pudo aprobar la solicitud.");
        }
    };
    const rejectCertificate = async (id) => {
        try {
            await apiPost(`/reports/certificate/requests/${id}/reject`, {});
            window.dispatchEvent(new Event("certificate-requests-updated"));
            load();
        }
        catch (err) {
            setMessage(err?.message || "No se pudo rechazar la solicitud.");
        }
    };
    const approveAdmission = async (id) => {
        try {
            await apiPatch(`/admissions/${id}/status`, { status: "APPROVED" });
            load();
        }
        catch (err) {
            setMessage(err?.message || "No se pudo aprobar la admision.");
        }
    };
    const rejectAdmission = async (id) => {
        try {
            await apiDelete(`/admissions/${id}`);
            load();
        }
        catch (err) {
            setMessage(err?.message || "No se pudo rechazar la admision.");
        }
    };
    const markFollowUpDone = async (id) => {
        try {
            await apiPatch(`/student-observations/${id}`, { followUpCompleted: true });
            load();
        }
        catch (err) {
            setMessage(err?.message || "No se pudo actualizar el seguimiento.");
        }
    };
    const summaryCards = useMemo(() => [
        {
            title: "Admisiones pendientes",
            value: String(filteredAdmissions.length),
            trend: "Por revisar",
            tone: "warning",
            onClick: () => navigate("/admin/admisiones")
        },
        {
            title: "Certificados pendientes",
            value: String(filteredCertificates.length),
            trend: "Solicitudes",
            tone: "warning",
            onClick: () => navigate("/admin/certificados")
        },
        {
            title: "Notificaciones pendientes",
            value: String(filteredNotifications.length),
            trend: "Por aprobar",
            tone: "danger",
            onClick: () => navigate("/admin/notificaciones")
        },
        {
            title: "Facturas vencidas",
            value: String(visibleInvoices.length),
            trend: "Pendientes de pago",
            tone: "danger",
            onClick: () => navigate("/admin/finanzas")
        },
        {
            title: "Seguimientos pendientes",
            value: String(visibleFollowUps.length),
            trend: "Proximos 7 dias",
            tone: "warning",
            onClick: () => navigate("/admin/observador")
        },
        {
            title: "Acudientes sin cuenta",
            value: String(visibleParents.length),
            trend: "Por crear usuario",
            tone: "primary",
            onClick: () => navigate("/admin/usuarios")
        }
    ], [
        filteredAdmissions.length,
        filteredCertificates.length,
        filteredNotifications.length,
        visibleInvoices.length,
        visibleFollowUps.length,
        visibleParents.length,
        navigate
    ]);
    return (_jsxs("div", { className: "grid", style: { gap: 20 }, children: [_jsxs(Section, { title: "Centro de alertas", children: [_jsx("div", { className: "help-card", children: "Consolidado de pendientes criticos y recordatorios operativos para el equipo administrativo." }), _jsxs("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }, children: [_jsxs("select", { className: "input", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "PENDING", children: "Estado: Pendiente" }), _jsx("option", { value: "APPROVED", children: "Estado: Aprobado" }), _jsx("option", { value: "REJECTED", children: "Estado: Rechazado" })] }), _jsx("input", { type: "date", className: "input", value: fromDate, onChange: (e) => setFromDate(e.target.value) }), _jsx("input", { type: "date", className: "input", value: toDate, onChange: (e) => setToDate(e.target.value) }), _jsx("button", { className: "button secondary", type: "button", onClick: exportPdf, children: "Exportar PDF" }), _jsx("button", { className: "button secondary", type: "button", onClick: exportExcel, children: "Exportar Excel" }), _jsx("button", { className: "button", type: "button", onClick: () => {
                                    setStatusFilter("PENDING");
                                    setFromDate("");
                                    setToDate("");
                                }, children: "Limpiar filtros" })] }), _jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", type: "button", onClick: load, disabled: loading, children: loading ? "Actualizando..." : "Actualizar alertas" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => navigate("/admin/notificaciones"), children: "Ir a Notificaciones" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => navigate("/admin/certificados"), children: "Ir a Certificados" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => navigate("/admin/admisiones"), children: "Ir a Admisiones" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => navigate("/admin/finanzas"), children: "Ir a Finanzas" })] }), _jsx(ActionFeedback, { tone: inferFeedbackTone(message), title: feedbackTitles.alerts.center, message: message, onDismiss: () => setMessage(""), style: { marginTop: 10 } })] }), _jsx("div", { className: "grid grid-4", children: summaryCards.map((card) => (_jsx(KpiCard, { ...card }, card.title))) }), _jsxs(Section, { title: "Solicitudes pendientes", children: [_jsx("div", { className: "help-card", children: "Prioriza estas solicitudes hoy para mantener la operacion al dia." }), _jsx(DataTable, { columns: [
                            { key: "kind", label: "Tipo" },
                            { key: "student", label: "Estudiante" },
                            { key: "requestedBy", label: "Solicitante" },
                            { key: "date", label: "Fecha" },
                            { key: "actions", label: "Acciones" }
                        ], rows: filteredCertificates.length === 0
                            ? [{ kind: "Sin solicitudes pendientes", student: "", requestedBy: "", date: "", actions: "" }]
                            : filteredCertificates.map((r) => ({
                                kind: r.type === "STUDY" ? "Constancia" : "Matricula",
                                student: r.student?.fullName || "-",
                                requestedBy: r.requestedBy?.fullName || "-",
                                date: String(r.requestedAt || "").slice(0, 10),
                                actions: (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("button", { className: "button secondary", type: "button", onClick: () => approveCertificate(r.id), children: "Aprobar" }), _jsx("button", { className: "button danger", type: "button", onClick: () => rejectCertificate(r.id), children: "Rechazar" })] }))
                            })) })] }), _jsx(Section, { title: "Notificaciones pendientes", children: _jsx(DataTable, { columns: [
                        { key: "title", label: "Titulo" },
                        { key: "audience", label: "Audiencia" },
                        { key: "date", label: "Fecha" },
                        { key: "actions", label: "Acciones" }
                    ], rowStyle: (row) => row.__priority
                        ? { background: "#fef2f2", borderLeft: "4px solid #ef4444" }
                        : undefined, rows: prioritizedNotifications.length === 0
                        ? [{ title: "Sin notificaciones pendientes", audience: "", date: "", actions: "" }]
                        : prioritizedNotifications.map((n) => {
                            const dueProcess = isDueProcessNotification(n);
                            return {
                                __priority: dueProcess,
                                title: (_jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("span", { children: n.title || "-" }), dueProcess && (_jsx("span", { style: { padding: "2px 8px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 12 }, children: "Prioridad" }))] })),
                                audience: n.audience || "-",
                                date: String(n.createdAt || "").slice(0, 10),
                                actions: (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("button", { className: "button secondary", type: "button", onClick: () => approveNotification(n.id), children: "Aprobar" }), _jsx("button", { className: "button danger", type: "button", onClick: () => rejectNotification(n.id), children: "Rechazar" })] }))
                            };
                        }) }) }), _jsx(Section, { title: "Admisiones pendientes", children: _jsx(DataTable, { columns: [
                        { key: "student", label: "Estudiante" },
                        { key: "grade", label: "Grado" },
                        { key: "date", label: "Solicitud" },
                        { key: "due", label: "Vence" },
                        { key: "actions", label: "Acciones" }
                    ], rows: filteredAdmissions.length === 0
                        ? [{ student: "Sin admisiones pendientes", grade: "", date: "", due: "", actions: "" }]
                        : filteredAdmissions.map((a) => ({
                            student: a.studentName,
                            grade: gradeLabel(a.gradeLevel),
                            date: String(a.createdAt || "").slice(0, 10),
                            due: a.enrollmentDueAt ? String(a.enrollmentDueAt).slice(0, 10) : "-",
                            actions: (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("button", { className: "button secondary", type: "button", onClick: () => approveAdmission(a.id), children: "Aprobar" }), _jsx("button", { className: "button danger", type: "button", onClick: () => rejectAdmission(a.id), children: "Rechazar" })] }))
                        })) }) }), _jsxs(Section, { title: "Recordatorios y vencimientos", children: [_jsx("div", { className: "help-card", children: "Seguimientos por vencer y facturas fuera de plazo." }), _jsxs("div", { className: "grid", style: { gap: 16 }, children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: "Seguimientos pendientes (7 dias)" }), _jsx(DataTable, { columns: [
                                            { key: "date", label: "Fecha" },
                                            { key: "student", label: "Estudiante" },
                                            { key: "grade", label: "Grado" },
                                            { key: "type", label: "Tipo" },
                                            { key: "detail", label: "Detalle" },
                                            { key: "actions", label: "Acciones" }
                                        ], rows: visibleFollowUps.length === 0
                                            ? [{ date: "Sin seguimientos pendientes", student: "", grade: "", type: "", detail: "", actions: "" }]
                                            : visibleFollowUps.map((f) => ({
                                                date: f.followUpDate ? String(f.followUpDate).slice(0, 10) : "-",
                                                student: f.student?.fullName || "-",
                                                grade: f.student?.gradeLevel ? gradeLabel(f.student.gradeLevel) : "-",
                                                type: f.type || "-",
                                                detail: f.detail || "-",
                                                actions: (_jsx("button", { className: "button secondary", type: "button", onClick: () => markFollowUpDone(f.id), children: "Marcar hecho" }))
                                            })) })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: "Facturas vencidas" }), _jsx(DataTable, { columns: [
                                            { key: "due", label: "Vence" },
                                            { key: "student", label: "Estudiante" },
                                            { key: "amount", label: "Monto" },
                                            { key: "status", label: "Estado" },
                                            { key: "actions", label: "Acciones" }
                                        ], rows: visibleInvoices.length === 0
                                            ? [{ due: "Sin facturas vencidas", student: "", amount: "", status: "", actions: "" }]
                                            : visibleInvoices.map((inv) => ({
                                                due: inv.dueDate ? String(inv.dueDate).slice(0, 10) : "-",
                                                student: inv.student?.fullName || "-",
                                                amount: `$ ${inv.amount}`,
                                                status: inv.status,
                                                actions: (_jsx("button", { className: "button secondary", type: "button", onClick: () => navigate("/admin/finanzas"), children: "Ver finanzas" }))
                                            })) })] })] })] }), _jsxs(Section, { title: "Acudientes sin cuenta", children: [_jsx("div", { className: "help-card", children: "Crea usuarios para estos acudientes y vincula credenciales." }), _jsx(DataTable, { columns: [
                            { key: "guardian", label: "Acudiente" },
                            { key: "email", label: "Correo" },
                            { key: "relation", label: "Parentesco" },
                            { key: "students", label: "Estudiantes" },
                            { key: "actions", label: "Acciones" }
                        ], rows: visibleParents.length === 0
                            ? [{ guardian: "Sin acudientes pendientes", email: "", relation: "", students: "", actions: "" }]
                            : visibleParents.map((p) => ({
                                guardian: p.guardianFullName,
                                email: p.contactEmail || "-",
                                relation: p.relation || "-",
                                students: p.studentsCount ? `${p.studentsCount} estudiante(s)` : "-",
                                actions: (_jsx("button", { className: "button secondary", type: "button", onClick: () => navigate("/admin/usuarios"), children: "Crear usuario" })),
                            })) })] })] }));
}
