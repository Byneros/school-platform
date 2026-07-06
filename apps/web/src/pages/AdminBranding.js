import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import ActionFeedback from "../components/ActionFeedback";
import Section from "../components/Section";
import { apiDownload, apiGet, apiPut } from "../services/api";
import { feedbackTitles } from "../utils/feedback";
const defaultForm = {
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
    const [form, setForm] = useState(defaultForm);
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
        }
        catch (err) {
            setError(err?.message || "No se pudo cargar la personalizacion");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, []);
    const onLogoChange = async (file) => {
        if (!file)
            return;
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
            reader.readAsDataURL(file);
        });
        setForm((prev) => ({ ...prev, logoDataUrl: dataUrl }));
    };
    const save = async (e) => {
        e.preventDefault();
        if (!canEdit)
            return;
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const saved = await apiPut("/branding", form);
            setForm(saved);
            window.dispatchEvent(new Event("branding-updated"));
            setMessage("Personalizacion guardada.");
        }
        catch (err) {
            setError(err?.message || "No se pudo guardar la personalizacion");
        }
        finally {
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
    return (_jsxs(Section, { title: "Personalizacion institucional", children: [_jsx("div", { className: "help-card", children: "Configura logo, nombre oficial, colores y pie institucional para la interfaz y reportes PDF." }), loading && _jsx("div", { className: "card", children: "Cargando..." }), !loading && !canEdit && (_jsx("div", { className: "card", style: { color: "#b45309" }, children: "Solo el administrador principal (creador del sistema) puede editar esta configuracion." })), !loading && (_jsxs("form", { className: "card", onSubmit: save, children: [_jsx(ActionFeedback, { tone: "error", title: feedbackTitles.branding.error, message: error, onDismiss: () => setError(""), style: { marginBottom: 10 } }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.branding.success, message: message, onDismiss: () => setMessage(""), style: { marginBottom: 10 } }), _jsxs("label", { children: ["Nombre oficial del colegio", _jsx("input", { className: "input", value: form.schoolName, onChange: (e) => setForm({ ...form, schoolName: e.target.value }), disabled: !canEdit })] }), _jsxs("label", { children: ["Pie institucional para PDFs", _jsx("input", { className: "input", value: form.footerText, onChange: (e) => setForm({ ...form, footerText: e.target.value }), disabled: !canEdit })] }), _jsxs("div", { className: "grid grid-3", children: [_jsxs("label", { children: ["Color principal", _jsx("input", { className: "input", type: "color", value: form.primaryColor, onChange: (e) => setForm({ ...form, primaryColor: e.target.value }), disabled: !canEdit })] }), _jsxs("label", { children: ["Color secundario", _jsx("input", { className: "input", type: "color", value: form.secondaryColor, onChange: (e) => setForm({ ...form, secondaryColor: e.target.value }), disabled: !canEdit })] }), _jsxs("label", { children: ["Color acento", _jsx("input", { className: "input", type: "color", value: form.accentColor, onChange: (e) => setForm({ ...form, accentColor: e.target.value }), disabled: !canEdit })] })] }), _jsxs("label", { children: ["Logo institucional", _jsx("input", { className: "input", type: "file", accept: "image/png,image/jpeg,image/svg+xml,image/webp", onChange: (e) => onLogoChange(e.target.files?.[0] || null), disabled: !canEdit })] }), form.logoDataUrl && (_jsxs("div", { style: { marginTop: 10 }, children: [_jsx("img", { src: form.logoDataUrl, alt: "Logo institucional", style: { maxHeight: 80, maxWidth: 220, objectFit: "contain" } }), canEdit && (_jsx("div", { style: { marginTop: 8 }, children: _jsx("button", { type: "button", className: "button secondary", onClick: () => {
                                        const ok = window.confirm("Deseas quitar el logo actual?");
                                        if (!ok)
                                            return;
                                        setForm({ ...form, logoDataUrl: null });
                                    }, children: "Quitar logo" }) }))] })), canEdit && (_jsx("button", { className: "button", style: { marginTop: 12 }, disabled: saving, children: saving ? "Guardando..." : "Guardar personalizacion" }))] })), !loading && (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "section-head", style: { marginBottom: 10 }, children: [_jsx("div", { className: "section-title", children: "Vista previa de PDF institucional" }), _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("button", { type: "button", className: "button secondary", onClick: downloadPreviewPdf, children: "PDF demo" }), _jsx("button", { type: "button", className: "button secondary", onClick: downloadStudentsPreviewPdf, children: "PDF demo con estudiantes" })] })] }), _jsxs("div", { style: {
                            border: "1px solid #e2e8f0",
                            borderRadius: 10,
                            background: "#ffffff",
                            minHeight: 260,
                            padding: 16
                        }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }, children: [form.logoDataUrl ? (_jsx("img", { src: form.logoDataUrl, alt: "Logo vista previa", style: { width: 44, height: 44, objectFit: "contain" } })) : (_jsx("div", { style: {
                                            width: 44,
                                            height: 44,
                                            borderRadius: 8,
                                            border: "1px dashed #94a3b8"
                                        } })), _jsxs("div", { children: [_jsx("div", { style: { color: form.primaryColor, fontSize: 14, fontWeight: 700 }, children: form.schoolName || "Nombre del colegio" }), _jsxs("div", { style: { color: "#64748b", fontSize: 12 }, children: ["Generado: ", new Date().toLocaleString("es-CO")] })] })] }), _jsx("div", { style: { color: form.primaryColor, fontSize: 20, fontWeight: 800, textAlign: "center", marginTop: 8 }, children: "Reporte institucional" }), _jsx("div", { style: {
                                    background: form.accentColor,
                                    color: "#ffffff",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    marginTop: 16,
                                    fontWeight: 700
                                }, children: "Encabezado de tabla" }), _jsx("div", { style: { marginTop: 55, color: "#475569", fontSize: 11, textAlign: "center" }, children: form.footerText || "Pie institucional del colegio" })] })] }))] }));
}
