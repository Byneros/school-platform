import React, { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import ActionFeedback from "../components/ActionFeedback";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "../services/api";
import { gradeLabel } from "../services/grades";

const PERIODS = ["P1", "P2", "P3", "P4"];
const ASPECTS = [
  { value: "COGNITIVE", label: "Cognitivo" },
  { value: "PERSONAL", label: "Personal" },
  { value: "SOCIAL", label: "Social" }
];
const GRADE_ORDER: Record<string, number> = {
  PRE_JARDIN: 1,
  JARDIN: 2,
  TRANSICION: 3,
  PRIMERO: 4,
  SEGUNDO: 5,
  TERCERO: 6,
  CUARTO: 7,
  QUINTO: 8,
  SEXTO: 9,
  SEPTIMO: 10,
  OCTAVO: 11,
  NOVENO: 12,
  DECIMO: 13,
  ONCE: 14
};

function normalizeGradeKey(value: string) {
  return String(value || "").trim().toUpperCase();
}

function sortGradesAcademic(values: string[]) {
  return [...values].sort((a, b) => {
    const oa = GRADE_ORDER[normalizeGradeKey(a)] ?? 999;
    const ob = GRADE_ORDER[normalizeGradeKey(b)] ?? 999;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b, "es", { numeric: true });
  });
}

type EnrollmentRow = {
  enrollmentId: string;
  studentId: string;
  fullName: string;
  grade: string;
  group: string;
};

type TaskRow = {
  id: string;
  title: string;
  aspect: string;
  maxScore: number;
  period: string;
  createdAt?: string;
};

type ScoreRow = {
  id: string;
  taskId: string;
  enrollmentId: string;
  score: number | null;
};

export default function TeacherTasks() {
  const [enrollments, setEnrollments] = useState<Array<any>>([]);
  const [gradeOptions, setGradeOptions] = useState<string[]>([]);
  const [groupOptions, setGroupOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [gradeLevel, setGradeLevel] = useState("");
  const [group, setGroup] = useState("");
  const [period, setPeriod] = useState("P1");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [students, setStudents] = useState<EnrollmentRow[]>([]);
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});
  const [dirtyScores, setDirtyScores] = useState<Record<string, boolean>>({});
  const [taskForm, setTaskForm] = useState({ title: "", aspect: "COGNITIVE", maxScore: "5" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [weights, setWeights] = useState({
    cognitiveWeight: "60",
    personalWeight: "20",
    socialWeight: "20"
  });
  const [weightsMsg, setWeightsMsg] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState({ title: "", aspect: "COGNITIVE", maxScore: "5", period: "P1" });
  const [editingMessage, setEditingMessage] = useState("");
  const [editingError, setEditingError] = useState("");
  const [finalSummary, setFinalSummary] = useState<Array<any>>([]);
  const [finalSummaryError, setFinalSummaryError] = useState("");

  const totalWeight =
    Number(weights.cognitiveWeight || 0) +
    Number(weights.personalWeight || 0) +
    Number(weights.socialWeight || 0);

  useEffect(() => {
    Promise.all([apiGet("/teacher/enrollments"), apiGet("/teacher/profile")])
      .then(([enrollmentsRes, profileRes]) => {
        const list = Array.isArray(enrollmentsRes) ? enrollmentsRes : [];
        setEnrollments(list);
        const grades = Array.from(
          new Set(
            list
              .map((e: any) => String(e.grade || e.class?.gradeLevel || "").trim())
              .filter(Boolean)
          )
        );
        setGradeOptions(sortGradesAcademic(grades));
        setWeights({
          cognitiveWeight: String(profileRes?.cognitiveWeight ?? 60),
          personalWeight: String(profileRes?.personalWeight ?? 20),
          socialWeight: String(profileRes?.socialWeight ?? 20)
        });
      })
      .catch(() => setEnrollments([]));
  }, []);

  useEffect(() => {
    if (!gradeLevel) {
      setGroupOptions([]);
      setGroup("");
      setTasks([]);
      setStudents([]);
      setScores({});
      setDirtyScores({});
      return;
    }
    const groups = Array.from(
      new Set(
        enrollments
          .filter((e: any) => String(e.grade || e.class?.gradeLevel || "").trim() === gradeLevel)
          .map((e: any) => String(e.group || e.student?.studentGroup || "").trim())
      )
    );
    const options = groups.map((g) => ({
      value: g,
      label: g ? `Grupo ${g}` : "Sin grupo"
    }));
    setGroupOptions(options);
    if (options.length > 0) {
      const nextGroup = options.some((opt) => opt.value === group) ? group : options[0].value;
      if (nextGroup !== group) setGroup(nextGroup);
    } else {
      setGroup("");
      setTasks([]);
      setStudents([]);
      setScores({});
      setDirtyScores({});
    }
  }, [gradeLevel, enrollments, group]);

  const loadBoard = async () => {
    if (!gradeLevel) return;
    setLoading(true);
    setError("");
    setMessage("");
    const groupParam = group ? group : "SIN_GRUPO";
    try {
      const res = await apiGet(
        `/teacher/tasks/board?gradeLevel=${encodeURIComponent(gradeLevel)}&group=${encodeURIComponent(
          groupParam
        )}&period=${encodeURIComponent(period)}`
      );
      const tasksList: TaskRow[] = Array.isArray(res?.tasks) ? res.tasks : [];
      const studentsList: EnrollmentRow[] = Array.isArray(res?.students) ? res.students : [];
      const scoresList: ScoreRow[] = Array.isArray(res?.scores) ? res.scores : [];

      const scoreMap: Record<string, Record<string, string>> = {};
      scoresList.forEach((s) => {
        if (!scoreMap[s.enrollmentId]) scoreMap[s.enrollmentId] = {};
        scoreMap[s.enrollmentId][s.taskId] = s.score === null || s.score === undefined ? "" : String(s.score);
      });

      setTasks(tasksList);
      setStudents(
        [...studentsList].sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), "es"))
      );
      setScores(scoreMap);
      setDirtyScores({});
    } catch (err: any) {
      setError(err?.message || "No se pudo cargar la tabla de tareas.");
      setTasks([]);
      setStudents([]);
      setScores({});
      setDirtyScores({});
    } finally {
      setLoading(false);
    }
  };

  const loadFinalSummary = async () => {
    if (!gradeLevel) {
      setFinalSummary([]);
      return;
    }
    setFinalSummaryError("");
    try {
      const groupParam = group ? group : "SIN_GRUPO";
      const query = `?period=${encodeURIComponent(period)}&gradeLevel=${encodeURIComponent(
        gradeLevel
      )}&group=${encodeURIComponent(groupParam)}`;
      const res = await apiGet(`/teacher/grades/final-summary${query}`);
      setFinalSummary(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setFinalSummaryError(err?.message || "No se pudo cargar la nota final ponderada.");
      setFinalSummary([]);
    }
  };

  useEffect(() => {
    if (!gradeLevel) return;
    if (groupOptions.length === 0) {
      setTasks([]);
      setStudents([]);
      setScores({});
      setDirtyScores({});
      return;
    }
    if (!groupOptions.some((opt) => opt.value === group)) return;
    loadBoard();
  }, [gradeLevel, group, period, groupOptions]);

  useEffect(() => {
    if (!gradeLevel) {
      setFinalSummary([]);
      return;
    }
    loadFinalSummary();
  }, [gradeLevel, group, period]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    if (!gradeLevel) {
      setError("Selecciona un grado para crear la tarea.");
      return;
    }
    if (!taskForm.title.trim()) {
      setError("Escribe el nombre de la tarea.");
      return;
    }
    const maxScore = Number(taskForm.maxScore);
    if (!Number.isFinite(maxScore) || maxScore < 0 || maxScore > 5) {
      setError("La nota maxima debe estar entre 0 y 5.");
      return;
    }
    try {
      await apiPost("/teacher/tasks", {
        gradeLevel,
        group: group || "SIN_GRUPO",
        period,
        title: taskForm.title.trim(),
        aspect: taskForm.aspect,
        maxScore
      });
      setTaskForm((prev) => ({ ...prev, title: "" }));
      setMessage("Tarea creada. Se enviaron notificaciones a los padres.");
      loadBoard();
    } catch (err: any) {
      setError(err?.message || "No se pudo crear la tarea.");
    }
  };

  const saveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    setWeightsMsg("");
    if (totalWeight !== 100) {
      setWeightsMsg("La ponderacion debe sumar exactamente 100%.");
      return;
    }
    try {
      await apiPut("/teacher/profile", {
        cognitiveWeight: Number(weights.cognitiveWeight),
        personalWeight: Number(weights.personalWeight),
        socialWeight: Number(weights.socialWeight)
      });
      setWeightsMsg("Ponderacion guardada.");
    } catch (error: any) {
      setWeightsMsg(error?.message || "No se pudo guardar la ponderacion");
    }
  };

  const startEditTask = (task: TaskRow) => {
    setEditingTaskId(task.id);
    setEditingForm({
      title: task.title,
      aspect: task.aspect,
      maxScore: String(task.maxScore),
      period: task.period || period
    });
    setEditingMessage("");
    setEditingError("");
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditingMessage("");
    setEditingError("");
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTaskId) return;
    setEditingMessage("");
    setEditingError("");
    if (!editingForm.title.trim()) {
      setEditingError("El nombre de la tarea es obligatorio.");
      return;
    }
    const maxScore = Number(editingForm.maxScore);
    if (!Number.isFinite(maxScore) || maxScore < 0 || maxScore > 5) {
      setEditingError("La nota maxima debe estar entre 0 y 5.");
      return;
    }
    try {
      await apiPatch(`/teacher/tasks/${editingTaskId}`, {
        title: editingForm.title.trim(),
        aspect: editingForm.aspect,
        maxScore,
        period: editingForm.period
      });
      setEditingMessage("Tarea actualizada.");
      setEditingTaskId(null);
      loadBoard();
    } catch (err: any) {
      setEditingError(err?.message || "No se pudo actualizar la tarea.");
    }
  };

  const deleteTask = async (task: TaskRow) => {
    const confirmed = window.confirm(
      `Eliminar la tarea "${task.title}"? Esta accion eliminara sus calificaciones asociadas.`
    );
    if (!confirmed) return;
    setError("");
    setMessage("");
    try {
      await apiDelete(`/teacher/tasks/${task.id}`);
      setMessage("Tarea eliminada.");
      if (editingTaskId === task.id) {
        setEditingTaskId(null);
      }
      loadBoard();
    } catch (err: any) {
      setError(err?.message || "No se pudo eliminar la tarea.");
    }
  };

  const setScoreValue = (enrollmentId: string, taskId: string, value: string) => {
    setScores((prev) => ({
      ...prev,
      [enrollmentId]: { ...(prev[enrollmentId] || {}), [taskId]: value }
    }));
    setDirtyScores((prev) => ({ ...prev, [`${enrollmentId}:${taskId}`]: true }));
  };

  const saveScores = async () => {
    const keys = Object.keys(dirtyScores).filter((k) => dirtyScores[k]);
    if (keys.length === 0) {
      setMessage("No hay cambios por guardar.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await Promise.all(
        keys.map(async (key) => {
          const [enrollmentId, taskId] = key.split(":");
          const rawValue = scores?.[enrollmentId]?.[taskId];
          if (rawValue === undefined || rawValue === "") return;
          const numeric = Number(rawValue);
          if (!Number.isFinite(numeric)) {
            throw new Error("Hay calificaciones invalidas.");
          }
          await apiPost("/teacher/tasks/score", {
            enrollmentId,
            taskId,
            score: numeric
          });
        })
      );
      setMessage("Calificaciones guardadas.");
      loadBoard();
    } catch (err: any) {
      setError(err?.message || "No se pudieron guardar las calificaciones.");
    } finally {
      setSaving(false);
    }
  };

  const selectedGroupLabel = useMemo(() => {
    const found = groupOptions.find((g) => g.value === group);
    return found ? found.label : group ? `Grupo ${group}` : "Sin grupo";
  }, [group, groupOptions]);

  const formatTaskDate = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  };

  const getAspectWeight = (aspect: string) => {
    if (aspect === "COGNITIVE") return Number(weights.cognitiveWeight || 0);
    if (aspect === "PERSONAL") return Number(weights.personalWeight || 0);
    if (aspect === "SOCIAL") return Number(weights.socialWeight || 0);
    return 0;
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      <Section title="Tareas y Calificaciones">
        <div className="help-card">
          Crea tareas para los grados asignados y registra calificaciones por estudiante.
        </div>
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <div className="grid grid-3">
            <label>
              Grado
              <select className="input" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
                <option value="">Selecciona un grado</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Grupo
              <select className="input" value={group} onChange={(e) => setGroup(e.target.value)} disabled={!gradeLevel}>
                {groupOptions.length === 0 && <option value="">Sin grupos</option>}
                {groupOptions.map((g) => (
                  <option key={`${g.value || "sin-grupo"}`} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Periodo
              <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {gradeLevel && (
            <div style={{ color: "#64748b" }}>
              Grupo seleccionado: <strong>{gradeLabel(gradeLevel)}</strong> · <strong>{selectedGroupLabel}</strong>
            </div>
          )}
        </div>
      </Section>

      <Section title="Nueva tarea">
        <form className="card" onSubmit={handleCreateTask}>
          <div className="grid grid-3">
            <label>
              Nombre de la tarea
              <input
                className="input"
                value={taskForm.title}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </label>
            <label>
              Aspecto
              <select
                className="input"
                value={taskForm.aspect}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, aspect: e.target.value }))}
              >
                {ASPECTS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nota maxima
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={5}
                  step="0.01"
                  value={taskForm.maxScore}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, maxScore: e.target.value }))}
                  style={{ maxWidth: 120 }}
                />
                <span style={{ color: "#64748b", minWidth: 20, textAlign: "right" }}>/5</span>
              </div>
            </label>
          </div>
          <div style={{ color: "#64748b", marginTop: 8 }}>
            Ponderacion aplicada: <strong>{getAspectWeight(taskForm.aspect)}%</strong> · Nota maxima 0–5
          </div>
          <ActionFeedback
            tone="error"
            title="Error en tareas"
            message={error}
            onDismiss={() => setError("")}
            style={{ marginTop: 8, marginBottom: 0 }}
          />
          <ActionFeedback
            tone="success"
            title="Accion completada"
            message={message}
            onDismiss={() => setMessage("")}
            style={{ marginTop: 8, marginBottom: 0 }}
          />
          <button className="button" style={{ marginTop: 10 }} disabled={!gradeLevel}>
            Crear tarea
          </button>
        </form>
      </Section>

      <Section title="Ponderacion de evaluacion">
        <form className="card" onSubmit={saveWeights}>
          <div className="grid grid-3">
            <label>
              Cognitivo (%)
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={weights.cognitiveWeight}
                onChange={(e) => setWeights({ ...weights, cognitiveWeight: e.target.value })}
              />
            </label>
            <label>
              Personal (%)
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={weights.personalWeight}
                onChange={(e) => setWeights({ ...weights, personalWeight: e.target.value })}
              />
            </label>
            <label>
              Social (%)
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={weights.socialWeight}
                onChange={(e) => setWeights({ ...weights, socialWeight: e.target.value })}
              />
            </label>
          </div>
          <div style={{ marginTop: 8, color: totalWeight === 100 ? "#15803d" : "#b45309", fontWeight: 600 }}>
            Total: {totalWeight}% {totalWeight === 100 ? "(OK)" : "(debe ser 100)"}
          </div>
          {weightsMsg && <div style={{ marginTop: 8, color: "#64748b" }}>{weightsMsg}</div>}
          <button className="button" style={{ marginTop: 10 }}>
            Guardar ponderacion
          </button>
        </form>
      </Section>

      {editingTaskId && (
        <Section title="Editar tarea">
          <form className="card" onSubmit={handleUpdateTask}>
            <div className="grid grid-3">
              <label>
                Nombre de la tarea
                <input
                  className="input"
                  value={editingForm.title}
                  onChange={(e) => setEditingForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </label>
              <label>
                Aspecto
                <select
                  className="input"
                  value={editingForm.aspect}
                  onChange={(e) => setEditingForm((prev) => ({ ...prev, aspect: e.target.value }))}
                >
                  {ASPECTS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nota maxima
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={5}
                    step="0.01"
                    value={editingForm.maxScore}
                    onChange={(e) => setEditingForm((prev) => ({ ...prev, maxScore: e.target.value }))}
                    style={{ maxWidth: 120 }}
                  />
                  <span style={{ color: "#64748b", minWidth: 20, textAlign: "right" }}>/5</span>
                </div>
              </label>
            </div>
            <div className="grid grid-3">
              <label>
                Periodo
                <select
                  className="input"
                  value={editingForm.period}
                  onChange={(e) => setEditingForm((prev) => ({ ...prev, period: e.target.value }))}
                >
                  {PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <div />
              <div />
            </div>
            <ActionFeedback
              tone="error"
              title="Error al editar tarea"
              message={editingError}
              onDismiss={() => setEditingError("")}
              style={{ marginTop: 8, marginBottom: 0 }}
            />
            <ActionFeedback
              tone="success"
              title="Tarea actualizada"
              message={editingMessage}
              onDismiss={() => setEditingMessage("")}
              style={{ marginTop: 8, marginBottom: 0 }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="button" type="submit">
                Guardar cambios
              </button>
              <button className="button secondary" type="button" onClick={cancelEditTask}>
                Cancelar
              </button>
            </div>
          </form>
        </Section>
      )}

      <Section title="Registro de calificaciones por tarea">
        {loading && <div className="card" style={{ color: "#64748b" }}>Cargando...</div>}
        {!loading && !gradeLevel && (
          <div className="card" style={{ color: "#64748b" }}>Selecciona grado y grupo para ver estudiantes.</div>
        )}
        {!loading && gradeLevel && students.length === 0 && (
          <div className="card" style={{ color: "#64748b" }}>No hay estudiantes para este grado/grupo.</div>
        )}
        {!loading && gradeLevel && students.length > 0 && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ color: "#64748b" }}>
                {students.length} estudiante(s) · {tasks.length} tarea(s)
              </div>
              <button className="button secondary" type="button" onClick={saveScores} disabled={saving}>
                {saving ? "Guardando..." : "Guardar calificaciones"}
              </button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th
                      style={{
                        position: "sticky",
                        top: 0,
                        left: 0,
                        zIndex: 4,
                        background: "#fff",
                        boxShadow: "2px 0 0 rgba(226,232,240,0.9)"
                      }}
                    >
                      Estudiante
                    </th>
                    {tasks.map((task) => (
                      <th key={task.id} style={{ minWidth: 220, background: "#fff", position: "sticky", top: 0, zIndex: 3 }}>
                        <div>{task.title}</div>
                        <div style={{ color: "#94a3b8", fontSize: 12 }}>
                          {ASPECTS.find((a) => a.value === task.aspect)?.label || task.aspect} · {getAspectWeight(task.aspect)}% ·{" "}
                          {task.maxScore}/5
                        </div>
                        {task.createdAt && (
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>
                            Creada: {formatTaskDate(task.createdAt)}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                          <button
                            className="button secondary"
                            type="button"
                            style={{ padding: "2px 6px", fontSize: 12 }}
                            onClick={() => startEditTask(task)}
                          >
                            Editar
                          </button>
                          <button
                            className="button danger"
                            type="button"
                            style={{ padding: "2px 6px", fontSize: 12 }}
                            onClick={() => deleteTask(task)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.enrollmentId}>
                      <td
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                          background: "#fff",
                          boxShadow: "2px 0 0 rgba(226,232,240,0.9)"
                        }}
                      >
                        {student.fullName}
                        <div style={{ color: "#94a3b8", fontSize: 12 }}>
                          {gradeLabel(student.grade)} {student.group ? `· Grupo ${student.group}` : ""}
                        </div>
                      </td>
                      {tasks.map((task) => (
                        <td key={`${student.enrollmentId}-${task.id}`}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              className="input"
                              type="number"
                              min={0}
                              step="0.01"
                              max={Math.min(5, task.maxScore)}
                              value={scores?.[student.enrollmentId]?.[task.id] ?? ""}
                              onChange={(e) => setScoreValue(student.enrollmentId, task.id, e.target.value)}
                              placeholder="/5"
                              style={{ maxWidth: 110 }}
                            />
                            <span style={{ color: "#94a3b8", fontSize: 12, minWidth: 20, textAlign: "right" }}>
                              /5
                            </span>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ActionFeedback
              tone="error"
              title="Error en calificaciones"
              message={error}
              onDismiss={() => setError("")}
              style={{ marginTop: 8, marginBottom: 0 }}
            />
            <ActionFeedback
              tone="success"
              title="Calificaciones actualizadas"
              message={message}
              onDismiss={() => setMessage("")}
              style={{ marginTop: 8, marginBottom: 0 }}
            />
          </div>
        )}
      </Section>

      <Section title="Nota final ponderada por estudiante">
        {gradeLevel && group && finalSummaryError && (
          <div className="card" style={{ color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}>
            {finalSummaryError}
          </div>
        )}
        {gradeLevel && group && !finalSummaryError && (
          <DataTable
            columns={[
              { key: "student", label: "Estudiante", sticky: true },
              { key: "grade", label: "Grado" },
              { key: "group", label: "Grupo" },
              { key: "period", label: "Periodo" },
              { key: "cognitive", label: "Cognitivo %" },
              { key: "personal", label: "Personal %" },
              { key: "social", label: "Social %" },
              { key: "final100", label: "Final /100" },
              { key: "final5", label: "Final /5" }
            ]}
            rows={finalSummary.map((row: any) => ({
              id: `${row.enrollmentId}-${row.period}`,
              student: row.student,
              grade: gradeLabel(row.grade || ""),
              group: row.group ? `Grupo ${row.group}` : "Sin grupo",
              period: row.period,
              cognitive: `${row.cognitiveAvg}%`,
              personal: `${row.personalAvg}%`,
              social: `${row.socialAvg}%`,
              final100: row.finalOver100,
              final5: row.finalOver5
            })).sort((a, b) => {
              const gradeA = String(a.grade || "");
              const gradeB = String(b.grade || "");
              if (gradeA !== gradeB) return gradeA.localeCompare(gradeB, "es");
              const groupA = String(a.group || "");
              const groupB = String(b.group || "");
              if (groupA !== groupB) return groupA.localeCompare(groupB, "es");
              return String(a.student || "").localeCompare(String(b.student || ""), "es");
            })}
            rowKey="id"
          />
        )}
      </Section>
    </div>
  );
}
