import React, { useEffect, useState } from "react";
import ActionFeedback from "../components/ActionFeedback";
import Section from "../components/Section";
import { apiDownload, apiGet, apiPut } from "../services/api";

type BrandingSettings = {
  schoolName: string;
  logoDataUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText: string;
};

const defaultForm: BrandingSettings = {
  schoolName: "",
  logoDataUrl: null,
  primaryColor: "#1e3a8a",
  secondaryColor: "#0ea5e9",
  accentColor: "#f59e0b",
  footerText: ""
};

export default function AdminBranding() {
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<BrandingSettings>(defaultForm);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [branding, access] = await Promise.all([apiGet("/branding"), apiGet("/branding/access")]);
      setForm({
        schoolName: branding.schoolName || "",
        logoDataUrl: branding.logoDataUrl || null,
        primaryColor: branding.primaryColor || "#1e3a8a",
        secondaryColor: branding.secondaryColor || "#0ea5e9",
        accentColor: branding.accentColor || "#f59e0b",
        footerText: branding.footerText || ""
      });
      setCanEdit(Boolean(access?.canEdit));
    } catch (err: any) {
      setError(err?.message || "No se pudo cargar la personalizacion");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onLogoChange = async (file: File | null) => {
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });
    setForm((prev) => ({ ...prev, logoDataUrl: dataUrl }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await apiPut("/branding", form);
      setForm(saved);
      window.dispatchEvent(new Event("branding-updated"));
      setMessage("Personalizacion guardada.");
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la personalizacion");
    } finally {
      setSaving(false);
    }
  };

  const downloadPreviewPdf = async () => {
    const blob = await apiDownload("/branding/preview-pdf");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "preview-branding.pdf";
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadStudentsPreviewPdf = async () => {
    const blob = await apiDownload("/branding/preview-pdf/students");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "preview-branding-students.pdf";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Section title="Personalizacion institucional">
      <div className="help-card">
        Configura logo, nombre oficial, colores y pie institucional para la interfaz y reportes PDF.
      </div>
      {loading && <div className="card">Cargando...</div>}
      {!loading && !canEdit && (
        <div className="card" style={{ color: "#b45309" }}>
          Solo el administrador principal (creador del sistema) puede editar esta configuracion.
        </div>
      )}
      {!loading && (
        <form className="card" onSubmit={save}>
          <ActionFeedback
            tone="error"
            title="Error de personalizacion"
            message={error}
            onDismiss={() => setError("")}
            style={{ marginBottom: 10 }}
          />
          <ActionFeedback
            tone="success"
            title="Personalizacion guardada"
            message={message}
            onDismiss={() => setMessage("")}
            style={{ marginBottom: 10 }}
          />
          <label>
            Nombre oficial del colegio
            <input
              className="input"
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              disabled={!canEdit}
            />
          </label>
          <label>
            Pie institucional para PDFs
            <input
              className="input"
              value={form.footerText}
              onChange={(e) => setForm({ ...form, footerText: e.target.value })}
              disabled={!canEdit}
            />
          </label>
          <div className="grid grid-3">
            <label>
              Color principal
              <input
                className="input"
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                disabled={!canEdit}
              />
            </label>
            <label>
              Color secundario
              <input
                className="input"
                type="color"
                value={form.secondaryColor}
                onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                disabled={!canEdit}
              />
            </label>
            <label>
              Color acento
              <input
                className="input"
                type="color"
                value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                disabled={!canEdit}
              />
            </label>
          </div>
          <label>
            Logo institucional
            <input
              className="input"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => onLogoChange(e.target.files?.[0] || null)}
              disabled={!canEdit}
            />
          </label>
          {form.logoDataUrl && (
            <div style={{ marginTop: 10 }}>
              <img src={form.logoDataUrl} alt="Logo institucional" style={{ maxHeight: 80, maxWidth: 220, objectFit: "contain" }} />
              {canEdit && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      const ok = window.confirm("Deseas quitar el logo actual?");
                      if (!ok) return;
                      setForm({ ...form, logoDataUrl: null });
                    }}
                  >
                    Quitar logo
                  </button>
                </div>
              )}
            </div>
          )}
          {canEdit && (
            <button className="button" style={{ marginTop: 12 }} disabled={saving}>
              {saving ? "Guardando..." : "Guardar personalizacion"}
            </button>
          )}
        </form>
      )}
      {!loading && (
        <div className="card">
          <div className="section-head" style={{ marginBottom: 10 }}>
            <div className="section-title">Vista previa de PDF institucional</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="button secondary" onClick={downloadPreviewPdf}>
                PDF demo
              </button>
              <button type="button" className="button secondary" onClick={downloadStudentsPreviewPdf}>
                PDF demo con estudiantes
              </button>
            </div>
          </div>
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#ffffff",
              minHeight: 260,
              padding: 16
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              {form.logoDataUrl ? (
                <img src={form.logoDataUrl} alt="Logo vista previa" style={{ width: 44, height: 44, objectFit: "contain" }} />
              ) : (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    border: "1px dashed #94a3b8"
                  }}
                />
              )}
              <div>
                <div style={{ color: form.primaryColor, fontSize: 14, fontWeight: 700 }}>{form.schoolName || "Nombre del colegio"}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>Generado: {new Date().toLocaleString("es-CO")}</div>
              </div>
            </div>
            <div style={{ color: form.primaryColor, fontSize: 20, fontWeight: 800, textAlign: "center", marginTop: 8 }}>
              Reporte institucional
            </div>
            <div
              style={{
                background: form.accentColor,
                color: "#ffffff",
                borderRadius: 8,
                padding: "8px 10px",
                marginTop: 16,
                fontWeight: 700
              }}
            >
              Encabezado de tabla
            </div>
            <div style={{ marginTop: 55, color: "#475569", fontSize: 11, textAlign: "center" }}>
              {form.footerText || "Pie institucional del colegio"}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
