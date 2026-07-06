import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import ActionFeedback from "../components/ActionFeedback";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiDownload, apiGet, apiPost } from "../services/api";
import { gradeLabel } from "../services/grades";
import { feedbackTitles } from "../utils/feedback";
export default function AdminCertificates() {
    const [requestRows, setRequestRows] = useState([]);
    const [requestLoading, setRequestLoading] = useState(false);
    const [requestError, setRequestError] = useState("");
    const [requestTotal, setRequestTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [codeFilter, setCodeFilter] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [studentFilter, setStudentFilter] = useState("");
    const [issuerFilter, setIssuerFilter] = useState("");
    const [copiedCode, setCopiedCode] = useState("");
    const [verifyFeedback, setVerifyFeedback] = useState(null);
    const query = useMemo(() => new URLSearchParams({
        page: String(page),
        pageSize: "10",
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(codeFilter ? { code: codeFilter } : {}),
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
        ...(studentFilter ? { student: studentFilter } : {}),
        ...(issuerFilter ? { issuedBy: issuerFilter } : {})
    }).toString(), [page, typeFilter, codeFilter, fromDate, toDate, studentFilter, issuerFilter]);
    const load = () => {
        setLoading(true);
        setError("");
        apiGet(`/reports/certificates?${query}`)
            .then((res) => {
            setRows(res.data || []);
            setTotal(Number(res.total || 0));
        })
            .catch((e) => {
            setError(e?.message || "No se pudo cargar el libro de certificados.");
        })
            .finally(() => setLoading(false));
    };
    useEffect(() => {
        load();
    }, [query]);
    const loadRequests = () => {
        setRequestLoading(true);
        setRequestError("");
        apiGet("/reports/certificate/requests?status=PENDING&page=1&pageSize=50")
            .then((res) => {
            setRequestRows(res.data || []);
            setRequestTotal(Number(res.total || 0));
            window.dispatchEvent(new Event("certificate-requests-updated"));
        })
            .catch((e) => {
            setRequestError(e?.message || "No se pudieron cargar las solicitudes.");
        })
            .finally(() => setRequestLoading(false));
    };
    useEffect(() => {
        loadRequests();
    }, []);
    const download = async (type) => {
        const blob = await apiDownload(`/reports/certificates/export/${type}?${query.replace(/(^|&)page=[^&]*/g, "").replace(/(^|&)pageSize=[^&]*/g, "").replace(/^&/, "")}`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = type === "excel" ? "libro-certificados.xlsx" : "libro-certificados.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };
    const copyCode = async (code) => {
        if (!code)
            return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(code);
            }
            else {
                const tmp = document.createElement("textarea");
                tmp.value = code;
                document.body.appendChild(tmp);
                tmp.select();
                document.execCommand("copy");
                tmp.remove();
            }
            setCopiedCode(code);
            window.setTimeout(() => setCopiedCode(""), 1500);
        }
        catch {
            setError("No se pudo copiar el codigo.");
        }
    };
    const verifyCode = async (code) => {
        if (!code)
            return;
        setVerifyFeedback({ tone: "info", text: "Verificando..." });
        try {
            const res = await apiGet(`/reports/certificate/verify/${encodeURIComponent(code)}`);
            const cert = res?.certificate;
            if (cert) {
                setVerifyFeedback({
                    tone: "success",
                    code: cert.code || code,
                    text: `Valido: ${cert.type} ${cert.year}-${String(cert.serial).padStart(5, "0")} | Estudiante: ${cert.student?.fullName || "-"}`
                });
            }
            else {
                setVerifyFeedback({ tone: "success", code, text: "Certificado valido." });
            }
        }
        catch (e) {
            setVerifyFeedback({
                tone: "error",
                code,
                text: e?.message || "No se pudo verificar el certificado."
            });
        }
    };
    return (_jsxs("div", { className: "grid", style: { gap: 20 }, children: [_jsxs(Section, { title: "Solicitudes de certificados", children: [_jsxs("div", { className: "help-card", children: ["Aprueba o rechaza las solicitudes pendientes. Pendientes: ", requestTotal, "."] }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.certificates.requestsError, message: requestError, onDismiss: () => setRequestError(""), style: { marginTop: 8 } }), _jsx(DataTable, { columns: [
                            { key: "requestedAt", label: "Fecha" },
                            { key: "type", label: "Tipo" },
                            { key: "student", label: "Estudiante" },
                            { key: "requestedBy", label: "Solicitante" },
                            { key: "actions", label: "Acciones" }
                        ], rows: requestLoading
                            ? [{ requestedAt: "Cargando...", type: "", student: "", requestedBy: "", actions: "" }]
                            : requestRows.length === 0
                                ? [{ requestedAt: "Sin solicitudes pendientes", type: "", student: "", requestedBy: "", actions: "" }]
                                : requestRows.map((r) => ({
                                    requestedAt: String(r.requestedAt || "").slice(0, 10),
                                    type: r.type === "STUDY" ? "Constancia" : "Matricula",
                                    student: r.student?.fullName || "-",
                                    requestedBy: r.requestedBy?.fullName || "-",
                                    actions: (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("button", { className: "button secondary", type: "button", onClick: async () => {
                                                    try {
                                                        await apiPost(`/reports/certificate/requests/${r.id}/approve`, {});
                                                        loadRequests();
                                                    }
                                                    catch (e) {
                                                        setRequestError(e?.message || "No se pudo aprobar la solicitud.");
                                                    }
                                                }, children: "Aprobar" }), _jsx("button", { className: "button danger", type: "button", onClick: async () => {
                                                    try {
                                                        await apiPost(`/reports/certificate/requests/${r.id}/reject`, {});
                                                        loadRequests();
                                                    }
                                                    catch (e) {
                                                        setRequestError(e?.message || "No se pudo rechazar la solicitud.");
                                                    }
                                                }, children: "Rechazar" })] }))
                                })) })] }), _jsxs(Section, { title: "Libro de certificados emitidos", children: [_jsx("div", { className: "help-card", children: "Consulta y exporta el historial oficial de certificados emitidos." }), _jsxs("div", { className: "card", children: [_jsxs("div", { style: { display: "grid", gap: 8, gridTemplateColumns: "repeat(6, minmax(120px, 1fr))" }, children: [_jsxs("select", { className: "input", value: typeFilter, onChange: (e) => { setTypeFilter(e.target.value); setPage(1); }, children: [_jsx("option", { value: "", children: "Todos los tipos" }), _jsx("option", { value: "STUDY", children: "Constancia de estudio" }), _jsx("option", { value: "ENROLLMENT", children: "Certificado de matricula" })] }), _jsx("input", { className: "input", placeholder: "Filtrar por codigo", value: codeFilter, onChange: (e) => { setCodeFilter(e.target.value); setPage(1); } }), _jsx("input", { className: "input", type: "date", value: fromDate, onChange: (e) => { setFromDate(e.target.value); setPage(1); } }), _jsx("input", { className: "input", type: "date", value: toDate, onChange: (e) => { setToDate(e.target.value); setPage(1); } }), _jsx("input", { className: "input", placeholder: "Filtrar por estudiante", value: studentFilter, onChange: (e) => { setStudentFilter(e.target.value); setPage(1); } }), _jsx("input", { className: "input", placeholder: "Filtrar por emisor", value: issuerFilter, onChange: (e) => { setIssuerFilter(e.target.value); setPage(1); } })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 8 }, children: [_jsx("button", { className: "button secondary", type: "button", onClick: () => download("excel"), children: "Exportar Excel" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => download("pdf"), children: "Exportar PDF" })] }), verifyFeedback && (_jsxs("div", { style: {
                                    marginTop: 8,
                                    display: "flex",
                                    gap: 8,
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    color: verifyFeedback.tone === "success" ? "#166534" : verifyFeedback.tone === "error" ? "#b91c1c" : "#1e40af",
                                    background: verifyFeedback.tone === "success" ? "#f0fdf4" : verifyFeedback.tone === "error" ? "#fef2f2" : "#eff6ff",
                                    border: `1px solid ${verifyFeedback.tone === "success" ? "#86efac" : verifyFeedback.tone === "error" ? "#fecaca" : "#93c5fd"}`,
                                    borderRadius: 8,
                                    padding: "8px 10px"
                                }, children: [_jsx("span", { children: verifyFeedback.text }), verifyFeedback.code && (_jsx("button", { type: "button", className: "button secondary", style: { padding: "4px 8px", fontSize: 12 }, onClick: () => copyCode(verifyFeedback.code || ""), children: copiedCode === verifyFeedback.code ? "Codigo copiado" : "Copiar codigo" }))] }))] }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.certificates.issuedError, message: error, onDismiss: () => setError(""), style: { marginTop: 8 } }), _jsx(DataTable, { columns: [
                            { key: "issuedAt", label: "Fecha" },
                            { key: "type", label: "Tipo" },
                            { key: "serial", label: "Consecutivo" },
                            { key: "code", label: "Codigo" },
                            { key: "copy", label: "Copiar" },
                            { key: "verify", label: "Verificar" },
                            { key: "student", label: "Estudiante" },
                            { key: "grade", label: "Grado" },
                            { key: "group", label: "Grupo" },
                            { key: "issuedBy", label: "Emitido por" }
                        ], rows: loading
                            ? [{ issuedAt: "Cargando...", type: "", serial: "", code: "", copy: "", verify: "", student: "", grade: "", group: "", issuedBy: "" }]
                            : rows.map((r) => ({
                                issuedAt: String(r.issuedAt || "").slice(0, 10),
                                type: r.type === "STUDY" ? "Constancia" : "Matricula",
                                serial: `${r.year}-${String(r.serial).padStart(5, "0")}`,
                                code: r.code,
                                copy: (_jsx("button", { className: "button secondary", type: "button", onClick: () => copyCode(r.code), style: { padding: "4px 8px", fontSize: 12 }, children: copiedCode === r.code ? "Copiado" : "Copiar" })),
                                verify: (_jsx("button", { className: "button secondary", type: "button", onClick: () => verifyCode(r.code), style: { padding: "4px 8px", fontSize: 12 }, children: "Verificar" })),
                                student: r.student?.fullName || "-",
                                grade: r.student?.gradeLevel ? gradeLabel(r.student.gradeLevel) : "-",
                                group: r.student?.studentGroup || "-",
                                issuedBy: r.issuedBy?.fullName || "-"
                            })) }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: page <= 1, onClick: () => setPage(page - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", page, " de ", Math.max(1, Math.ceil(total / 10))] }), _jsx("button", { className: "button secondary", disabled: page >= Math.ceil(total / 10), onClick: () => setPage(page + 1), children: "Siguiente" })] })] })] }));
}
