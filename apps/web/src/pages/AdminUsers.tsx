import React, { useEffect, useRef, useState } from "react";
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

function isStrongPassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function passwordRules(password: string) {
  return [
    { label: "Minimo 8 caracteres", ok: password.length >= 8 },
    { label: "Al menos una mayuscula (A-Z)", ok: /[A-Z]/.test(password) },
    { label: "Al menos una minuscula (a-z)", ok: /[a-z]/.test(password) },
    { label: "Al menos un numero (0-9)", ok: /[0-9]/.test(password) },
    { label: "Al menos un simbolo (!@#$...)", ok: /[^A-Za-z0-9]/.test(password) }
  ];
}

function PasswordChecklist({ password }: { password: string }) {
  const rules = passwordRules(password);
  const passed = rules.filter((r) => r.ok).length;
  const strength =
    passed <= 2
      ? { label: "Debil", color: "#dc2626", width: "33%" }
      : passed <= 4
      ? { label: "Media", color: "#d97706", width: "66%" }
      : { label: "Fuerte", color: "#15803d", width: "100%" };
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
        <span>Fortaleza de contrasena</span>
        <span style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</span>
      </div>
      <div style={{ width: "100%", height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden", marginBottom: 6 }}>
        <div style={{ width: strength.width, height: "100%", background: strength.color, transition: "width .2s ease" }} />
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#64748b", display: "grid", gap: 2 }}>
        {rules.map((rule) => (
          <li key={rule.label} style={{ color: rule.ok ? "#15803d" : "#64748b" }}>
            {rule.ok ? "✅" : "❌"} {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminUsers() {
  const { user } = useAuth();
  const canManageDeveloperUsers = user?.role === "DEVELOPER";
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<
    Array<{
      id: string;
      email: string;
      role: string;
      fullName: string;
      isActive: boolean;
      isPrincipal?: boolean;
      relatedStudents?: Array<{
        studentId: string;
        studentName: string;
        relation: string;
        grade: string;
        group: string;
        year: number;
        enrollmentStatus: string;
      }>;
    }>
  >([]);
  const [allUsersForSections, setAllUsersForSections] = useState<
    Array<{
      id: string;
      email: string;
      role: string;
      fullName: string;
      isActive: boolean;
      isPrincipal?: boolean;
      relatedStudents?: Array<{
        studentId: string;
        studentName: string;
        relation: string;
        grade: string;
        group: string;
        year: number;
        enrollmentStatus: string;
      }>;
    }>
  >([]);
  const [pendingParentUsers, setPendingParentUsers] = useState<
    Array<{
      guardianFullName: string;
      guardianDocNumber: string;
      contactEmail: string;
      relation: string;
      studentsCount: number;
      students: Array<{ studentId: string; studentName: string; grade: string; group: string }>;
    }>
  >([]);
  const [pendingParentLoading, setPendingParentLoading] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", role: "ADMIN", password: "", teacherSubjects: [] as string[] });
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
  const [collapsedByRole, setCollapsedByRole] = useState<Record<"ADMIN" | "TEACHER" | "PARENT" | "DEVELOPER", boolean>>({
    ADMIN: false,
    TEACHER: false,
    PARENT: false,
    DEVELOPER: false
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMode, setImportMode] = useState<"validate" | "import">("validate");
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [importHistory, setImportHistory] = useState<Array<any>>([]);
  const [importHistoryLoading, setImportHistoryLoading] = useState(false);
  const [expandedParentById, setExpandedParentById] = useState<Record<string, boolean>>({});
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
  const [savedFilters, setSavedFilters] = useState<Array<{ id: string; name: string; roleFilter: string; search: string }>>([]);
  const [filterName, setFilterName] = useState("");
  const [selectedFilterId, setSelectedFilterId] = useState("");
  const [canDeleteUsers, setCanDeleteUsers] = useState(false);
  const [loadError, setLoadError] = useState("");
  const createPanelRef = useRef<HTMLFormElement | null>(null);
  const createNameInputRef = useRef<HTMLInputElement | null>(null);
  const editPanelRef = useRef<HTMLFormElement | null>(null);
  const editNameInputRef = useRef<HTMLInputElement | null>(null);
  const userSearchOptions = useSuggestions({
    endpoint: "/suggestions?type=users",
    query: search
  });

  useEffect(() => {
    const next = new URLSearchParams();
    if (page > 1) next.set("page", String(page));
    if (roleFilter) next.set("role", roleFilter);
    if (search) next.set("search", search);
    setSearchParams(next, { replace: true });
  }, [page, roleFilter, search, setSearchParams]);

  useEffect(() => {
    const raw = localStorage.getItem("admin_users_filters");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedFilters(parsed);
      }
    } catch {
      setSavedFilters([]);
    }
  }, []);

  const persistFilters = (next: Array<{ id: string; name: string; roleFilter: string; search: string }>) => {
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

  const applySavedFilter = (id: string) => {
    setSelectedFilterId(id);
    const selected = savedFilters.find((f) => f.id === id);
    if (!selected) return;
    setRoleFilter(selected.roleFilter);
    setSearch(selected.search);
    setPage(1);
  };

  const deleteSavedFilter = () => {
    if (!selectedFilterId) return;
    const next = savedFilters.filter((f) => f.id !== selectedFilterId);
    persistFilters(next);
    setSelectedFilterId("");
  };

  const load = () =>
    apiGet(`/users?page=${page}&pageSize=10${roleFilter ? `&role=${roleFilter}` : ""}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`)
      .then((res) => {
        setLoadError("");
        const data = res.data || [];
        setUsers(data);
        setTotal(res.total || 0);
        setCanDeleteUsers(Boolean(res.canDelete));
      })
      .catch((error: any) => {
        setLoadError(error?.message || "No se pudieron cargar los usuarios.");
      });

  const loadAllForSections = () =>
    apiGet(`/users?page=1&pageSize=500${roleFilter ? `&role=${roleFilter}` : ""}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`)
      .then((res) => {
        setAllUsersForSections(res.data || []);
      })
      .catch(() => undefined);

  const loadPendingParentUsers = () =>
    (setPendingParentLoading(true),
    apiGet("/users/parents/pending-account")
      .then((res) => setPendingParentUsers(res.data || []))
      .catch(() => setPendingParentUsers([]))
      .finally(() => setPendingParentLoading(false)));

  const loadImportHistory = async () => {
    setImportHistoryLoading(true);
    try {
      const res = await apiGet("/reports/import-template/history");
      setImportHistory(res?.data || []);
    } catch {
      setImportHistory([]);
    } finally {
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
    if (!editingId) return;
    requestAnimationFrame(() => {
      editPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      editNameInputRef.current?.focus();
    });
  }, [editingId]);

  const create = async (e: React.FormEvent) => {
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
    } catch (error: any) {
      setCreateError(error?.message || "No se pudo crear el usuario.");
    }
  };

  const usePendingGuardianForCreate = (guardian: {
    guardianFullName: string;
    contactEmail: string;
  }) => {
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

  const toggleActive = async (id: string, isActive: boolean) => {
    setToggleError("");
    setToggleMessage("");
    try {
      const updated = await apiPatch(`/users/${id}`, { isActive: !isActive });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
      setAllUsersForSections((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
      setToggleMessage(isActive ? "Usuario desactivado satisfactoriamente." : "Usuario activado satisfactoriamente.");
    } catch (error: any) {
      setToggleError(error?.message || "No se pudo actualizar el usuario");
    }
  };

  const startEdit = (user: { id: string; fullName: string; email: string; role: string }) => {
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

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setEditBusy(true);
    setEditError("");
    setEditMessage("");
    try {
      const body: Record<string, unknown> = {
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
    } catch (error: any) {
      setEditError(error?.message || "No se pudo editar el usuario");
    } finally {
      setEditBusy(false);
    }
  };

  const deleteUser = async (id: string, fullName: string, isPrincipal?: boolean) => {
    if (isPrincipal || !canDeleteUsers) {
      setDeleteError("Solo el administrador principal puede eliminar usuarios.");
      return;
    }
    const confirmed = window.confirm(`Eliminar usuario ${fullName}? Esta accion no se puede deshacer.`);
    if (!confirmed) return;
    setDeleteError("");
    setDeleteMessage("");
    try {
      const res = await apiDelete(`/users/${id}`);
      if (res?.deactivated && res?.user) {
        setUsers((prev) => prev.map((u) => (u.id === res.user.id ? { ...u, ...res.user } : u)));
        setAllUsersForSections((prev) => prev.map((u) => (u.id === res.user.id ? { ...u, ...res.user } : u)));
        setDeleteMessage(res?.message || "Usuario desactivado.");
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        setAllUsersForSections((prev) => prev.filter((u) => u.id !== id));
        setDeleteMessage("Usuario eliminado satisfactoriamente.");
      }
      loadPendingParentUsers();
    } catch (error: any) {
      setDeleteError(error?.message || "No se pudo eliminar el usuario");
    }
  };

  const downloadFile = async (path: string, filename: string) => {
    const blob = await apiDownload(path);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
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
    } catch (error: any) {
      setImportError(error?.message || "No se pudo procesar la importacion.");
    } finally {
      setImportBusy(false);
    }
  };

  const roleSections: Array<{ key: "ADMIN" | "TEACHER" | "PARENT" | "DEVELOPER"; label: string }> = [
    { key: "ADMIN", label: "Administradores" },
    ...(canManageDeveloperUsers ? [{ key: "DEVELOPER" as const, label: "Desarrolladores" }] : []),
    { key: "TEACHER", label: "Docentes" },
    { key: "PARENT", label: "Padres de familia" }
  ];

  return (
    <Section title="Usuarios">
      <div className="help-card">
        Gestiona usuarios, roles y accesos desde el panel principal.
      </div>
      <ActionFeedback
        tone="success"
        title={feedbackTitles.users.createSuccess}
        message={createMessage}
        onDismiss={() => setCreateMessage("")}
      />
      <ActionFeedback
        tone="error"
        title={feedbackTitles.users.createError}
        message={createError}
        onDismiss={() => setCreateError("")}
      />
      <ActionFeedback
        tone="success"
        title={feedbackTitles.users.deleteSuccess}
        message={deleteMessage}
        onDismiss={() => setDeleteMessage("")}
      />
      <ActionFeedback
        tone="error"
        title={feedbackTitles.users.deleteError}
        message={deleteError}
        onDismiss={() => setDeleteError("")}
      />
      <ActionFeedback
        tone="success"
        title={feedbackTitles.users.toggleSuccess}
        message={toggleMessage}
        onDismiss={() => setToggleMessage("")}
      />
      <ActionFeedback
        tone="error"
        title={feedbackTitles.users.toggleError}
        message={toggleError}
        onDismiss={() => setToggleError("")}
      />
      <form ref={createPanelRef} className="card" onSubmit={create}>
        <div className="section-title">Crear usuario</div>
        <label>
          Nombre
          <input
            ref={createNameInputRef}
            className="input"
            name="fullName"
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </label>
        <label>
          Correo
          <input
            className="input"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          Rol
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, teacherSubjects: e.target.value === "TEACHER" ? form.teacherSubjects : [] })}>
            <option value="ADMIN">Administrador</option>
            {canManageDeveloperUsers && <option value="DEVELOPER">Desarrollador</option>}
            <option value="TEACHER">Docente</option>
            <option value="PARENT">Padre</option>
          </select>
        </label>
        {form.role === "TEACHER" && (
          <label>
            Asignaturas del docente
            <div className="card" style={{ boxShadow: "none", padding: 10, marginTop: 6 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                {teacherSubjectOptions.map((subject) => {
                  const checked = form.teacherSubjects.includes(subject);
                  return (
                    <label key={subject} style={{ display: "flex", gap: 8, alignItems: "center", color: "#334155" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            teacherSubjects: e.target.checked
                              ? [...prev.teacherSubjects, subject]
                              : prev.teacherSubjects.filter((s) => s !== subject)
                          }))
                        }
                      />
                      {subject}
                    </label>
                  );
                })}
              </div>
            </div>
          </label>
        )}
        <label>
          Contrasena temporal
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="input"
                name="newPassword"
                autoComplete="new-password"
                type={showCreatePassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button type="button" className="button secondary" onClick={() => setShowCreatePassword((v) => !v)}>
              {showCreatePassword ? "Ocultar" : "Ver"}
            </button>
          </div>
          <PasswordChecklist password={form.password} />
        </label>
        <button className="button" style={{ marginTop: 10 }}>Crear</button>
      </form>
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="section-title" style={{ marginBottom: 8 }}>
          Acudientes con estudiantes matriculados sin usuario ({pendingParentUsers.length})
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {pendingParentLoading && <span style={{ color: "#64748b", fontSize: 12 }}>Actualizando...</span>}
          <button className="button secondary" type="button" onClick={loadPendingParentUsers} disabled={pendingParentLoading}>
            {pendingParentLoading ? "Actualizando..." : "Actualizar lista"}
          </button>
        </div>
        {pendingParentUsers.length === 0 ? (
          <div style={{ color: "#64748b" }}>No hay acudientes pendientes de crear usuario.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Acudiente</th>
                  <th>Correo</th>
                  <th>Documento</th>
                  <th>Estudiantes matriculados</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {pendingParentUsers.map((row, idx) => (
                  <tr
                    key={`${row.guardianDocNumber || row.contactEmail || row.guardianFullName}-${idx}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => usePendingGuardianForCreate(row)}
                    title="Clic para cargar en Crear usuario"
                  >
                    <td>{row.guardianFullName || "-"}</td>
                    <td>{row.contactEmail || "Sin correo"}</td>
                    <td>{row.guardianDocNumber || "-"}</td>
                    <td>
                      {row.students.map((s) => `${s.studentName} (${s.grade || "-"}-${s.group || "-"})`).join(", ")}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          usePendingGuardianForCreate(row);
                        }}
                        style={{ padding: "4px 8px", fontSize: 12 }}
                      >
                        Usar en formulario
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <Autocomplete
          className="input input-search"
          placeholder="Buscar por nombre o correo"
          value={search}
          options={userSearchOptions}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <select className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">Todos los roles</option>
          <option value="ADMIN">Administrador</option>
          {canManageDeveloperUsers && <option value="DEVELOPER">Desarrollador</option>}
          <option value="TEACHER">Docente</option>
          <option value="PARENT">Padre</option>
        </select>
        <button className="button secondary" type="button" onClick={() => downloadFile("/users/export/excel", "users-report.xlsx")}>
          Exportar Excel
        </button>
        <button className="button secondary" type="button" onClick={() => downloadFile("/users/export/pdf", "users.pdf")}>
          Exportar PDF
        </button>
        <button className="button secondary" type="button" onClick={() => downloadFile("/reports/import-template/excel", "plantilla-importacion.xlsx")}>
          Plantilla importacion
        </button>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title">Importar datos desde Excel</div>
        <div style={{ color: "#64748b", marginBottom: 8 }}>
          Usa la plantilla oficial. Primero valida y luego importa si todo esta correcto.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          />
          <select className="input" value={importMode} onChange={(e) => setImportMode(e.target.value as "validate" | "import")}>
            <option value="validate">Solo validar</option>
            <option value="import">Importar</option>
          </select>
          <button className="button" type="button" onClick={runImport} disabled={importBusy}>
            {importBusy ? "Procesando..." : importMode === "import" ? "Importar" : "Validar"}
          </button>
        </div>
        <ActionFeedback
          tone="error"
          title={feedbackTitles.users.importError}
          message={importError}
          onDismiss={() => setImportError("")}
          style={{ marginTop: 8 }}
        />
        {importResult && (
          <div style={{ marginTop: 8, color: "#334155" }}>
            <div>Modo: {importResult.mode}</div>
            <div>
              Creados: usuarios {importResult.created?.users || 0}, docentes {importResult.created?.teachers || 0}, padres {importResult.created?.parents || 0}, estudiantes {importResult.created?.students || 0}, clases {importResult.created?.classes || 0}, matriculas {importResult.created?.enrollments || 0}
            </div>
            <div>
              Actualizados: usuarios {importResult.updated?.users || 0}, docentes {importResult.updated?.teachers || 0}, estudiantes {importResult.updated?.students || 0}, clases {importResult.updated?.classes || 0}, matriculas {importResult.updated?.enrollments || 0}
            </div>
            <div>Omitidos: {importResult.skipped || 0}</div>
            {importResult.defaultPasswordUsed && (
              <div style={{ color: "#9a3412" }}>Se uso contrasena temporal para algunos usuarios.</div>
            )}
            {Array.isArray(importResult.errors) && importResult.errors.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <strong>Errores:</strong>
                <ul style={{ margin: "6px 0 0 16px", color: "#b91c1c" }}>
                  {importResult.errors.slice(0, 10).map((err: any, idx: number) => (
                    <li key={`${err.sheet}-${err.row}-${idx}`}>
                      {err.sheet} fila {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
                {importResult.errors.length > 10 && (
                  <div style={{ color: "#b91c1c" }}>...{importResult.errors.length - 10} errores mas.</div>
                )}
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div className="section-title" style={{ fontSize: 16 }}>Historial de importaciones</div>
            <button className="button secondary" type="button" onClick={loadImportHistory} disabled={importHistoryLoading}>
              {importHistoryLoading ? "Actualizando..." : "Actualizar historial"}
            </button>
          </div>
          {importHistory.length === 0 ? (
            <div style={{ color: "#64748b", marginTop: 6 }}>
              No hay importaciones registradas.
            </div>
          ) : (
            <div className="table-wrap" style={{ marginTop: 6 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Modo</th>
                    <th>Usuario</th>
                    <th>Creados</th>
                    <th>Actualizados</th>
                    <th>Omitidos</th>
                    <th>Errores</th>
                  </tr>
                </thead>
                <tbody>
                  {importHistory.slice(0, 10).map((row) => (
                    <tr key={row.id}>
                      <td>{String(row.createdAt || "").slice(0, 19).replace("T", " ")}</td>
                      <td>{row.mode}</td>
                      <td>{row.createdByName || "-"}</td>
                      <td>{row.summary?.created ? Object.values(row.summary.created).reduce((s: any, v: any) => s + Number(v || 0), 0) : 0}</td>
                      <td>{row.summary?.updated ? Object.values(row.summary.updated).reduce((s: any, v: any) => s + Number(v || 0), 0) : 0}</td>
                      <td>{row.summary?.skipped || 0}</td>
                      <td>{row.summary?.errorsCount || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Nombre del filtro"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
        />
        <button className="button secondary" type="button" onClick={saveCurrentFilter}>
          Guardar filtro
        </button>
        <select className="input" value={selectedFilterId} onChange={(e) => applySavedFilter(e.target.value)}>
          <option value="">Filtros guardados</option>
          {savedFilters.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <button className="button secondary" type="button" disabled={!selectedFilterId} onClick={deleteSavedFilter}>
          Eliminar filtro
        </button>
      </div>
      <ActionFeedback
        tone="error"
        title={feedbackTitles.users.loadError}
        message={loadError}
        onDismiss={() => setLoadError("")}
        style={{ marginBottom: 8 }}
      />
      {editingId && (
        <form ref={editPanelRef} className="card" onSubmit={saveEdit} style={{ marginBottom: 8 }}>
          <div className="section-title">Editar usuario</div>
          <ActionFeedback
            tone="success"
            title={feedbackTitles.users.updateSuccess}
            message={editMessage}
            onDismiss={() => setEditMessage("")}
          />
          <ActionFeedback
            tone="error"
            title={feedbackTitles.users.updateError}
            message={editError}
            onDismiss={() => setEditError("")}
          />
          <label>
            Nombre
            <input
              ref={editNameInputRef}
              className="input"
              name="editFullName"
              autoComplete="name"
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            />
          </label>
          <label>
            Correo
            <input
              className="input"
              name="editEmail"
              autoComplete="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </label>
          <label>
          Rol
          <select className="input" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
            <option value="ADMIN">Administrador</option>
            {canManageDeveloperUsers && <option value="DEVELOPER">Desarrollador</option>}
            <option value="TEACHER">Docente</option>
            <option value="PARENT">Padre</option>
          </select>
          </label>
          <label>
            Nueva contrasena (opcional)
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="input"
                name="editPassword"
                autoComplete="new-password"
                type={showEditPassword ? "text" : "password"}
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Dejar en blanco para no cambiar"
              />
              <button type="button" className="button secondary" onClick={() => setShowEditPassword((v) => !v)}>
                {showEditPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
            {editForm.password.trim() && <PasswordChecklist password={editForm.password} />}
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="button" disabled={editBusy}>
              {editBusy ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setEditingId("");
                setEditMessage("");
                setEditError("");
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <DataTable
        columns={[
          { key: "name", label: "Nombre" },
          { key: "email", label: "Correo" },
          { key: "role", label: "Rol" },
          { key: "status", label: "Estado" }
        ]}
        rows={users.map((u) => ({
          name: u.fullName,
          email: u.email,
          role: u.role,
          status: u.isActive ? "ACTIVE" : "INACTIVE"
        }))}
      />
      <div style={{ marginTop: 8 }}>
        <div className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>Editar y desactivar usuarios</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {roleSections.map((section) => {
            const sectionUsers = allUsersForSections.filter((u) => u.role === section.key);
            const collapsed = collapsedByRole[section.key];
            return (
              <div key={section.key} className="card" style={{ padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>
                    {section.label} ({sectionUsers.length})
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      setCollapsedByRole((prev) => ({
                        ...prev,
                        [section.key]: !prev[section.key]
                      }))
                    }
                  >
                    {collapsed ? "Desplegar" : "Ocultar"}
                  </button>
                </div>
                {!collapsed && (
                  <ul style={{ listStyle: "none", margin: "10px 0 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {sectionUsers.map((u) => (
                      <li key={u.id} className="card" style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", padding: 10 }}>
                        <div style={{ color: "#6b7280", display: "flex", flexDirection: "column", gap: 4 }}>
                          <span>{u.fullName} ({u.email})</span>
                          {u.role === "PARENT" && (
                            <div style={{ fontSize: 12, color: "#334155", marginTop: 2 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span>
                                  {(u.relatedStudents || []).length > 0
                                    ? `Acudiente de ${(u.relatedStudents || []).length} estudiante(s).`
                                    : "Acudiente de: sin estudiantes vinculados"}
                                </span>
                                {(u.relatedStudents || []).length > 0 && (
                                  <button
                                    type="button"
                                    className="button secondary"
                                    style={{ padding: "4px 8px", fontSize: 12 }}
                                    onClick={() =>
                                      setExpandedParentById((prev) => ({
                                        ...prev,
                                        [u.id]: !prev[u.id]
                                      }))
                                    }
                                  >
                                    {expandedParentById[u.id] ? "Ocultar detalle" : "Ver detalle"}
                                  </button>
                                )}
                              </div>
                              {expandedParentById[u.id] && (u.relatedStudents || []).length > 0 && (
                                <div className="table-wrap" style={{ marginTop: 6 }}>
                                  <table className="table">
                                    <thead>
                                      <tr>
                                        <th>Estudiante</th>
                                        <th>Relacion</th>
                                        <th>Grado</th>
                                        <th>Grupo</th>
                                        <th>Ano</th>
                                        <th>Estado matricula</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(u.relatedStudents || []).map((s) => (
                                        <tr key={`${u.id}-${s.studentId}`}>
                                          <td>{s.studentName}</td>
                                          <td>{s.relation || "Acudiente"}</td>
                                          <td>{s.grade || "-"}</td>
                                          <td>{s.group || "-"}</td>
                                          <td>{s.year || "-"}</td>
                                          <td>{s.enrollmentStatus || "-"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
                          <button
                            className="button secondary"
                            onClick={() => startEdit(u)}
                          >
                            Editar
                          </button>
                          {!u.isPrincipal && (
                            <button
                              className="button secondary"
                              onClick={() => toggleActive(u.id, u.isActive)}
                            >
                              {u.isActive ? "Desactivar" : "Activar"}
                            </button>
                          )}
                          <button
                            className="button danger"
                            onClick={() => deleteUser(u.id, u.fullName, u.isPrincipal)}
                            disabled={!!u.isPrincipal || !canDeleteUsers}
                            title={
                              u.isPrincipal
                                ? "El administrador principal no se puede eliminar"
                                : !canDeleteUsers
                                ? "Solo el administrador principal puede eliminar usuarios"
                                : ""
                            }
                          >
                            Eliminar
                          </button>
                        </div>
                      </li>
                    ))}
                    {sectionUsers.length === 0 && (
                      <li style={{ color: "#6b7280", padding: "4px 2px" }}>Sin usuarios en esta seccion.</li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
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
