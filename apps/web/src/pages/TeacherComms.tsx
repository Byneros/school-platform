import React, { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiGet, apiPost } from "../services/api";
import { isDueProcessNotification, prioritizeDueProcess } from "../utils/notificationPriority";

const convivenciaTemplates = [
  {
    key: "debido_proceso",
    label: "Debido proceso disciplinario",
    title: "Activacion de debido proceso escolar",
    body:
      "Se informa la activacion del debido proceso, garantizando el derecho de defensa, contradiccion y acompanamiento familiar, conforme a la Ley 1620 de 2013 y Decreto 1965 de 2013."
  },
  {
    key: "comite_convivencia",
    label: "Comite escolar de convivencia",
    title: "Citacion a Comite Escolar de Convivencia",
    body:
      "Se cita a acudientes para seguimiento de convivencia escolar segun ruta institucional y lineamientos del Sistema Nacional de Convivencia Escolar."
  },
  {
    key: "corresponsabilidad_familia",
    label: "Corresponsabilidad familia-escuela",
    title: "Compromiso de corresponsabilidad familia-escuela",
    body:
      "Se solicita acompanamiento familiar para fortalecer compromisos academicos y de convivencia, en armonia con Ley 115 de 1994 y Ley 1098 de 2006."
  }
] as const;

const legalReferenceLabels: Record<string, string> = {
  LEY_1620_2013: "Ley 1620 de 2013",
  DECRETO_1965_2013: "Decreto 1965 de 2013",
  LEY_115_1994: "Ley 115 de 1994",
  LEY_1098_2006: "Ley 1098 de 2006"
};

export default function TeacherComms() {
  const [students, setStudents] = useState<Array<{ id: string; fullName: string }>>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; status: string; legalReference?: string; createdAt: string }>>([]);
  const [adminNotifications, setAdminNotifications] = useState<Array<{ id: string; title: string; body: string; status: string; createdAt: string }>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [adminPage, setAdminPage] = useState(1);
  const [adminTotal, setAdminTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ studentId: "", legalReference: "LEY_1620_2013", templateKey: "", title: "", body: "" });
  const prioritizedNotifications = useMemo(
    () => prioritizeDueProcess(notifications),
    [notifications]
  );
  const prioritizedAdminNotifications = useMemo(
    () => prioritizeDueProcess(adminNotifications),
    [adminNotifications]
  );

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

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.body) return;
    await apiPost("/notifications", {
      title: form.title,
      body: form.body,
      studentId: form.studentId || undefined,
      legalReference: form.legalReference || undefined
    });
    setForm({ studentId: "", legalReference: "LEY_1620_2013", templateKey: "", title: "", body: "" });
    load();
  };

  const applyTemplate = (templateKey: string) => {
    const tpl = convivenciaTemplates.find((t) => t.key === templateKey);
    if (!tpl) return;
    setForm((prev) => ({ ...prev, templateKey, title: tpl.title, body: tpl.body }));
  };

  return (
    <Section title="Comunicaciones">
      <div className="help-card">
        El docente crea notificaciones para padres de familia. Requiere aprobacion del administrador antes del envio.
      </div>
      <form className="card" onSubmit={create}>
        <div className="section-title">Nueva notificacion</div>
        <label>
          Estudiante (opcional)
          <select className="input" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
            <option value="">Todos</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
        </label>
        <label>
          Base normativa
          <select className="input" value={form.legalReference} onChange={(e) => setForm({ ...form, legalReference: e.target.value })}>
            <option value="LEY_1620_2013">Ley 1620 de 2013</option>
            <option value="DECRETO_1965_2013">Decreto 1965 de 2013</option>
            <option value="LEY_115_1994">Ley 115 de 1994</option>
            <option value="LEY_1098_2006">Ley 1098 de 2006</option>
          </select>
        </label>
        <label>
          Plantilla Manual de convivencia
          <select className="input" value={form.templateKey} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">Sin plantilla</option>
            {convivenciaTemplates.map((tpl) => (
              <option key={tpl.key} value={tpl.key}>{tpl.label}</option>
            ))}
          </select>
        </label>
        <label>
          Titulo
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label>
          Mensaje
          <textarea className="input" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </label>
        <button className="button" style={{ marginTop: 10 }}>Enviar</button>
      </form>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="APPROVED">Aprobado</option>
          <option value="REJECTED">Rechazado</option>
          <option value="SENT">Enviado</option>
        </select>
      </div>
      <DataTable
        columns={[
          { key: "title", label: "Titulo" },
          { key: "legalReference", label: "Base normativa" },
          { key: "status", label: "Estado" },
          { key: "date", label: "Fecha" }
        ]}
        rowStyle={(row) =>
          (row as any).__priority
            ? { background: "#fef2f2", borderLeft: "4px solid #ef4444" }
            : undefined
        }
        rows={prioritizedNotifications.map((n) => {
          const dueProcess = isDueProcessNotification(n);
          return {
            __priority: dueProcess,
            title: (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>{n.title}</span>
                {dueProcess && (
                  <span style={{ padding: "2px 8px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 12 }}>
                    Prioridad
                  </span>
                )}
              </div>
            ),
          legalReference: legalReferenceLabels[String(n.legalReference || "")] || "-",
          status: n.status,
          date: n.createdAt.slice(0, 10)
          };
        })}
      />
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
      <div className="card" style={{ marginTop: 12 }}>
        <div className="section-title">Comunicados institucionales para docentes</div>
        <DataTable
          columns={[
            { key: "title", label: "Titulo" },
            { key: "body", label: "Mensaje" },
            { key: "status", label: "Estado" },
            { key: "date", label: "Fecha" }
          ]}
          rowStyle={(row) =>
            (row as any).__priority
              ? { background: "#fef2f2", borderLeft: "4px solid #ef4444" }
              : undefined
          }
          rows={prioritizedAdminNotifications.map((n) => {
            const dueProcess = isDueProcessNotification(n);
            return {
              __priority: dueProcess,
              title: (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span>{n.title}</span>
                  {dueProcess && (
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 12 }}>
                      Prioridad
                    </span>
                  )}
                </div>
              ),
            body: n.body || "",
            status: n.status,
            date: n.createdAt.slice(0, 10)
            };
          })}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          <button className="button secondary" disabled={adminPage <= 1} onClick={() => setAdminPage(adminPage - 1)}>
            Anterior
          </button>
          <div style={{ alignSelf: "center", color: "#6b7280" }}>
            Pagina {adminPage} de {Math.max(1, Math.ceil(adminTotal / 10))}
          </div>
          <button className="button secondary" disabled={adminPage >= Math.ceil(adminTotal / 10)} onClick={() => setAdminPage(adminPage + 1)}>
            Siguiente
          </button>
        </div>
      </div>
    </Section>
  );
}
