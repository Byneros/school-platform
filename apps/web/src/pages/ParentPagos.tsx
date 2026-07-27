import React, { useEffect, useState } from "react";

import DataTable from "../components/DataTable";
import Section from "../components/Section";
import { apiGet } from "../services/api";

export default function ParentPagos() {
  const [invoices, setInvoices] = useState<Array<any>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [studentId, setStudentId] = useState("");
  const [children, setChildren] = useState<Array<{ id: string; fullName: string }>>([]);

  useEffect(() => {
    apiGet("/parent/children")
      .then((res) => setChildren(res))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    apiGet(
      `/parent/invoices?page=${page}&pageSize=10${statusFilter ? `&status=${statusFilter}` : ""}${studentId ? `&studentId=${studentId}` : ""}`
    )
      .then((res) => {
        setInvoices(res.data || []);
        setTotal(res.total || 0);
      })
      .catch(() => undefined);
  }, [page, statusFilter, studentId]);

  return (
    <Section title="Pagos">
      <div className="help-card">Consulta facturas, pagos y vencimientos.</div>
      <DataTable
        columns={[
          { key: "invoice", label: "Factura" },
          { key: "amount", label: "Monto" },
          { key: "status", label: "Estado" },
          { key: "due", label: "Vence" },
        ]}
        rows={invoices.map((i: any) => ({
          invoice: i.id,
          amount: `$ ${i.amount}`,
          status: i.status,
          due: i.dueDate?.slice(0, 10) || "",
        }))}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Todos los estudiantes</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="PAID">Pagada</option>
          <option value="OVERDUE">Vencida</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <div style={{ alignSelf: "center", color: "#6b7280" }}>
          Pagina {page} de {Math.max(1, Math.ceil(total / 10))}
        </div>
        <button
          className="button secondary"
          disabled={page >= Math.ceil(total / 10)}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </Section>
  );
}
