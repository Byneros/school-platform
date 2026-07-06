import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import ActionFeedback from "../components/ActionFeedback";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import Autocomplete from "../components/Autocomplete";
import { apiDownload, apiGet, apiPatch, apiPost } from "../services/api";
import { gradeLabel } from "../services/grades";
import useSuggestions from "../hooks/useSuggestions";
import { feedbackTitles } from "../utils/feedback";
export default function AdminFinance() {
    const [invoices, setInvoices] = useState([]);
    const [payments, setPayments] = useState([]);
    const [invPage, setInvPage] = useState(1);
    const [invTotal, setInvTotal] = useState(0);
    const [payPage, setPayPage] = useState(1);
    const [payTotal, setPayTotal] = useState(0);
    const [invStatus, setInvStatus] = useState("");
    const [payStatus, setPayStatus] = useState("");
    const [invSearch, setInvSearch] = useState("");
    const [paySearch, setPaySearch] = useState("");
    const [invoiceForm, setInvoiceForm] = useState({ studentId: "", amount: "", dueDate: "" });
    const [students, setStudents] = useState([]);
    const [editingInvoiceId, setEditingInvoiceId] = useState("");
    const [editInvoiceBusy, setEditInvoiceBusy] = useState(false);
    const [editInvoiceError, setEditInvoiceError] = useState("");
    const [editInvoiceForm, setEditInvoiceForm] = useState({ amount: "", dueDate: "", status: "PENDING" });
    const invoiceSearchOptions = useSuggestions({
        endpoint: "/suggestions?type=invoices",
        query: invSearch
    });
    const paymentSearchOptions = useSuggestions({
        endpoint: "/suggestions?type=payments",
        query: paySearch
    });
    const load = () => {
        apiGet(`/invoices?page=${invPage}&pageSize=10${invStatus ? `&status=${invStatus}` : ""}${invSearch ? `&search=${encodeURIComponent(invSearch)}` : ""}`)
            .then((res) => {
            setInvoices(res.data || []);
            setInvTotal(res.total || 0);
        })
            .catch(() => undefined);
        apiGet(`/payments?page=${payPage}&pageSize=10${payStatus ? `&status=${payStatus}` : ""}${paySearch ? `&search=${encodeURIComponent(paySearch)}` : ""}`)
            .then((res) => {
            setPayments(res.data || []);
            setPayTotal(res.total || 0);
        })
            .catch(() => undefined);
    };
    useEffect(() => {
        load();
    }, [invPage, payPage, invStatus, payStatus, invSearch, paySearch]);
    useEffect(() => {
        apiGet("/students/simple").then((res) => setStudents(res)).catch(() => undefined);
    }, []);
    const createInvoice = async (e) => {
        e.preventDefault();
        if (!invoiceForm.studentId || !invoiceForm.amount || !invoiceForm.dueDate)
            return;
        const invoice = await apiPost("/invoices", {
            studentId: invoiceForm.studentId,
            amount: Number(invoiceForm.amount),
            dueDate: new Date(invoiceForm.dueDate).toISOString()
        });
        setInvoices([invoice, ...invoices]);
        setInvoiceForm({ studentId: "", amount: "", dueDate: "" });
    };
    const createPayment = async (invoiceId) => {
        await apiPost("/payments", {
            invoiceId,
            amount: 100,
            paidAt: new Date().toISOString(),
            method: "Efectivo"
        });
        load();
    };
    const startEditInvoice = (invoice) => {
        setEditInvoiceError("");
        setEditingInvoiceId(invoice.id);
        setEditInvoiceForm({
            amount: String(invoice.amount),
            dueDate: invoice.dueDate ? invoice.dueDate.slice(0, 10) : "",
            status: invoice.status
        });
    };
    const saveInvoice = async (e) => {
        e.preventDefault();
        if (!editingInvoiceId)
            return;
        setEditInvoiceBusy(true);
        setEditInvoiceError("");
        try {
            const updated = await apiPatch(`/invoices/${editingInvoiceId}`, {
                amount: Number(editInvoiceForm.amount),
                dueDate: new Date(editInvoiceForm.dueDate).toISOString(),
                status: editInvoiceForm.status
            });
            setInvoices((prev) => prev.map((i) => (i.id === editingInvoiceId ? { ...i, ...updated } : i)));
            setEditingInvoiceId("");
            load();
        }
        catch (error) {
            setEditInvoiceError(error?.message || "No se pudo actualizar la factura");
        }
        finally {
            setEditInvoiceBusy(false);
        }
    };
    const downloadExcel = async () => {
        const blob = await apiDownload("/reports/finance-excel");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "finance-report.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };
    const downloadPdf = async () => {
        const blob = await apiDownload("/reports/finance-pdf");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "finance-report.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };
    return (_jsxs(Section, { title: "Finanzas", children: [_jsx("div", { className: "help-card", children: "Facturacion, pagos y exportacion de reportes." }), _jsxs("div", { style: { display: "flex", gap: 8, marginBottom: 12 }, children: [_jsx("button", { className: "button secondary", onClick: downloadExcel, children: "Exportar Excel" }), _jsx("button", { className: "button secondary", onClick: downloadPdf, children: "Exportar PDF" })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginBottom: 8 }, children: [_jsx(Autocomplete, { className: "input input-search", placeholder: "Buscar factura por estudiante", value: invSearch, options: invoiceSearchOptions, onChange: (value) => {
                            setInvSearch(value);
                            setInvPage(1);
                        } }), _jsxs("select", { className: "input", value: invStatus, onChange: (e) => setInvStatus(e.target.value), children: [_jsx("option", { value: "", children: "Todas las facturas" }), _jsx("option", { value: "PENDING", children: "Pendiente" }), _jsx("option", { value: "PAID", children: "Pagada" }), _jsx("option", { value: "OVERDUE", children: "Vencida" })] }), _jsx(Autocomplete, { className: "input input-search", placeholder: "Buscar pagos por estudiante", value: paySearch, options: paymentSearchOptions, onChange: (value) => {
                            setPaySearch(value);
                            setPayPage(1);
                        } }), _jsxs("select", { className: "input", value: payStatus, onChange: (e) => setPayStatus(e.target.value), children: [_jsx("option", { value: "", children: "Todos los pagos" }), _jsx("option", { value: "PENDING", children: "Pendiente" }), _jsx("option", { value: "PAID", children: "Pagada" }), _jsx("option", { value: "OVERDUE", children: "Vencida" })] })] }), _jsxs("form", { className: "card", onSubmit: createInvoice, children: [_jsx("div", { className: "section-title", children: "Crear factura" }), _jsxs("label", { children: ["Estudiante", _jsx(Autocomplete, { value: invoiceForm.studentId, onChange: (v) => setInvoiceForm({ ...invoiceForm, studentId: v }), options: students.map((s) => ({
                                    value: s.id,
                                    label: `${s.fullName}${s.gradeLevel ? ` - ${gradeLabel(s.gradeLevel)}${s.studentGroup ? s.studentGroup : ""}` : ""}${s.latestYear ? ` (${s.latestYear})` : ""}`
                                })), placeholder: "Busca por nombre" })] }), _jsxs("label", { children: ["Monto", _jsx("input", { className: "input", value: invoiceForm.amount, onChange: (e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value }) })] }), _jsxs("label", { children: ["Fecha vencimiento", _jsx("input", { className: "input", type: "date", value: invoiceForm.dueDate, onChange: (e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value }) })] }), _jsx("button", { className: "button", style: { marginTop: 10 }, children: "Crear factura" })] }), _jsx("div", { className: "section-title", children: "Facturas" }), _jsx(DataTable, { columns: [
                    { key: "invoice", label: "Factura" },
                    { key: "student", label: "Estudiante" },
                    { key: "amount", label: "Monto" },
                    { key: "status", label: "Estado" }
                ], rows: invoices.map((i) => ({
                    invoice: i.id,
                    student: i.student?.fullName || "",
                    amount: `$ ${i.amount}`,
                    status: i.status
                })) }), editingInvoiceId && (_jsxs("form", { className: "card", onSubmit: saveInvoice, style: { marginTop: 10 }, children: [_jsx("div", { className: "section-title", children: "Editar factura" }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.finance.invoiceEditError, message: editInvoiceError, onDismiss: () => setEditInvoiceError(""), style: { marginBottom: 8 } }), _jsxs("label", { children: ["Monto", _jsx("input", { className: "input", value: editInvoiceForm.amount, onChange: (e) => setEditInvoiceForm({ ...editInvoiceForm, amount: e.target.value }) })] }), _jsxs("label", { children: ["Fecha vencimiento", _jsx("input", { className: "input", type: "date", value: editInvoiceForm.dueDate, onChange: (e) => setEditInvoiceForm({ ...editInvoiceForm, dueDate: e.target.value }) })] }), _jsxs("label", { children: ["Estado", _jsxs("select", { className: "input", value: editInvoiceForm.status, onChange: (e) => setEditInvoiceForm({ ...editInvoiceForm, status: e.target.value }), children: [_jsx("option", { value: "PENDING", children: "Pendiente" }), _jsx("option", { value: "PAID", children: "Pagada" }), _jsx("option", { value: "OVERDUE", children: "Vencida" })] })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 10 }, children: [_jsx("button", { className: "button", disabled: editInvoiceBusy, children: editInvoiceBusy ? "Guardando..." : "Guardar cambios" }), _jsx("button", { type: "button", className: "button secondary", onClick: () => setEditingInvoiceId(""), children: "Cancelar" })] })] })), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: invPage <= 1, onClick: () => setInvPage(invPage - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", invPage, " de ", Math.max(1, Math.ceil(invTotal / 10))] }), _jsx("button", { className: "button secondary", disabled: invPage >= Math.ceil(invTotal / 10), onClick: () => setInvPage(invPage + 1), children: "Siguiente" })] }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }, children: invoices.map((i) => (_jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }, children: [_jsx("div", { style: { color: "#6b7280" }, children: i.id }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }, children: [_jsxs("button", { className: "button secondary", onClick: () => createPayment(i.id), children: ["Registrar pago ", i.id] }), _jsxs("button", { className: "button secondary", onClick: () => startEditInvoice(i), children: ["Editar ", i.id] })] })] }, i.id))) }), _jsx("div", { className: "section-title", style: { marginTop: 12 }, children: "Pagos" }), _jsx(DataTable, { columns: [
                    { key: "invoice", label: "Factura" },
                    { key: "student", label: "Estudiante" },
                    { key: "amount", label: "Monto" },
                    { key: "date", label: "Fecha" }
                ], rows: payments.map((p) => ({
                    invoice: p.invoice?.id || "",
                    student: p.invoice?.student?.fullName || "",
                    amount: `$ ${p.amount}`,
                    date: p.paidAt?.slice(0, 10)
                })) }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: payPage <= 1, onClick: () => setPayPage(payPage - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", payPage, " de ", Math.max(1, Math.ceil(payTotal / 10))] }), _jsx("button", { className: "button secondary", disabled: payPage >= Math.ceil(payTotal / 10), onClick: () => setPayPage(payPage + 1), children: "Siguiente" })] })] }));
}
