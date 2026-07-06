import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import KpiCard from "../components/KpiCard";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiDownload, apiGet } from "../services/api";
import { gradeLabel } from "../services/grades";
import { isDueProcessNotification } from "../utils/notificationPriority";
export default function ParentDashboard() {
    const [grades, setGrades] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const prioritizedNotifications = useMemo(() => [...notifications].sort((a, b) => Number(isDueProcessNotification(b?.notification)) - Number(isDueProcessNotification(a?.notification))), [notifications]);
    useEffect(() => {
        apiGet("/parent/boletines?page=1&pageSize=5")
            .then((res) => setGrades(res.data || []))
            .catch(() => setGrades([]));
        apiGet("/parent/invoices?page=1&pageSize=4")
            .then((res) => setInvoices(res.data || []))
            .catch(() => setInvoices([]));
        apiGet("/parent/notifications?page=1&pageSize=5")
            .then((res) => setNotifications(res.data || []))
            .catch(() => setNotifications([]));
    }, []);
    const downloadReportCard = async () => {
        const blob = await apiDownload("/reports/report-card/student-1");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "boletin-student-1.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };
    return (_jsxs("div", { className: "grid", style: { gap: 24 }, children: [_jsx("div", { className: "card", children: _jsxs("div", { className: "section-head", children: [_jsxs("div", { children: [_jsx("div", { className: "section-title", children: "Panel de Padres" }), _jsx("div", { style: { color: "#6b7280" }, children: "Consulta boletines, asistencia y pagos sin complicaciones." })] }), _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("button", { className: "button secondary", onClick: downloadReportCard, children: "Descargar boletin" }), _jsx("button", { className: "button", children: "Ver historial" })] })] }) }), _jsxs("div", { className: "grid grid-4", children: [_jsx(KpiCard, { title: "Promedio general", value: "17.2", trend: "Periodo 1", tone: "success" }), _jsx(KpiCard, { title: "Asistencia", value: "95%", trend: "Ultimos 30 dias", tone: "primary" }), _jsx(KpiCard, { title: "Facturas", value: "$ 260", trend: "1 pendiente", tone: "warning" }), _jsx(KpiCard, { title: "Avisos", value: "3", trend: "Nuevos", tone: "danger" })] }), _jsxs("div", { className: "grid grid-2", children: [_jsxs(Section, { title: "Boletin y notas", action: _jsx("button", { className: "button secondary", onClick: downloadReportCard, children: "Descargar" }), children: [_jsx("div", { className: "help-card", children: "Puedes descargar el boletin en PDF y guardarlo para tus registros." }), _jsx(DataTable, { enableSearch: true, pageSize: 5, suggestionsEndpoint: "/suggestions?type=parent-grades", columns: [
                                    { key: "grade", label: "Grado" },
                                    { key: "group", label: "Grupo" },
                                    { key: "period", label: "Periodo" },
                                    { key: "subject", label: "Asignatura" },
                                    { key: "score", label: "Nota definitiva" }
                                ], rows: grades.map((g) => ({
                                    grade: gradeLabel(g.grade || ""),
                                    group: g.group || "Sin grupo",
                                    period: g.period,
                                    subject: g.subject,
                                    score: `${Number(g.finalScore || 0).toFixed(2)}/${g.maxScore ?? 0}`
                                })).sort((a, b) => {
                                    const gradeA = String(a.grade || "");
                                    const gradeB = String(b.grade || "");
                                    if (gradeA !== gradeB)
                                        return gradeA.localeCompare(gradeB, "es");
                                    const groupA = String(a.group || "");
                                    const groupB = String(b.group || "");
                                    if (groupA !== groupB)
                                        return groupA.localeCompare(groupB, "es");
                                    const periodA = String(a.period || "");
                                    const periodB = String(b.period || "");
                                    if (periodA !== periodB)
                                        return periodA.localeCompare(periodB, "es");
                                    const subjectA = String(a.subject || "");
                                    const subjectB = String(b.subject || "");
                                    if (subjectA !== subjectB)
                                        return subjectA.localeCompare(subjectB, "es");
                                    return String(a.score || "").localeCompare(String(b.score || ""), "es");
                                }) })] }), _jsx(Section, { title: "Estado financiero", action: _jsx("button", { className: "button", children: "Ver detalle" }), children: _jsx(DataTable, { enableSearch: true, pageSize: 4, suggestionsEndpoint: "/suggestions?type=parent-invoices", columns: [
                                { key: "invoice", label: "Factura" },
                                { key: "amount", label: "Monto" },
                                { key: "status", label: "Estado" }
                            ], rows: invoices.map((i) => ({
                                invoice: i.id,
                                amount: `$ ${i.amount}`,
                                status: i.status
                            })) }) })] }), _jsx(Section, { title: "Comunicados autorizados", action: _jsx("button", { className: "button", children: "Ver historial" }), children: _jsx(DataTable, { enableSearch: true, pageSize: 5, suggestionsEndpoint: "/suggestions?type=parent-notifications", columns: [
                        { key: "title", label: "Titulo" },
                        { key: "date", label: "Fecha" },
                        { key: "status", label: "Estado" }
                    ], rowStyle: (row) => row.__priority
                        ? { background: "#fef2f2", borderLeft: "4px solid #ef4444" }
                        : undefined, rows: prioritizedNotifications.map((n) => {
                        const dueProcess = isDueProcessNotification(n.notification);
                        return {
                            __priority: dueProcess,
                            title: (_jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("span", { children: n.notification?.title || "" }), dueProcess && (_jsx("span", { style: { padding: "2px 8px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 12 }, children: "Prioridad" }))] })),
                            date: n.notification?.createdAt?.slice(0, 10) || "",
                            status: n.notification?.status || "SENT"
                        };
                    }) }) })] }));
}
