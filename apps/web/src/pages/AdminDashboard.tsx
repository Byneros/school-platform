import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import KpiCard from "../components/KpiCard";
import Section from "../components/Section";
import { apiDelete, apiDownload, apiGet, apiPatch } from "../services/api";
import { gradeLabel, gradeOptions } from "../services/grades";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Array<{ id: string; fullName: string; gradeLevel: string; studentGroup?: string | null; isActive: boolean }>>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [globalStudents, setGlobalStudents] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  const [pendingAdmissions, setPendingAdmissions] = useState(0);
  const [pendingInvoices, setPendingInvoices] = useState(0);
  const [pendingNotifications, setPendingNotifications] = useState(0);
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
  const groupOptionsForGrade = (gradeLevel: string) =>
    preschoolGrades.has(gradeLevel) ? ["A", "B", "C"] : ["1", "2", "3"];

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
        if (!active) return;
        setStudents(res.data || []);
        setTotalStudents(res.total || 0);
      })
      .catch(() => {
        if (!active) return;
        setError("No se pudo cargar estudiantes");
      })
      .finally(() => {
        if (!active) return;
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
      apiGet("/notifications?page=1&pageSize=1&status=PENDING")
    ])
      .then(([studentsRes, usersRes, admissionsRes, invoicesRes, notificationsRes]) => {
        if (!active) return;
        setGlobalStudents(Number(studentsRes?.total || 0));
        setUsersTotal(Number(usersRes?.total || 0));
        setPendingAdmissions(Number(admissionsRes?.total || 0));
        setPendingInvoices(Number(invoicesRes?.total || 0));
        setPendingNotifications(Number(notificationsRes?.total || 0));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));

  const downloadStudents = async (type: "csv" | "pdf") => {
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

  const startEdit = (student: { id: string; fullName: string; gradeLevel: string; studentGroup?: string | null; isActive: boolean }) => {
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

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
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
    } catch (err: any) {
      setEditError(err?.message || "No se pudo actualizar el estudiante");
    } finally {
      setEditBusy(false);
    }
  };

  const deleteStudent = async (id: string, fullName: string) => {
    const confirmed = window.confirm(`Eliminar estudiante ${fullName}? Esta accion no se puede deshacer.`);
    if (!confirmed) return;
    setError("");
    try {
      await apiDelete(`/students/${id}`);
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setTotalStudents((prev) => Math.max(0, prev - 1));
      setGlobalStudents((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      setError(err?.message || "No se pudo eliminar el estudiante");
    }
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="card">
        <div className="section-head">
          <div>
            <div className="section-title">Panel Administrador</div>
            <div style={{ color: "#6b7280" }}>Accesos rapidos a gestion academica, personal y finanzas.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button secondary" onClick={() => navigate("/admin/admisiones")}>Nueva admision</button>
            <button className="button" onClick={() => navigate("/admin/usuarios")}>Crear usuario</button>
            <button className="button secondary" onClick={() => navigate("/admin/notificaciones")}>Notificaciones</button>
            <button className="button secondary" onClick={() => navigate("/admin/finanzas")}>Finanzas</button>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <KpiCard title="Estudiantes registrados" value={String(globalStudents)} trend="Total del sistema" tone="primary" />
        <KpiCard title="Usuarios" value={String(usersTotal)} trend="Activos e inactivos" tone="success" />
        <KpiCard title="Admisiones pendientes" value={String(pendingAdmissions)} trend="Por aprobar" tone="warning" />
        <KpiCard title="Pendientes (finanzas y avisos)" value={String(pendingInvoices + pendingNotifications)} trend={`${pendingInvoices} facturas, ${pendingNotifications} notificaciones`} tone="danger" />
      </div>

      <Section title="Estudiantes (paginacion server-side)">
        <div className="help-card">
          Consejo: usa la busqueda por nombre o grado para ubicar rapido a un estudiante.
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          <input
            className="input"
            placeholder="Buscar por nombre o grado"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="input"
            value={gradeFilter}
            onChange={(e) => {
              setGradeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los niveles</option>
            {gradeOptions.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
          <div style={{ minWidth: 140, alignSelf: "center", color: "#64748b" }}>
            {totalStudents} resultados
          </div>
          <button className="button secondary" type="button" onClick={() => downloadStudents("pdf")}>
            Exportar PDF
          </button>
          <button className="button secondary" type="button" onClick={() => downloadStudents("csv")}>
            Exportar Excel
          </button>
        </div>
        {editingId && (
          <form className="card" onSubmit={saveEdit} style={{ marginBottom: 10 }}>
            <div className="section-title">Editar estudiante</div>
            {editError && <div style={{ color: "#b91c1c", marginBottom: 8 }}>{editError}</div>}
            <label>
              Nombre
              <input className="input" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
            </label>
            <label>
              Grado
              <select
                className="input"
                value={editForm.gradeLevel}
                onChange={(e) => {
                  const gradeLevel = e.target.value;
                  const groups = groupOptionsForGrade(gradeLevel);
                  setEditForm({ ...editForm, gradeLevel, studentGroup: groups[0] });
                }}
              >
                {gradeOptions.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </label>
            <label>
              Grupo
              <select className="input" value={editForm.studentGroup} onChange={(e) => setEditForm({ ...editForm, studentGroup: e.target.value })}>
                {groupOptionsForGrade(editForm.gradeLevel).map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select className="input" value={editForm.isActive ? "ACTIVE" : "INACTIVE"} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "ACTIVE" })}>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
              </select>
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="button" disabled={editBusy}>{editBusy ? "Guardando..." : "Guardar cambios"}</button>
              <button className="button secondary" type="button" onClick={() => setEditingId("")}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Grado</th>
                <th>Grupo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="table-empty">Cargando...</td></tr>
              )}
              {!loading && error && (
                <tr><td colSpan={5} className="table-empty">{error}</td></tr>
              )}
              {!loading && !error && students.length === 0 && (
                <tr><td colSpan={5} className="table-empty">Sin datos</td></tr>
              )}
              {!loading && !error && students.map((s) => (
                <tr key={s.id}>
                  <td>{s.fullName}</td>
                  <td>{gradeLabel(s.gradeLevel)}</td>
                  <td>{s.studentGroup || "-"}</td>
                  <td>
                    <span className={`status-badge ${s.isActive ? "status-active" : "status-inactive"}`}>
                      {s.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
                      <button className="button secondary" type="button" onClick={() => startEdit(s)}>
                        Editar
                      </button>
                      <button className="button danger" type="button" onClick={() => deleteStudent(s.id, s.fullName)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          <button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <div style={{ alignSelf: "center", color: "#64748b" }}>
            Pagina {page} de {totalPages}
          </div>
          <button className="button secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Siguiente
          </button>
        </div>
      </Section>

    </div>
  );
}
