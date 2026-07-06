import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import Autocomplete from "../components/Autocomplete";
import ActionFeedback from "../components/ActionFeedback";
import { apiDelete, apiDownload, apiGet, apiPatch, apiPost } from "../services/api";
import useDebounce from "../hooks/useDebounce";
import { feedbackTitles } from "../utils/feedback";
import useSuggestions from "../hooks/useSuggestions";
import { useAuth } from "../context/AuthContext";
function isStrongPassword(password) {
    return (password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password));
}
function passwordRules(password) {
    return [
        { label: "Minimo 8 caracteres", ok: password.length >= 8 },
        { label: "Al menos una mayuscula (A-Z)", ok: /[A-Z]/.test(password) },
        { label: "Al menos una minuscula (a-z)", ok: /[a-z]/.test(password) },
        { label: "Al menos un numero (0-9)", ok: /[0-9]/.test(password) },
        { label: "Al menos un simbolo (!@#$...)", ok: /[^A-Za-z0-9]/.test(password) }
    ];
}
function PasswordChecklist({ password }) {
    const rules = passwordRules(password);
    const passed = rules.filter((r) => r.ok).length;
    const strength = passed <= 2
        ? { label: "Debil", color: "#dc2626", width: "33%" }
        : passed <= 4
            ? { label: "Media", color: "#d97706", width: "66%" }
            : { label: "Fuerte", color: "#15803d", width: "100%" };
    return (_jsxs("div", { style: { marginTop: 6 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#64748b", marginBottom: 4 }, children: [_jsx("span", { children: "Fortaleza de contrasena" }), _jsx("span", { style: { color: strength.color, fontWeight: 600 }, children: strength.label })] }), _jsx("div", { style: { width: "100%", height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden", marginBottom: 6 }, children: _jsx("div", { style: { width: strength.width, height: "100%", background: strength.color, transition: "width .2s ease" } }) }), _jsx("ul", { style: { margin: 0, paddingLeft: 16, fontSize: 12, color: "#64748b", display: "grid", gap: 2 }, children: rules.map((rule) => (_jsxs("li", { style: { color: rule.ok ? "#15803d" : "#64748b" }, children: [rule.ok ? "✅" : "❌", " ", rule.label] }, rule.label))) })] }));
}
export default function AdminUsers() {
    const { user } = useAuth();
    const canManageDeveloperUsers = user?.role === "DEVELOPER";
    const [searchParams, setSearchParams] = useSearchParams();
    const [users, setUsers] = useState([]);
    const [allUsersForSections, setAllUsersForSections] = useState([]);
    const [pendingParentUsers, setPendingParentUsers] = useState([]);
    const [pendingParentLoading, setPendingParentLoading] = useState(false);
    const [form, setForm] = useState({ fullName: "", email: "", role: "ADMIN", password: "", teacherSubjects: [] });
    const [actionError, setActionError] = useState("");
    const [createError, setCreateError] = useState("");
    const [createMessage, setCreateMessage] = useState("");
    const [editingId, setEditingId] = useState("");
    const [editBusy, setEditBusy] = useState(false);
    const [editError, setEditError] = useState("");
    const [editMessage, setEditMessage] = useState("");
    const [toggleError, setToggleError] = useState("");
    const [toggleMessage, setToggleMessage] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const [deleteMessage, setDeleteMessage] = useState("");
    const [editForm, setEditForm] = useState({ fullName: "", email: "", role: "ADMIN", password: "" });
    const [showCreatePassword, setShowCreatePassword] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);
    const [collapsedByRole, setCollapsedByRole] = useState({
        ADMIN: false,
        TEACHER: false,
        PARENT: false,
        DEVELOPER: false
    });
    const [importFile, setImportFile] = useState(null);
    const [importBusy, setImportBusy] = useState(false);
    const [importMode, setImportMode] = useState("validate");
    const [importError, setImportError] = useState("");
    const [importResult, setImportResult] = useState(null);
    const [importHistory, setImportHistory] = useState([]);
    const [importHistoryLoading, setImportHistoryLoading] = useState(false);
    const [expandedParentById, setExpandedParentById] = useState({});
    const teacherSubjectOptions = [
        "Ciencias Naturales",
        "Educacion Ambiental",
        "Ciencias Sociales",
        "Historia",
        "Geografia",
        "Constitucion Politica y Democracia",
        "Educacion Artistica",
        "Educacion Etica y en Valores Humanos",
        "Educacion Fisica",
        "Educacion Religiosa",
        "Lengua Castellana",
        "Idiomas Extranjeros",
        "Matematicas",
        "Tecnologia e Informatica",
        "Fisica",
        "Quimica",
        "Geometria",
        "Comprension Lectora"
    ];
    const initialPage = Number(searchParams.get("page") || "1");
    const initialRole = searchParams.get("role") || "";
    const initialSearch = searchParams.get("search") || "";
    const [page, setPage] = useState(Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1);
    const [total, setTotal] = useState(0);
    const [roleFilter, setRoleFilter] = useState(initialRole);
    const [search, setSearch] = useState(initialSearch);
    const debouncedSearch = useDebounce(search, 350);
    const [savedFilters, setSavedFilters] = useState([]);
    const [filterName, setFilterName] = useState("");
    const [selectedFilterId, setSelectedFilterId] = useState("");
    const [canDeleteUsers, setCanDeleteUsers] = useState(false);
    const [loadError, setLoadError] = useState("");
    const createPanelRef = useRef(null);
    const createNameInputRef = useRef(null);
    const editPanelRef = useRef(null);
    const editNameInputRef = useRef(null);
    const userSearchOptions = useSuggestions({
        endpoint: "/suggestions?type=users",
        query: search
    });
    useEffect(() => {
        const next = new URLSearchParams();
        if (page > 1)
            next.set("page", String(page));
        if (roleFilter)
            next.set("role", roleFilter);
        if (search)
            next.set("search", search);
        setSearchParams(next, { replace: true });
    }, [page, roleFilter, search, setSearchParams]);
    useEffect(() => {
        const raw = localStorage.getItem("admin_users_filters");
        if (!raw)
            return;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                setSavedFilters(parsed);
            }
        }
        catch {
            setSavedFilters([]);
        }
    }, []);
    const persistFilters = (next) => {
        setSavedFilters(next);
        localStorage.setItem("admin_users_filters", JSON.stringify(next));
    };
    const saveCurrentFilter = () => {
        const trimmed = filterName.trim();
        const name = trimmed || `Filtro ${new Date().toLocaleDateString("es-CO")} ${new Date().toLocaleTimeString("es-CO")}`;
        const id = trimmed ? trimmed.toLowerCase().replace(/\s+/g, "-") : `f-${Date.now()}`;
        const next = savedFilters.filter((f) => f.id !== id);
        const updated = [
            { id, name, roleFilter, search },
            ...next
        ];
        persistFilters(updated.slice(0, 10));
        setSelectedFilterId(id);
        setFilterName("");
    };
    const applySavedFilter = (id) => {
        setSelectedFilterId(id);
        const selected = savedFilters.find((f) => f.id === id);
        if (!selected)
            return;
        setRoleFilter(selected.roleFilter);
        setSearch(selected.search);
        setPage(1);
    };
    const deleteSavedFilter = () => {
        if (!selectedFilterId)
            return;
        const next = savedFilters.filter((f) => f.id !== selectedFilterId);
        persistFilters(next);
        setSelectedFilterId("");
    };
    const load = () => apiGet(`/users?page=${page}&pageSize=10${roleFilter ? `&role=${roleFilter}` : ""}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`)
        .then((res) => {
        setLoadError("");
        const data = res.data || [];
        setUsers(data);
        setTotal(res.total || 0);
        setCanDeleteUsers(Boolean(res.canDelete));
    })
        .catch((error) => {
        setLoadError(error?.message || "No se pudieron cargar los usuarios.");
    });
    const loadAllForSections = () => apiGet(`/users?page=1&pageSize=5000${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`)
        .then((res) => {
        setAllUsersForSections(res.data || []);
    })
        .catch(() => undefined);
    const loadPendingParentUsers = () => (setPendingParentLoading(true),
        apiGet("/users/parents/pending-account")
            .then((res) => setPendingParentUsers(res.data || []))
            .catch(() => setPendingParentUsers([]))
            .finally(() => setPendingParentLoading(false)));
    const loadImportHistory = async () => {
        setImportHistoryLoading(true);
        try {
            const res = await apiGet("/reports/import-template/history");
            setImportHistory(res?.data || []);
        }
        catch {
            setImportHistory([]);
        }
        finally {
            setImportHistoryLoading(false);
        }
    };
    useEffect(() => {
        load();
        loadAllForSections();
        loadPendingParentUsers();
        loadImportHistory();
    }, [page, roleFilter, debouncedSearch]);
    useEffect(() => {
        if (!editingId)
            return;
        requestAnimationFrame(() => {
            editPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            editNameInputRef.current?.focus();
        });
    }, [editingId]);
    const create = async (e) => {
        e.preventDefault();
        setCreateError("");
        setCreateMessage("");
        if (!form.fullName.trim() || !form.email.trim() || !form.password.trim()) {
            setCreateError("Completa nombre, correo y contrasena.");
            return;
        }
        if (form.role === "TEACHER" && form.teacherSubjects.length === 0) {
            setCreateError("Debes asignar al menos una asignatura al docente.");
            return;
        }
        if (!isStrongPassword(form.password.trim())) {
            setCreateError("Contrasena invalida. Usa minimo 8 caracteres, mayuscula, minuscula, numero y simbolo.");
            return;
        }
        try {
            const payload = {
                ...form,
                fullName: form.fullName.trim(),
                email: form.email.trim().toLowerCase(),
                password: form.password.trim()
            };
            await apiPost("/users", payload);
            setForm({ fullName: "", email: "", role: "ADMIN", password: "", teacherSubjects: [] });
            setCreateMessage("Usuario creado satisfactoriamente.");
            load();
            loadPendingParentUsers();
        }
        catch (error) {
            setCreateError(error?.message || "No se pudo crear el usuario.");
        }
    };
    const usePendingGuardianForCreate = (guardian) => {
        setActionError("");
        setForm((prev) => ({
            ...prev,
            fullName: guardian.guardianFullName || "",
            email: guardian.contactEmail || "",
            role: "PARENT",
            teacherSubjects: []
        }));
        requestAnimationFrame(() => {
            createPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            createNameInputRef.current?.focus();
        });
    };
    const toggleActive = async (id, isActive) => {
        setToggleError("");
        setToggleMessage("");
        try {
            const updated = await apiPatch(`/users/${id}`, { isActive: !isActive });
            setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
            setAllUsersForSections((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
            setToggleMessage(isActive ? "Usuario desactivado satisfactoriamente." : "Usuario activado satisfactoriamente.");
        }
        catch (error) {
            setToggleError(error?.message || "No se pudo actualizar el usuario");
        }
    };
    const startEdit = (user) => {
        setActionError("");
        setEditError("");
        setEditMessage("");
        setEditingId(user.id);
        setEditForm({
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            password: ""
        });
    };
    const saveEdit = async (e) => {
        e.preventDefault();
        if (!editingId)
            return;
        setEditBusy(true);
        setEditError("");
        setEditMessage("");
        try {
            const body = {
                fullName: editForm.fullName,
                email: editForm.email,
                role: editForm.role
            };
            if (editForm.password.trim()) {
                if (!isStrongPassword(editForm.password.trim())) {
                    setEditError("La nueva contrasena debe tener minimo 8 caracteres, mayuscula, minuscula, numero y simbolo.");
                    setEditBusy(false);
                    return;
                }
                body.password = editForm.password.trim();
            }
            const updated = await apiPatch(`/users/${editingId}`, body);
            setUsers((prev) => prev.map((u) => (u.id === editingId ? { ...u, ...updated } : u)));
            setAllUsersForSections((prev) => prev.map((u) => (u.id === editingId ? { ...u, ...updated } : u)));
            setEditMessage("Usuario actualizado satisfactoriamente.");
            setEditForm({ fullName: "", email: "", role: "ADMIN", password: "" });
            loadPendingParentUsers();
        }
        catch (error) {
            setEditError(error?.message || "No se pudo editar el usuario");
        }
        finally {
            setEditBusy(false);
        }
    };
    const deleteUser = async (id, fullName, isPrincipal) => {
        if (isPrincipal || !canDeleteUsers) {
            setDeleteError("Solo el administrador principal puede eliminar usuarios.");
            return;
        }
        const confirmed = window.confirm(`Eliminar usuario ${fullName}? Esta accion no se puede deshacer.`);
        if (!confirmed)
            return;
        setDeleteError("");
        setDeleteMessage("");
        try {
            const res = await apiDelete(`/users/${id}`);
            if (res?.deactivated && res?.user) {
                setUsers((prev) => prev.map((u) => (u.id === res.user.id ? { ...u, ...res.user } : u)));
                setAllUsersForSections((prev) => prev.map((u) => (u.id === res.user.id ? { ...u, ...res.user } : u)));
                setDeleteMessage(res?.message || "Usuario desactivado.");
            }
            else {
                setUsers((prev) => prev.filter((u) => u.id !== id));
                setAllUsersForSections((prev) => prev.filter((u) => u.id !== id));
                setDeleteMessage("Usuario eliminado satisfactoriamente.");
            }
            loadPendingParentUsers();
        }
        catch (error) {
            setDeleteError(error?.message || "No se pudo eliminar el usuario");
        }
    };
    const downloadFile = async (path, filename) => {
        const blob = await apiDownload(path);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };
    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
    const runImport = async () => {
        if (!importFile) {
            setImportError("Selecciona un archivo .xlsx.");
            return;
        }
        const maxFileSizeBytes = 8 * 1024 * 1024;
        if (importFile.size > maxFileSizeBytes) {
            setImportError("El archivo .xlsx es demasiado grande. Usa un archivo menor a 8 MB o dividelo en varias importaciones.");
            return;
        }
        setImportBusy(true);
        setImportError("");
        setImportResult(null);
        try {
            const fileBase64 = await fileToBase64(importFile);
            const result = await apiPost("/reports/import-template/import", {
                fileBase64,
                mode: importMode
            });
            setImportResult(result);
            if (importMode === "import") {
                load();
                loadAllForSections();
                loadPendingParentUsers();
            }
            await loadImportHistory();
        }
        catch (error) {
            setImportError(error?.message || "No se pudo procesar la importacion.");
        }
        finally {
            setImportBusy(false);
        }
    };
    const roleSections = [
        { key: "ADMIN", label: "Administradores" },
        ...(canManageDeveloperUsers ? [{ key: "DEVELOPER", label: "Desarrolladores" }] : []),
        { key: "TEACHER", label: "Docentes" },
        { key: "PARENT", label: "Padres de familia" }
    ];
    return (_jsxs(Section, { title: "Usuarios", children: [_jsx("div", { className: "help-card", children: "Gestiona usuarios, roles y accesos desde el panel principal." }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.users.createSuccess, message: createMessage, onDismiss: () => setCreateMessage("") }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.users.createError, message: createError, onDismiss: () => setCreateError("") }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.users.deleteSuccess, message: deleteMessage, onDismiss: () => setDeleteMessage("") }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.users.deleteError, message: deleteError, onDismiss: () => setDeleteError("") }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.users.toggleSuccess, message: toggleMessage, onDismiss: () => setToggleMessage("") }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.users.toggleError, message: toggleError, onDismiss: () => setToggleError("") }), _jsxs("form", { ref: createPanelRef, className: "card", onSubmit: create, children: [_jsx("div", { className: "section-title", children: "Crear usuario" }), _jsxs("label", { children: ["Nombre", _jsx("input", { ref: createNameInputRef, className: "input", name: "fullName", autoComplete: "name", value: form.fullName, onChange: (e) => setForm({ ...form, fullName: e.target.value }) })] }), _jsxs("label", { children: ["Correo", _jsx("input", { className: "input", name: "email", autoComplete: "email", value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }) })] }), _jsxs("label", { children: ["Rol", _jsxs("select", { className: "input", value: form.role, onChange: (e) => setForm({ ...form, role: e.target.value, teacherSubjects: e.target.value === "TEACHER" ? form.teacherSubjects : [] }), children: [_jsx("option", { value: "ADMIN", children: "Administrador" }), canManageDeveloperUsers && _jsx("option", { value: "DEVELOPER", children: "Desarrollador" }), _jsx("option", { value: "TEACHER", children: "Docente" }), _jsx("option", { value: "PARENT", children: "Padre" })] })] }), form.role === "TEACHER" && (_jsxs("label", { children: ["Asignaturas del docente", _jsx("div", { className: "card", style: { boxShadow: "none", padding: 10, marginTop: 6 }, children: _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }, children: teacherSubjectOptions.map((subject) => {
                                        const checked = form.teacherSubjects.includes(subject);
                                        return (_jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center", color: "#334155" }, children: [_jsx("input", { type: "checkbox", checked: checked, onChange: (e) => setForm((prev) => ({
                                                        ...prev,
                                                        teacherSubjects: e.target.checked
                                                            ? [...prev.teacherSubjects, subject]
                                                            : prev.teacherSubjects.filter((s) => s !== subject)
                                                    })) }), subject] }, subject));
                                    }) }) })] })), _jsxs("label", { children: ["Contrasena temporal", _jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { className: "input", name: "newPassword", autoComplete: "new-password", type: showCreatePassword ? "text" : "password", value: form.password, onChange: (e) => setForm({ ...form, password: e.target.value }) }), _jsx("button", { type: "button", className: "button secondary", onClick: () => setShowCreatePassword((v) => !v), children: showCreatePassword ? "Ocultar" : "Ver" })] }), _jsx(PasswordChecklist, { password: form.password })] }), _jsx("button", { className: "button", style: { marginTop: 10 }, children: "Crear" })] }), _jsxs("div", { className: "card", style: { marginBottom: 10 }, children: [_jsxs("div", { className: "section-title", style: { marginBottom: 8 }, children: ["Acudientes con estudiantes matriculados sin usuario (", pendingParentUsers.length, ")"] }), _jsxs("div", { style: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 8 }, children: [pendingParentLoading && _jsx("span", { style: { color: "#64748b", fontSize: 12 }, children: "Actualizando..." }), _jsx("button", { className: "button secondary", type: "button", onClick: loadPendingParentUsers, disabled: pendingParentLoading, children: pendingParentLoading ? "Actualizando..." : "Actualizar lista" })] }), pendingParentUsers.length === 0 ? (_jsx("div", { style: { color: "#64748b" }, children: "No hay acudientes pendientes de crear usuario." })) : (_jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Acudiente" }), _jsx("th", { children: "Correo" }), _jsx("th", { children: "Documento" }), _jsx("th", { children: "Estudiantes matriculados" }), _jsx("th", { children: "Accion" })] }) }), _jsx("tbody", { children: pendingParentUsers.map((row, idx) => (_jsxs("tr", { style: { cursor: "pointer" }, onClick: () => usePendingGuardianForCreate(row), title: "Clic para cargar en Crear usuario", children: [_jsx("td", { children: row.guardianFullName || "-" }), _jsx("td", { children: row.contactEmail || "Sin correo" }), _jsx("td", { children: row.guardianDocNumber || "-" }), _jsx("td", { children: row.students.map((s) => `${s.studentName} (${s.grade || "-"}-${s.group || "-"})`).join(", ") }), _jsx("td", { children: _jsx("button", { type: "button", className: "button secondary", onClick: (e) => {
                                                        e.stopPropagation();
                                                        usePendingGuardianForCreate(row);
                                                    }, style: { padding: "4px 8px", fontSize: 12 }, children: "Usar en formulario" }) })] }, `${row.guardianDocNumber || row.contactEmail || row.guardianFullName}-${idx}`))) })] }) }))] }), _jsxs("div", { style: { display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }, children: [_jsx(Autocomplete, { className: "input input-search", placeholder: "Buscar por nombre o correo", value: search, options: userSearchOptions, onChange: (value) => {
                            setSearch(value);
                            setPage(1);
                        } }), _jsxs("select", { className: "input", value: roleFilter, onChange: (e) => setRoleFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los roles" }), _jsx("option", { value: "ADMIN", children: "Administrador" }), canManageDeveloperUsers && _jsx("option", { value: "DEVELOPER", children: "Desarrollador" }), _jsx("option", { value: "TEACHER", children: "Docente" }), _jsx("option", { value: "PARENT", children: "Padre" })] }), _jsx("button", { className: "button secondary", type: "button", onClick: () => downloadFile("/users/export/excel", "users-report.xlsx"), children: "Exportar Excel" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => downloadFile("/users/export/pdf", "users.pdf"), children: "Exportar PDF" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => downloadFile("/reports/import-template/excel", "plantilla-importacion.xlsx"), children: "Plantilla importacion" })] }), _jsxs("div", { className: "card", style: { marginBottom: 12 }, children: [_jsx("div", { className: "section-title", children: "Importar datos desde Excel" }), _jsx("div", { style: { color: "#64748b", marginBottom: 8 }, children: "Usa la plantilla oficial. Primero valida y luego importa si todo esta correcto." }), _jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }, children: [_jsx("input", { type: "file", accept: ".xlsx", onChange: (e) => setImportFile(e.target.files?.[0] || null) }), _jsxs("select", { className: "input", value: importMode, onChange: (e) => setImportMode(e.target.value), children: [_jsx("option", { value: "validate", children: "Solo validar" }), _jsx("option", { value: "import", children: "Importar" })] }), _jsx("button", { className: "button", type: "button", onClick: runImport, disabled: importBusy, children: importBusy ? "Procesando..." : importMode === "import" ? "Importar" : "Validar" })] }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.users.importError, message: importError, onDismiss: () => setImportError(""), style: { marginTop: 8 } }), importResult && (_jsxs("div", { style: { marginTop: 8, color: "#334155" }, children: [_jsxs("div", { children: ["Modo: ", importResult.mode] }), _jsxs("div", { children: ["Creados: usuarios ", importResult.created?.users || 0, ", docentes ", importResult.created?.teachers || 0, ", padres ", importResult.created?.parents || 0, ", estudiantes ", importResult.created?.students || 0, ", clases ", importResult.created?.classes || 0, ", matriculas ", importResult.created?.enrollments || 0] }), _jsxs("div", { children: ["Actualizados: usuarios ", importResult.updated?.users || 0, ", docentes ", importResult.updated?.teachers || 0, ", estudiantes ", importResult.updated?.students || 0, ", clases ", importResult.updated?.classes || 0, ", matriculas ", importResult.updated?.enrollments || 0] }), _jsxs("div", { children: ["Omitidos: ", importResult.skipped || 0] }), importResult.defaultPasswordUsed && (_jsx("div", { style: { color: "#9a3412" }, children: "Se uso contrasena temporal para algunos usuarios." })), Array.isArray(importResult.errors) && importResult.errors.length > 0 && (_jsxs("div", { style: { marginTop: 6 }, children: [_jsx("strong", { children: "Errores:" }), _jsx("ul", { style: { margin: "6px 0 0 16px", color: "#b91c1c" }, children: importResult.errors.slice(0, 10).map((err, idx) => (_jsxs("li", { children: [err.sheet, " fila ", err.row, ": ", err.message] }, `${err.sheet}-${err.row}-${idx}`))) }), importResult.errors.length > 10 && (_jsxs("div", { style: { color: "#b91c1c" }, children: ["...", importResult.errors.length - 10, " errores mas."] }))] }))] })), _jsxs("div", { style: { marginTop: 12 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }, children: [_jsx("div", { className: "section-title", style: { fontSize: 16 }, children: "Historial de importaciones" }), _jsx("button", { className: "button secondary", type: "button", onClick: loadImportHistory, disabled: importHistoryLoading, children: importHistoryLoading ? "Actualizando..." : "Actualizar historial" })] }), importHistory.length === 0 ? (_jsx("div", { style: { color: "#64748b", marginTop: 6 }, children: "No hay importaciones registradas." })) : (_jsx("div", { className: "table-wrap", style: { marginTop: 6 }, children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Fecha" }), _jsx("th", { children: "Modo" }), _jsx("th", { children: "Usuario" }), _jsx("th", { children: "Creados" }), _jsx("th", { children: "Actualizados" }), _jsx("th", { children: "Omitidos" }), _jsx("th", { children: "Errores" })] }) }), _jsx("tbody", { children: importHistory.slice(0, 10).map((row) => (_jsxs("tr", { children: [_jsx("td", { children: String(row.createdAt || "").slice(0, 19).replace("T", " ") }), _jsx("td", { children: row.mode }), _jsx("td", { children: row.createdByName || "-" }), _jsx("td", { children: row.summary?.created ? Object.values(row.summary.created).reduce((s, v) => s + Number(v || 0), 0) : 0 }), _jsx("td", { children: row.summary?.updated ? Object.values(row.summary.updated).reduce((s, v) => s + Number(v || 0), 0) : 0 }), _jsx("td", { children: row.summary?.skipped || 0 }), _jsx("td", { children: row.summary?.errorsCount || 0 })] }, row.id))) })] }) }))] })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }, children: [_jsx("input", { className: "input", placeholder: "Nombre del filtro", value: filterName, onChange: (e) => setFilterName(e.target.value) }), _jsx("button", { className: "button secondary", type: "button", onClick: saveCurrentFilter, children: "Guardar filtro" }), _jsxs("select", { className: "input", value: selectedFilterId, onChange: (e) => applySavedFilter(e.target.value), children: [_jsx("option", { value: "", children: "Filtros guardados" }), savedFilters.map((f) => (_jsx("option", { value: f.id, children: f.name }, f.id)))] }), _jsx("button", { className: "button secondary", type: "button", disabled: !selectedFilterId, onClick: deleteSavedFilter, children: "Eliminar filtro" })] }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.users.loadError, message: loadError, onDismiss: () => setLoadError(""), style: { marginBottom: 8 } }), editingId && (_jsxs("form", { ref: editPanelRef, className: "card", onSubmit: saveEdit, style: { marginBottom: 8 }, children: [_jsx("div", { className: "section-title", children: "Editar usuario" }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.users.updateSuccess, message: editMessage, onDismiss: () => setEditMessage("") }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.users.updateError, message: editError, onDismiss: () => setEditError("") }), _jsxs("label", { children: ["Nombre", _jsx("input", { ref: editNameInputRef, className: "input", name: "editFullName", autoComplete: "name", value: editForm.fullName, onChange: (e) => setEditForm({ ...editForm, fullName: e.target.value }) })] }), _jsxs("label", { children: ["Correo", _jsx("input", { className: "input", name: "editEmail", autoComplete: "email", value: editForm.email, onChange: (e) => setEditForm({ ...editForm, email: e.target.value }) })] }), _jsxs("label", { children: ["Rol", _jsxs("select", { className: "input", value: editForm.role, onChange: (e) => setEditForm({ ...editForm, role: e.target.value }), children: [_jsx("option", { value: "ADMIN", children: "Administrador" }), canManageDeveloperUsers && _jsx("option", { value: "DEVELOPER", children: "Desarrollador" }), _jsx("option", { value: "TEACHER", children: "Docente" }), _jsx("option", { value: "PARENT", children: "Padre" })] })] }), _jsxs("label", { children: ["Nueva contrasena (opcional)", _jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { className: "input", name: "editPassword", autoComplete: "new-password", type: showEditPassword ? "text" : "password", value: editForm.password, onChange: (e) => setEditForm({ ...editForm, password: e.target.value }), placeholder: "Dejar en blanco para no cambiar" }), _jsx("button", { type: "button", className: "button secondary", onClick: () => setShowEditPassword((v) => !v), children: showEditPassword ? "Ocultar" : "Ver" })] }), editForm.password.trim() && _jsx(PasswordChecklist, { password: editForm.password })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 10 }, children: [_jsx("button", { className: "button", disabled: editBusy, children: editBusy ? "Guardando..." : "Guardar cambios" }), _jsx("button", { type: "button", className: "button secondary", onClick: () => {
                                    setEditingId("");
                                    setEditMessage("");
                                    setEditError("");
                                }, children: "Cancelar" })] })] })), _jsx(DataTable, { columns: [
                    { key: "name", label: "Nombre" },
                    { key: "email", label: "Correo" },
                    { key: "role", label: "Rol" },
                    { key: "status", label: "Estado" }
                ], rows: users.map((u) => ({
                    name: u.fullName,
                    email: u.email,
                    role: u.role,
                    status: u.isActive ? "ACTIVE" : "INACTIVE"
                })) }), _jsxs("div", { style: { marginTop: 8 }, children: [_jsx("div", { className: "section-title", style: { fontSize: 16, marginBottom: 8 }, children: "Editar y desactivar usuarios" }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: roleSections.map((section) => {
                            const sectionUsers = allUsersForSections.filter((u) => u.role === section.key);
                            const collapsed = collapsedByRole[section.key];
                            return (_jsxs("div", { className: "card", style: { padding: 10 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }, children: [_jsxs("div", { style: { fontWeight: 700 }, children: [section.label, " (", sectionUsers.length, ")"] }), _jsx("button", { type: "button", className: "button secondary", onClick: () => setCollapsedByRole((prev) => ({
                                                    ...prev,
                                                    [section.key]: !prev[section.key]
                                                })), children: collapsed ? "Desplegar" : "Ocultar" })] }), !collapsed && (_jsxs("ul", { style: { listStyle: "none", margin: "10px 0 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }, children: [sectionUsers.map((u) => (_jsxs("li", { className: "card", style: { display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", padding: 10 }, children: [_jsxs("div", { style: { color: "#6b7280", display: "flex", flexDirection: "column", gap: 4 }, children: [_jsxs("span", { children: [u.fullName, " (", u.email, ")"] }), u.role === "PARENT" && (_jsxs("div", { style: { fontSize: 12, color: "#334155", marginTop: 2 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("span", { children: (u.relatedStudents || []).length > 0
                                                                                    ? `Acudiente de ${(u.relatedStudents || []).length} estudiante(s).`
                                                                                    : "Acudiente de: sin estudiantes vinculados" }), (u.relatedStudents || []).length > 0 && (_jsx("button", { type: "button", className: "button secondary", style: { padding: "4px 8px", fontSize: 12 }, onClick: () => setExpandedParentById((prev) => ({
                                                                                    ...prev,
                                                                                    [u.id]: !prev[u.id]
                                                                                })), children: expandedParentById[u.id] ? "Ocultar detalle" : "Ver detalle" }))] }), expandedParentById[u.id] && (u.relatedStudents || []).length > 0 && (_jsx("div", { className: "table-wrap", style: { marginTop: 6 }, children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Estudiante" }), _jsx("th", { children: "Relacion" }), _jsx("th", { children: "Grado" }), _jsx("th", { children: "Grupo" }), _jsx("th", { children: "Ano" }), _jsx("th", { children: "Estado matricula" })] }) }), _jsx("tbody", { children: (u.relatedStudents || []).map((s) => (_jsxs("tr", { children: [_jsx("td", { children: s.studentName }), _jsx("td", { children: s.relation || "Acudiente" }), _jsx("td", { children: s.grade || "-" }), _jsx("td", { children: s.group || "-" }), _jsx("td", { children: s.year || "-" }), _jsx("td", { children: s.enrollmentStatus || "-" })] }, `${u.id}-${s.studentId}`))) })] }) }))] }))] }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }, children: [_jsx("button", { className: "button secondary", onClick: () => startEdit(u), children: "Editar" }), !u.isPrincipal && (_jsx("button", { className: "button secondary", onClick: () => toggleActive(u.id, u.isActive), children: u.isActive ? "Desactivar" : "Activar" })), _jsx("button", { className: "button danger", onClick: () => deleteUser(u.id, u.fullName, u.isPrincipal), disabled: !!u.isPrincipal || !canDeleteUsers, title: u.isPrincipal
                                                                    ? "El administrador principal no se puede eliminar"
                                                                    : !canDeleteUsers
                                                                        ? "Solo el administrador principal puede eliminar usuarios"
                                                                        : "", children: "Eliminar" })] })] }, u.id))), sectionUsers.length === 0 && (_jsx("li", { style: { color: "#6b7280", padding: "4px 2px" }, children: "Sin usuarios en esta seccion." }))] }))] }, section.key));
                        }) })] }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: page <= 1, onClick: () => setPage(page - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", page, " de ", Math.max(1, Math.ceil(total / 10))] }), _jsx("button", { className: "button secondary", disabled: page >= Math.ceil(total / 10), onClick: () => setPage(page + 1), children: "Siguiente" })] })] }));
}
