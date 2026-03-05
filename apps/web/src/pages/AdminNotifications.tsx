import React, { useEffect, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiGet, apiPatch, apiPost } from "../services/api";

const convivenciaTemplates = [
  {
    key: "debido_proceso",
    label: "Debido proceso disciplinario",
    title: "Activacion de debido proceso escolar",
    body:
      "Se informa la activacion del debido proceso, garantizando el derecho de defensa, contradiccion y acompanamiento familiar, conforme a la Ley 1620 de 2013 y Decreto 1965 de 2013. Favor presentarse en coordinacion para ruta de atencion."
  },
  {
    key: "promocion_derechos",
    label: "Promocion de derechos y convivencia",
    title: "Jornada de promocion de derechos y convivencia",
    body:
      "Se convoca a jornada institucional de convivencia, participacion y prevencion de violencia escolar, conforme al Sistema Nacional de Convivencia Escolar (Ley 1620 de 2013)."
  },
  {
    key: "comite_convivencia",
    label: "Comite escolar de convivencia",
    title: "Citacion a Comite Escolar de Convivencia",
    body:
      "Se cita al Comite Escolar de Convivencia para analisis y seguimiento del caso reportado, segun Decreto 1965 de 2013. Se solicita presencia puntual y soportes del caso."
  },
  {
    key: "ruta_atencion",
    label: "Ruta de atencion integral",
    title: "Activacion de ruta de atencion integral",
    body:
      "Se informa activacion de la Ruta de Atencion Integral para la Convivencia Escolar ante presunta situacion tipo II/III. Se adelantara acompanamiento institucional y articulacion con entidades competentes."
  },
  {
    key: "corresponsabilidad_familia",
    label: "Corresponsabilidad familia-escuela",
    title: "Compromiso de corresponsabilidad familia-escuela",
    body:
      "Se solicita acompanamiento familiar para fortalecimiento del proceso formativo, convivencia y cumplimiento de acuerdos pedagogicos, en armonia con la Ley 115 de 1994 y Ley 1098 de 2006."
  }
] as const;

const legalReferenceLabels: Record<string, string> = {
  LEY_1620_2013: "Ley 1620 de 2013",
  DECRETO_1965_2013: "Decreto 1965 de 2013",
  LEY_115_1994: "Ley 115 de 1994",
  LEY_1098_2006: "Ley 1098 de 2006"
};

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body?: string; status: string; audience?: string; legalReference?: string; createdAt: string }>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [createForm, setCreateForm] = useState({
    audience: "BOTH",
    legalReference: "LEY_1620_2013",
    templateKey: "",
    title: "",
    body: ""
  });
  const [editingId, setEditingId] = useState("");
  const [editingBusy, setEditingBusy] = useState(false);
  const [editingError, setEditingError] = useState("");
  const [editingForm, setEditingForm] = useState({ title: "", body: "" });

  const load = () =>
    apiGet(`/notifications?page=${page}&pageSize=10${statusFilter ? `&status=${statusFilter}` : ""}`)
      .then((res) => {
        setNotifications(res.data || []);
        setTotal(res.total || 0);
      })
      .catch(() => undefined);

  useEffect(() => {
    load();
  }, [page, statusFilter]);

  const approve = async (id: string) => {
    await apiPost(`/notifications/${id}/approve`, {});
    load();
  };

  const reject = async (id: string) => {
    await apiPost(`/notifications/${id}/reject`, {});
    load();
  };

  const startEdit = (notification: { id: string; title: string; body?: string }) => {
    setEditingError("");
    setEditingId(notification.id);
    setEditingForm({ title: notification.title, body: notification.body || "" });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setEditingBusy(true);
    setEditingError("");
    try {
      const updated = await apiPatch(`/notifications/${editingId}`, editingForm);
      setNotifications((prev) => prev.map((n) => (n.id === editingId ? { ...n, ...updated } : n)));
      setEditingId("");
    } catch (error: any) {
      setEditingError(error?.message || "No se pudo actualizar la notificacion");
    } finally {
      setEditingBusy(false);
    }
  };

  const applyTemplate = (templateKey: string) => {
    const tpl = convivenciaTemplates.find((t) => t.key === templateKey);
    if (!tpl) return;
    setCreateForm((prev) => ({
      ...prev,
      templateKey,
      title: tpl.title,
      body: tpl.body
    }));
  };

  const createByAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.body.trim()) return;
    setCreateBusy(true);
    setCreateError("");
    setCreateMessage("");
    try {
      await apiPost("/notifications/admin", {
        title: createForm.title.trim(),
        body: createForm.body.trim(),
        audience: createForm.audience,
        legalReference: createForm.legalReference || undefined
      });
      setCreateMessage("Notificacion creada y enviada correctamente.");
      setCreateForm({ audience: "BOTH", legalReference: "LEY_1620_2013", templateKey: "", title: "", body: "" });
      load();
    } catch (error: any) {
      setCreateError(error?.message || "No se pudo crear la notificacion");
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <Section title="Notificaciones">
      <div className="help-card">
        Aprueba/rechaza comunicaciones docentes y crea comunicados directos para docentes, padres o ambos.
      </div>
      <form className="card" onSubmit={createByAdmin}>
        <div className="section-title">Nueva notificacion institucional (Administrador)</div>
        {createError && <div style={{ color: "#b91c1c", marginBottom: 8 }}>{createError}</div>}
        {createMessage && <div style={{ color: "#15803d", marginBottom: 8 }}>{createMessage}</div>}
        <label>
          Destinatarios
          <select className="input" value={createForm.audience} onChange={(e) => setCreateForm((prev) => ({ ...prev, audience: e.target.value }))}>
            <option value="BOTH">Docentes y padres</option>
            <option value="TEACHERS">Solo docentes</option>
            <option value="PARENTS">Solo padres</option>
          </select>
        </label>
        <label>
          Base normativa
          <select className="input" value={createForm.legalReference} onChange={(e) => setCreateForm((prev) => ({ ...prev, legalReference: e.target.value }))}>
            <option value="LEY_1620_2013">Ley 1620 de 2013</option>
            <option value="DECRETO_1965_2013">Decreto 1965 de 2013</option>
            <option value="LEY_115_1994">Ley 115 de 1994</option>
            <option value="LEY_1098_2006">Ley 1098 de 2006</option>
          </select>
        </label>
        <label>
          Plantilla Manual de convivencia (MEN Colombia)
          <select className="input" value={createForm.templateKey} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">Sin plantilla (escribir manual)</option>
            {convivenciaTemplates.map((tpl) => (
              <option key={tpl.key} value={tpl.key}>{tpl.label}</option>
            ))}
          </select>
        </label>
        <label>
          Titulo
          <input className="input" value={createForm.title} onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))} />
        </label>
        <label>
          Mensaje
          <textarea className="input" rows={4} value={createForm.body} onChange={(e) => setCreateForm((prev) => ({ ...prev, body: e.target.value }))} />
        </label>
        <button className="button" disabled={createBusy}>{createBusy ? "Enviando..." : "Crear y enviar"}</button>
      </form>
      <DataTable
        columns={[
          { key: "title", label: "Titulo" },
          { key: "audience", label: "Destinatarios" },
          { key: "legalReference", label: "Base normativa" },
          { key: "status", label: "Estado" },
          { key: "date", label: "Fecha" }
        ]}
        rows={notifications.map((n) => ({
          title: n.title,
          audience:
            n.audience === "TEACHERS" ? "Docentes" : n.audience === "BOTH" ? "Docentes y padres" : "Padres",
          legalReference: legalReferenceLabels[String(n.legalReference || "")] || "-",
          status: n.status,
          date: n.createdAt.slice(0, 10)
        }))}
      />
      {editingId && (
        <form className="card" onSubmit={saveEdit}>
          <div className="section-title">Editar notificacion</div>
          {editingError && <div style={{ color: "#b91c1c", marginBottom: 8 }}>{editingError}</div>}
          <label>
            Titulo
            <input className="input" value={editingForm.title} onChange={(e) => setEditingForm({ ...editingForm, title: e.target.value })} />
          </label>
          <label>
            Mensaje
            <input className="input" value={editingForm.body} onChange={(e) => setEditingForm({ ...editingForm, body: e.target.value })} />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="button" disabled={editingBusy}>{editingBusy ? "Guardando..." : "Guardar cambios"}</button>
            <button className="button secondary" type="button" onClick={() => setEditingId("")}>Cancelar</button>
          </div>
        </form>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="APPROVED">Aprobado</option>
          <option value="REJECTED">Rechazado</option>
          <option value="SENT">Enviado</option>
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {notifications.map((n) => (
          <div key={n.id} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ color: "#6b7280" }}>{n.title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
              <button className="button secondary" onClick={() => startEdit(n)}>
                Editar
              </button>
              <button className="button secondary" disabled={n.status !== "PENDING"} onClick={() => approve(n.id)}>
                Aprobar
              </button>
              <button className="button danger" disabled={n.status !== "PENDING"} onClick={() => reject(n.id)}>
                Rechazar
              </button>
            </div>
          </div>
        ))}
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
