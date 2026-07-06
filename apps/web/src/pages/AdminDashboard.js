import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActionFeedback from "../components/ActionFeedback";
import KpiCard from "../components/KpiCard";
import Section from "../components/Section";
import Autocomplete from "../components/Autocomplete";
import { apiDelete, apiDownload, apiGet, apiPatch } from "../services/api";
import { gradeLabel, gradeOptions } from "../services/grades";
import useSuggestions from "../hooks/useSuggestions";
import { feedbackTitles } from "../utils/feedback";
export default function AdminDashboard() {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [totalStudents, setTotalStudents] = useState(0);
    const [globalStudents, setGlobalStudents] = useState(0);
    const [usersTotal, setUsersTotal] = useState(0);
    const [pendingAdmissions, setPendingAdmissions] = useState(0);
    const [pendingInvoices, setPendingInvoices] = useState(0);
    const [pendingNotifications, setPendingNotifications] = useState(0);
    const [pendingCertificateRequests, setPendingCertificateRequests] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(5);
    const [search, setSearch] = useState("");
    const [gradeFilter, setGradeFilter] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [editingId, setEditingId] = useState("");
    const [editBusy, setEditBusy] = useState(false);
    const [editError, setEditError] = useState("");
    const [editForm, setEditForm] = useState({
        fullName: "",
        gradeLevel: "PRE_JARDIN",
        studentGroup: "A",
        isActive: true
    });
    const preschoolGrades = new Set(["PRE_JARDIN", "JARDIN", "TRANSICION"]);
    const groupOptionsForGrade = (gradeLevel) => preschoolGrades.has(gradeLevel) ? ["A", "B", "C"] : ["1", "2", "3"];
    const studentSearchOptions = useSuggestions({
        endpoint: "/suggestions?type=students",
        query: search
    });
    const query = useMemo(() => new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
        ...(gradeFilter ? { gradeLevel: gradeFilter } : {})
    }).toString(), [page, pageSize, search, gradeFilter]);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");
        apiGet(`/students?${query}`)
            .then((res) => {
            if (!active)
                return;
            setStudents(res.data || []);
            setTotalStudents(res.total || 0);
        })
            .catch(() => {
            if (!active)
                return;
            setError("No se pudo cargar estudiantes");
        })
            .finally(() => {
            if (!active)
                return;
            setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [query]);
    useEffect(() => {
        let active = true;
        Promise.all([
            apiGet("/students?page=1&pageSize=1"),
            apiGet("/users?page=1&pageSize=1"),
            apiGet("/admissions?page=1&pageSize=1&status=PENDING"),
            apiGet("/invoices?page=1&pageSize=1&status=PENDING"),
            apiGet("/notifications?page=1&pageSize=1&status=PENDING"),
            apiGet("/reports/certificate/requests?page=1&pageSize=1&status=PENDING")
        ])
            .then(([studentsRes, usersRes, admissionsRes, invoicesRes, notificationsRes, certificateRes]) => {
            if (!active)
                return;
            setGlobalStudents(Number(studentsRes?.total || 0));
            setUsersTotal(Number(usersRes?.total || 0));
            setPendingAdmissions(Number(admissionsRes?.total || 0));
            setPendingInvoices(Number(invoicesRes?.total || 0));
            setPendingNotifications(Number(notificationsRes?.total || 0));
            setPendingCertificateRequests(Number(certificateRes?.total || 0));
        })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, []);
    const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
    const downloadStudents = async (type) => {
        const query = new URLSearchParams({
            ...(search ? { search } : {}),
            ...(gradeFilter ? { gradeLevel: gradeFilter } : {})
        }).toString();
        const path = type === "csv"
            ? `/reports/students-excel${query ? `?${query}` : ""}`
            : `/reports/students-pdf${query ? `?${query}` : ""}`;
        const blob = await apiDownload(path);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = type === "pdf" ? "students-report.pdf" : "students-report.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };
    const startEdit = (student) => {
        setEditError("");
        setEditingId(student.id);
        const groups = groupOptionsForGrade(student.gradeLevel);
        setEditForm({
            fullName: student.fullName,
            gradeLevel: student.gradeLevel,
            studentGroup: student.studentGroup || groups[0],
            isActive: student.isActive
        });
    };
    const saveEdit = async (e) => {
        e.preventDefault();
        if (!editingId)
            return;
        setEditBusy(true);
        setEditError("");
        try {
            const updated = await apiPatch(`/students/${editingId}`, {
                fullName: editForm.fullName,
                gradeLevel: editForm.gradeLevel,
                studentGroup: editForm.studentGroup,
                isActive: editForm.isActive
            });
            setStudents((prev) => prev.map((s) => (s.id === editingId ? updated : s)));
            setEditingId("");
        }
        catch (err) {
            setEditError(err?.message || "No se pudo actualizar el estudiante");
        }
        finally {
            setEditBusy(false);
        }
    };
    const deleteStudent = async (id, fullName) => {
        const confirmed = window.confirm(`Eliminar estudiante ${fullName}? Esta accion no se puede deshacer.`);
        if (!confirmed)
            return;
        setError("");
        try {
            await apiDelete(`/students/${id}`);
            setStudents((prev) => prev.filter((s) => s.id !== id));
            setTotalStudents((prev) => Math.max(0, prev - 1));
            setGlobalStudents((prev) => Math.max(0, prev - 1));
        }
        catch (err) {
            setError(err?.message || "No se pudo eliminar el estudiante");
        }
    };
    return (_jsxs("div", { className: "grid", style: { gap: 24 }, children: [_jsx("div", { className: "card", children: _jsxs("div", { className: "section-head", children: [_jsxs("div", { children: [_jsx("div", { className: "section-title", children: "Panel Administrador" }), _jsx("div", { style: { color: "#6b7280" }, children: "Accesos rapidos a gestion academica, personal y finanzas." })] }), _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("button", { className: "button secondary", onClick: () => navigate("/admin/alertas"), children: "Alertas" }), _jsx("button", { className: "button secondary", onClick: () => navigate("/admin/admisiones"), children: "Nueva admision" }), _jsx("button", { className: "button", onClick: () => navigate("/admin/usuarios"), children: "Crear usuario" }), _jsx("button", { className: "button secondary", onClick: () => navigate("/admin/notificaciones"), children: "Notificaciones" }), _jsx("button", { className: "button secondary", onClick: () => navigate("/admin/certificados"), children: "Certificados" }), _jsx("button", { className: "button secondary", onClick: () => navigate("/admin/finanzas"), children: "Finanzas" })] })] }) }), _jsxs("div", { className: "grid grid-4", children: [_jsx(KpiCard, { title: "Estudiantes registrados", value: String(globalStudents), trend: "Total del sistema", tone: "primary" }), _jsx(KpiCard, { title: "Usuarios", value: String(usersTotal), trend: "Activos e inactivos", tone: "success" }), _jsx(KpiCard, { title: "Admisiones pendientes", value: String(pendingAdmissions), trend: "Por aprobar", tone: "warning" }), _jsx(KpiCard, { title: "Pendientes (finanzas y avisos)", value: String(pendingInvoices + pendingNotifications), trend: `${pendingInvoices} facturas, ${pendingNotifications} notificaciones`, tone: "danger" }), _jsx(KpiCard, { title: "Certificados pendientes", value: String(pendingCertificateRequests), trend: "Solicitudes por aprobar", tone: "warning", onClick: () => navigate("/admin/certificados") })] }), _jsxs(Section, { title: "Estudiantes (paginacion server-side)", children: [_jsx("div", { className: "help-card", children: "Consejo: usa la busqueda por nombre o grado para ubicar rapido a un estudiante." }), _jsxs("div", { style: { display: "flex", gap: 12, marginBottom: 10 }, children: [_jsx(Autocomplete, { className: "input", placeholder: "Buscar por nombre o grado", value: search, options: studentSearchOptions, onChange: (value) => {
                                    setSearch(value);
                                    setPage(1);
                                } }), _jsxs("select", { className: "input", value: gradeFilter, onChange: (e) => {
                                    setGradeFilter(e.target.value);
                                    setPage(1);
                                }, children: [_jsx("option", { value: "", children: "Todos los niveles" }), gradeOptions.map((g) => (_jsx("option", { value: g.value, children: g.label }, g.value)))] }), _jsxs("div", { style: { minWidth: 140, alignSelf: "center", color: "#64748b" }, children: [totalStudents, " resultados"] }), _jsx("button", { className: "button secondary", type: "button", onClick: () => downloadStudents("pdf"), children: "Exportar PDF" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => downloadStudents("csv"), children: "Exportar Excel" })] }), editingId && (_jsxs("form", { className: "card", onSubmit: saveEdit, style: { marginBottom: 10 }, children: [_jsx("div", { className: "section-title", children: "Editar estudiante" }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.dashboard.studentEditError, message: editError, onDismiss: () => setEditError(""), style: { marginBottom: 8 } }), _jsxs("label", { children: ["Nombre", _jsx("input", { className: "input", value: editForm.fullName, onChange: (e) => setEditForm({ ...editForm, fullName: e.target.value }) })] }), _jsxs("label", { children: ["Grado", _jsx("select", { className: "input", value: editForm.gradeLevel, onChange: (e) => {
                                            const gradeLevel = e.target.value;
                                            const groups = groupOptionsForGrade(gradeLevel);
                                            setEditForm({ ...editForm, gradeLevel, studentGroup: groups[0] });
                                        }, children: gradeOptions.map((g) => (_jsx("option", { value: g.value, children: g.label }, g.value))) })] }), _jsxs("label", { children: ["Grupo", _jsx("select", { className: "input", value: editForm.studentGroup, onChange: (e) => setEditForm({ ...editForm, studentGroup: e.target.value }), children: groupOptionsForGrade(editForm.gradeLevel).map((group) => (_jsx("option", { value: group, children: group }, group))) })] }), _jsxs("label", { children: ["Estado", _jsxs("select", { className: "input", value: editForm.isActive ? "ACTIVE" : "INACTIVE", onChange: (e) => setEditForm({ ...editForm, isActive: e.target.value === "ACTIVE" }), children: [_jsx("option", { value: "ACTIVE", children: "Activo" }), _jsx("option", { value: "INACTIVE", children: "Inactivo" })] })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 10 }, children: [_jsx("button", { className: "button", disabled: editBusy, children: editBusy ? "Guardando..." : "Guardar cambios" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => setEditingId(""), children: "Cancelar" })] })] })), _jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Nombre" }), _jsx("th", { children: "Grado" }), _jsx("th", { children: "Grupo" }), _jsx("th", { children: "Estado" }), _jsx("th", { children: "Acciones" })] }) }), _jsxs("tbody", { children: [loading && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "table-empty", children: "Cargando..." }) })), !loading && error && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "table-empty", children: error }) })), !loading && !error && students.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "table-empty", children: "Sin datos" }) })), !loading && !error && students.map((s) => (_jsxs("tr", { children: [_jsx("td", { children: s.fullName }), _jsx("td", { children: gradeLabel(s.gradeLevel) }), _jsx("td", { children: s.studentGroup || "-" }), _jsx("td", { children: _jsx("span", { className: `status-badge ${s.isActive ? "status-active" : "status-inactive"}`, children: s.isActive ? "ACTIVE" : "INACTIVE" }) }), _jsx("td", { children: _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }, children: [_jsx("button", { className: "button secondary", type: "button", onClick: () => startEdit(s), children: "Editar" }), _jsx("button", { className: "button danger", type: "button", onClick: () => deleteStudent(s.id, s.fullName), children: "Eliminar" })] }) })] }, s.id)))] })] }) }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: page <= 1, onClick: () => setPage(page - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#64748b" }, children: ["Pagina ", page, " de ", totalPages] }), _jsx("button", { className: "button secondary", disabled: page >= totalPages, onClick: () => setPage(page + 1), children: "Siguiente" })] })] })] }));
}
