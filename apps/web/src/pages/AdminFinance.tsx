import React, { useEffect, useState } from "react";
import ActionFeedback from "../components/ActionFeedback";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import Autocomplete from "../components/Autocomplete";
import { apiDownload, apiGet, apiPatch, apiPost } from "../services/api";
import { gradeLabel } from "../services/grades";
import useSuggestions from "../hooks/useSuggestions";
import { feedbackTitles } from "../utils/feedback";

export default function AdminFinance() {
  const [invoices, setInvoices] = useState<Array<{ id: string; amount: number; status: string; dueDate: string; student: { fullName: string } }>>([]);
  const [payments, setPayments] = useState<Array<{ id: string; amount: number; paidAt: string; invoice: { id: string; student: { fullName: string } } }>>([]);
  const [invPage, setInvPage] = useState(1);
  const [invTotal, setInvTotal] = useState(0);
  const [payPage, setPayPage] = useState(1);
  const [payTotal, setPayTotal] = useState(0);
  const [invStatus, setInvStatus] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [invSearch, setInvSearch] = useState("");
  const [paySearch, setPaySearch] = useState("");
  const [invoiceForm, setInvoiceForm] = useState({ studentId: "", amount: "", dueDate: "" });
  const [students, setStudents] = useState<Array<{ id: string; fullName: string; gradeLevel?: string; studentGroup?: string | null; latestYear?: number | null }>>([]);
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

  const createInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.studentId || !invoiceForm.amount || !invoiceForm.dueDate) return;
    const invoice = await apiPost("/invoices", {
      studentId: invoiceForm.studentId,
      amount: Number(invoiceForm.amount),
      dueDate: new Date(invoiceForm.dueDate).toISOString()
    });
    setInvoices([invoice, ...invoices]);
    setInvoiceForm({ studentId: "", amount: "", dueDate: "" });
  };

  const createPayment = async (invoiceId: string) => {
    await apiPost("/payments", {
      invoiceId,
      amount: 100,
      paidAt: new Date().toISOString(),
      method: "Efectivo"
    });
    load();
  };

  const startEditInvoice = (invoice: { id: string; amount: number; dueDate: string; status: string }) => {
    setEditInvoiceError("");
    setEditingInvoiceId(invoice.id);
    setEditInvoiceForm({
      amount: String(invoice.amount),
      dueDate: invoice.dueDate ? invoice.dueDate.slice(0, 10) : "",
      status: invoice.status
    });
  };

  const saveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoiceId) return;
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
    } catch (error: any) {
      setEditInvoiceError(error?.message || "No se pudo actualizar la factura");
    } finally {
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

  return (
    <Section title="Finanzas">
      <div className="help-card">
        Facturacion, pagos y exportacion de reportes.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="button secondary" onClick={downloadExcel}>Exportar Excel</button>
        <button className="button secondary" onClick={downloadPdf}>Exportar PDF</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Autocomplete
          className="input input-search"
          placeholder="Buscar factura por estudiante"
          value={invSearch}
          options={invoiceSearchOptions}
          onChange={(value) => {
            setInvSearch(value);
            setInvPage(1);
          }}
        />
        <select className="input" value={invStatus} onChange={(e) => setInvStatus(e.target.value)}>
          <option value="">Todas las facturas</option>
          <option value="PENDING">Pendiente</option>
          <option value="PAID">Pagada</option>
          <option value="OVERDUE">Vencida</option>
        </select>
        <Autocomplete
          className="input input-search"
          placeholder="Buscar pagos por estudiante"
          value={paySearch}
          options={paymentSearchOptions}
          onChange={(value) => {
            setPaySearch(value);
            setPayPage(1);
          }}
        />
        <select className="input" value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
          <option value="">Todos los pagos</option>
          <option value="PENDING">Pendiente</option>
          <option value="PAID">Pagada</option>
          <option value="OVERDUE">Vencida</option>
        </select>
      </div>
      <form className="card" onSubmit={createInvoice}>
        <div className="section-title">Crear factura</div>
        <label>
          Estudiante
          <Autocomplete
            value={invoiceForm.studentId}
            onChange={(v) => setInvoiceForm({ ...invoiceForm, studentId: v })}
            options={students.map((s) => ({
              value: s.id,
              label: `${s.fullName}${s.gradeLevel ? ` - ${gradeLabel(s.gradeLevel)}${s.studentGroup ? s.studentGroup : ""}` : ""}${s.latestYear ? ` (${s.latestYear})` : ""}`
            }))}
            placeholder="Busca por nombre"
          />
        </label>
        <label>
          Monto
          <input className="input" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
        </label>
        <label>
          Fecha vencimiento
          <input className="input" type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} />
        </label>
        <button className="button" style={{ marginTop: 10 }}>Crear factura</button>
      </form>
      <div className="section-title">Facturas</div>
      <DataTable
        columns={[
          { key: "invoice", label: "Factura" },
          { key: "student", label: "Estudiante" },
          { key: "amount", label: "Monto" },
          { key: "status", label: "Estado" }
        ]}
        rows={invoices.map((i) => ({
          invoice: i.id,
          student: i.student?.fullName || "",
          amount: `$ ${i.amount}`,
          status: i.status
        }))}
      />
      {editingInvoiceId && (
        <form className="card" onSubmit={saveInvoice} style={{ marginTop: 10 }}>
          <div className="section-title">Editar factura</div>
          <ActionFeedback
            tone="error"
            title={feedbackTitles.finance.invoiceEditError}
            message={editInvoiceError}
            onDismiss={() => setEditInvoiceError("")}
            style={{ marginBottom: 8 }}
          />
          <label>
            Monto
            <input className="input" value={editInvoiceForm.amount} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, amount: e.target.value })} />
          </label>
          <label>
            Fecha vencimiento
            <input className="input" type="date" value={editInvoiceForm.dueDate} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, dueDate: e.target.value })} />
          </label>
          <label>
            Estado
            <select className="input" value={editInvoiceForm.status} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, status: e.target.value })}>
              <option value="PENDING">Pendiente</option>
              <option value="PAID">Pagada</option>
              <option value="OVERDUE">Vencida</option>
            </select>
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="button" disabled={editInvoiceBusy}>{editInvoiceBusy ? "Guardando..." : "Guardar cambios"}</button>
            <button type="button" className="button secondary" onClick={() => setEditingInvoiceId("")}>Cancelar</button>
          </div>
        </form>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button className="button secondary" disabled={invPage <= 1} onClick={() => setInvPage(invPage - 1)}>
          Anterior
        </button>
        <div style={{ alignSelf: "center", color: "#6b7280" }}>
          Pagina {invPage} de {Math.max(1, Math.ceil(invTotal / 10))}
        </div>
        <button className="button secondary" disabled={invPage >= Math.ceil(invTotal / 10)} onClick={() => setInvPage(invPage + 1)}>
          Siguiente
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {invoices.map((i) => (
          <div key={i.id} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ color: "#6b7280" }}>{i.id}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
            <button className="button secondary" onClick={() => createPayment(i.id)}>
              Registrar pago {i.id}
            </button>
            <button className="button secondary" onClick={() => startEditInvoice(i)}>
              Editar {i.id}
            </button>
            </div>
          </div>
        ))}
      </div>
      <div className="section-title" style={{ marginTop: 12 }}>Pagos</div>
      <DataTable
        columns={[
          { key: "invoice", label: "Factura" },
          { key: "student", label: "Estudiante" },
          { key: "amount", label: "Monto" },
          { key: "date", label: "Fecha" }
        ]}
        rows={payments.map((p) => ({
          invoice: p.invoice?.id || "",
          student: p.invoice?.student?.fullName || "",
          amount: `$ ${p.amount}`,
          date: p.paidAt?.slice(0, 10)
        }))}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button className="button secondary" disabled={payPage <= 1} onClick={() => setPayPage(payPage - 1)}>
          Anterior
        </button>
        <div style={{ alignSelf: "center", color: "#6b7280" }}>
          Pagina {payPage} de {Math.max(1, Math.ceil(payTotal / 10))}
        </div>
        <button className="button secondary" disabled={payPage >= Math.ceil(payTotal / 10)} onClick={() => setPayPage(payPage + 1)}>
          Siguiente
        </button>
      </div>
    </Section>
  );
}
