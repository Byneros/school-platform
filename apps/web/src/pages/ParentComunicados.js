import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiGet } from "../services/api";
import { isDueProcessNotification } from "../utils/notificationPriority";
export default function ParentComunicados() {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState("");
    const prioritizedItems = useMemo(() => [...items].sort((a, b) => Number(isDueProcessNotification(b?.notification)) - Number(isDueProcessNotification(a?.notification))), [items]);
    useEffect(() => {
        apiGet(`/parent/notifications?page=${page}&pageSize=10${statusFilter ? `&status=${statusFilter}` : ""}`).then((res) => {
            setItems(res.data || []);
            setTotal(res.total || 0);
        }).catch(() => undefined);
    }, [page, statusFilter]);
    return (_jsxs(Section, { title: "Comunicados", children: [_jsx("div", { className: "help-card", children: "Revisa los comunicados oficiales del colegio." }), _jsx(DataTable, { columns: [
                    { key: "title", label: "Titulo" },
                    { key: "status", label: "Estado" },
                    { key: "date", label: "Fecha" }
                ], rowStyle: (row) => row.__priority
                    ? { background: "#fef2f2", borderLeft: "4px solid #ef4444" }
                    : undefined, rows: prioritizedItems.map((i) => {
                    const dueProcess = isDueProcessNotification(i.notification);
                    return {
                        __priority: dueProcess,
                        title: (_jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("span", { children: i.notification?.title || "" }), dueProcess && (_jsx("span", { style: { padding: "2px 8px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 12 }, children: "Prioridad" }))] })),
                        status: i.notification?.status || "SENT",
                        date: i.notification?.createdAt?.slice(0, 10) || ""
                    };
                }) }), _jsx("div", { style: { display: "flex", gap: 8, marginTop: 8 }, children: _jsxs("select", { className: "input", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los estados" }), _jsx("option", { value: "PENDING", children: "Pendiente" }), _jsx("option", { value: "APPROVED", children: "Aprobado" }), _jsx("option", { value: "REJECTED", children: "Rechazado" }), _jsx("option", { value: "SENT", children: "Enviado" })] }) }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: page <= 1, onClick: () => setPage(page - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", page, " de ", Math.max(1, Math.ceil(total / 10))] }), _jsx("button", { className: "button secondary", disabled: page >= Math.ceil(total / 10), onClick: () => setPage(page + 1), children: "Siguiente" })] })] }));
}
