import React, { useEffect, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiGet } from "../services/api";

export default function ParentComunicados() {
  const [items, setItems] = useState<Array<any>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    apiGet(`/parent/notifications?page=${page}&pageSize=10${statusFilter ? `&status=${statusFilter}` : ""}`).then((res) => {
      setItems(res.data || []);
      setTotal(res.total || 0);
    }).catch(() => undefined);
  }, [page, statusFilter]);

  return (
    <Section title="Comunicados">
      <div className="help-card">
        Revisa los comunicados oficiales del colegio.
      </div>
      <DataTable
        columns={[
          { key: "title", label: "Titulo" },
          { key: "status", label: "Estado" },
          { key: "date", label: "Fecha" }
        ]}
        rows={items.map((i: any) => ({
          title: i.notification?.title || "",
          status: i.notification?.status || "SENT",
          date: i.notification?.createdAt?.slice(0, 10) || ""
        }))}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="APPROVED">Aprobado</option>
          <option value="REJECTED">Rechazado</option>
          <option value="SENT">Enviado</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <div style={{ alignSelf: "center", color: "#6b7280" }}>
          Pagina {page} de {Math.max(1, Math.ceil(total / 10))}
        </div>
        <button className="button secondary" disabled={page >= Math.ceil(total / 10)} onClick={() => setPage(page + 1)}>
          Siguiente
        </button>
      </div>
    </Section>
  );
}
