import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiGet } from "../services/api";
export default function ParentPagos() {
    const [invoices, setInvoices] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState("");
    const [studentId, setStudentId] = useState("");
    const [children, setChildren] = useState([]);
    useEffect(() => {
        apiGet("/parent/children").then((res) => setChildren(res)).catch(() => undefined);
    }, []);
    useEffect(() => {
        apiGet(`/parent/invoices?page=${page}&pageSize=10${statusFilter ? `&status=${statusFilter}` : ""}${studentId ? `&studentId=${studentId}` : ""}`).then((res) => {
            setInvoices(res.data || []);
            setTotal(res.total || 0);
        }).catch(() => undefined);
    }, [page, statusFilter, studentId]);
    return (_jsxs(Section, { title: "Pagos", children: [_jsx("div", { className: "help-card", children: "Consulta facturas, pagos y vencimientos." }), _jsx(DataTable, { columns: [
                    { key: "invoice", label: "Factura" },
                    { key: "amount", label: "Monto" },
                    { key: "status", label: "Estado" },
                    { key: "due", label: "Vence" }
                ], rows: invoices.map((i) => ({
                    invoice: i.id,
                    amount: `$ ${i.amount}`,
                    status: i.status,
                    due: i.dueDate?.slice(0, 10) || ""
                })) }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 8 }, children: [_jsxs("select", { className: "input", value: studentId, onChange: (e) => setStudentId(e.target.value), children: [_jsx("option", { value: "", children: "Todos los estudiantes" }), children.map((c) => (_jsx("option", { value: c.id, children: c.fullName }, c.id)))] }), _jsxs("select", { className: "input", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los estados" }), _jsx("option", { value: "PENDING", children: "Pendiente" }), _jsx("option", { value: "PAID", children: "Pagada" }), _jsx("option", { value: "OVERDUE", children: "Vencida" })] })] }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: page <= 1, onClick: () => setPage(page - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", page, " de ", Math.max(1, Math.ceil(total / 10))] }), _jsx("button", { className: "button secondary", disabled: page >= Math.ceil(total / 10), onClick: () => setPage(page + 1), children: "Siguiente" })] })] }));
}
