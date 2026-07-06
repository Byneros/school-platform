import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import ActionFeedback from "../components/ActionFeedback";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "../services/api";
import { gradeLabel } from "../services/grades";
import { feedbackTitles } from "../utils/feedback";
const PERIODS = ["P1", "P2", "P3", "P4"];
const ASPECTS = [
    { value: "COGNITIVE", label: "Cognitivo" },
    { value: "PERSONAL", label: "Personal" },
    { value: "SOCIAL", label: "Social" }
];
const GRADE_ORDER = {
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
function normalizeGradeKey(value) {
    return String(value || "").trim().toUpperCase();
}
function sortGradesAcademic(values) {
    return [...values].sort((a, b) => {
        const oa = GRADE_ORDER[normalizeGradeKey(a)] ?? 999;
        const ob = GRADE_ORDER[normalizeGradeKey(b)] ?? 999;
        if (oa !== ob)
            return oa - ob;
        return a.localeCompare(b, "es", { numeric: true });
    });
}
export default function TeacherTasks() {
    const [enrollments, setEnrollments] = useState([]);
    const [gradeOptions, setGradeOptions] = useState([]);
    const [groupOptions, setGroupOptions] = useState([]);
    const [gradeLevel, setGradeLevel] = useState("");
    const [group, setGroup] = useState("");
    const [period, setPeriod] = useState("P1");
    const [tasks, setTasks] = useState([]);
    const [students, setStudents] = useState([]);
    const [scores, setScores] = useState({});
    const [dirtyScores, setDirtyScores] = useState({});
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
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editingForm, setEditingForm] = useState({ title: "", aspect: "COGNITIVE", maxScore: "5", period: "P1" });
    const [editingMessage, setEditingMessage] = useState("");
    const [editingError, setEditingError] = useState("");
    const [finalSummary, setFinalSummary] = useState([]);
    const [finalSummaryError, setFinalSummaryError] = useState("");
    const totalWeight = Number(weights.cognitiveWeight || 0) +
        Number(weights.personalWeight || 0) +
        Number(weights.socialWeight || 0);
    useEffect(() => {
        Promise.all([apiGet("/teacher/enrollments"), apiGet("/teacher/profile")])
            .then(([enrollmentsRes, profileRes]) => {
            const list = Array.isArray(enrollmentsRes) ? enrollmentsRes : [];
            setEnrollments(list);
            const grades = Array.from(new Set(list
                .map((e) => String(e.grade || e.class?.gradeLevel || "").trim())
                .filter(Boolean)));
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
        const groups = Array.from(new Set(enrollments
            .filter((e) => String(e.grade || e.class?.gradeLevel || "").trim() === gradeLevel)
            .map((e) => String(e.group || e.student?.studentGroup || "").trim())));
        const options = groups.map((g) => ({
            value: g,
            label: g ? `Grupo ${g}` : "Sin grupo"
        }));
        setGroupOptions(options);
        if (options.length > 0) {
            const nextGroup = options.some((opt) => opt.value === group) ? group : options[0].value;
            if (nextGroup !== group)
                setGroup(nextGroup);
        }
        else {
            setGroup("");
            setTasks([]);
            setStudents([]);
            setScores({});
            setDirtyScores({});
        }
    }, [gradeLevel, enrollments, group]);
    const loadBoard = async () => {
        if (!gradeLevel)
            return;
        setLoading(true);
        setError("");
        setMessage("");
        const groupParam = group ? group : "SIN_GRUPO";
        try {
            const res = await apiGet(`/teacher/tasks/board?gradeLevel=${encodeURIComponent(gradeLevel)}&group=${encodeURIComponent(groupParam)}&period=${encodeURIComponent(period)}`);
            const tasksList = Array.isArray(res?.tasks) ? res.tasks : [];
            const studentsList = Array.isArray(res?.students) ? res.students : [];
            const scoresList = Array.isArray(res?.scores) ? res.scores : [];
            const scoreMap = {};
            scoresList.forEach((s) => {
                if (!scoreMap[s.enrollmentId])
                    scoreMap[s.enrollmentId] = {};
                scoreMap[s.enrollmentId][s.taskId] = s.score === null || s.score === undefined ? "" : String(s.score);
            });
            setTasks(tasksList);
            setStudents([...studentsList].sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), "es")));
            setScores(scoreMap);
            setDirtyScores({});
        }
        catch (err) {
            setError(err?.message || "No se pudo cargar la tabla de tareas.");
            setTasks([]);
            setStudents([]);
            setScores({});
            setDirtyScores({});
        }
        finally {
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
            const query = `?period=${encodeURIComponent(period)}&gradeLevel=${encodeURIComponent(gradeLevel)}&group=${encodeURIComponent(groupParam)}`;
            const res = await apiGet(`/teacher/grades/final-summary${query}`);
            setFinalSummary(Array.isArray(res) ? res : []);
        }
        catch (err) {
            setFinalSummaryError(err?.message || "No se pudo cargar la nota final ponderada.");
            setFinalSummary([]);
        }
    };
    useEffect(() => {
        if (!gradeLevel)
            return;
        if (groupOptions.length === 0) {
            setTasks([]);
            setStudents([]);
            setScores({});
            setDirtyScores({});
            return;
        }
        if (!groupOptions.some((opt) => opt.value === group))
            return;
        loadBoard();
    }, [gradeLevel, group, period, groupOptions]);
    useEffect(() => {
        if (!gradeLevel) {
            setFinalSummary([]);
            return;
        }
        loadFinalSummary();
    }, [gradeLevel, group, period]);
    const handleCreateTask = async (e) => {
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
        }
        catch (err) {
            setError(err?.message || "No se pudo crear la tarea.");
        }
    };
    const saveWeights = async (e) => {
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
        }
        catch (error) {
            setWeightsMsg(error?.message || "No se pudo guardar la ponderacion");
        }
    };
    const startEditTask = (task) => {
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
    const handleUpdateTask = async (e) => {
        e.preventDefault();
        if (!editingTaskId)
            return;
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
        }
        catch (err) {
            setEditingError(err?.message || "No se pudo actualizar la tarea.");
        }
    };
    const deleteTask = async (task) => {
        const confirmed = window.confirm(`Eliminar la tarea "${task.title}"? Esta accion eliminara sus calificaciones asociadas.`);
        if (!confirmed)
            return;
        setError("");
        setMessage("");
        try {
            await apiDelete(`/teacher/tasks/${task.id}`);
            setMessage("Tarea eliminada.");
            if (editingTaskId === task.id) {
                setEditingTaskId(null);
            }
            loadBoard();
        }
        catch (err) {
            setError(err?.message || "No se pudo eliminar la tarea.");
        }
    };
    const setScoreValue = (enrollmentId, taskId, value) => {
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
            await Promise.all(keys.map(async (key) => {
                const [enrollmentId, taskId] = key.split(":");
                const rawValue = scores?.[enrollmentId]?.[taskId];
                if (rawValue === undefined || rawValue === "")
                    return;
                const numeric = Number(rawValue);
                if (!Number.isFinite(numeric)) {
                    throw new Error("Hay calificaciones invalidas.");
                }
                await apiPost("/teacher/tasks/score", {
                    enrollmentId,
                    taskId,
                    score: numeric
                });
            }));
            setMessage("Calificaciones guardadas.");
            loadBoard();
        }
        catch (err) {
            setError(err?.message || "No se pudieron guardar las calificaciones.");
        }
        finally {
            setSaving(false);
        }
    };
    const selectedGroupLabel = useMemo(() => {
        const found = groupOptions.find((g) => g.value === group);
        return found ? found.label : group ? `Grupo ${group}` : "Sin grupo";
    }, [group, groupOptions]);
    const formatTaskDate = (value) => {
        if (!value)
            return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime()))
            return "";
        return date.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
    };
    const getAspectWeight = (aspect) => {
        if (aspect === "COGNITIVE")
            return Number(weights.cognitiveWeight || 0);
        if (aspect === "PERSONAL")
            return Number(weights.personalWeight || 0);
        if (aspect === "SOCIAL")
            return Number(weights.socialWeight || 0);
        return 0;
    };
    return (_jsxs("div", { className: "grid", style: { gap: 20 }, children: [_jsxs(Section, { title: "Tareas y Calificaciones", children: [_jsx("div", { className: "help-card", children: "Crea tareas para los grados asignados y registra calificaciones por estudiante." }), _jsxs("div", { className: "card", style: { display: "grid", gap: 12 }, children: [_jsxs("div", { className: "grid grid-3", children: [_jsxs("label", { children: ["Grado", _jsxs("select", { className: "input", value: gradeLevel, onChange: (e) => setGradeLevel(e.target.value), children: [_jsx("option", { value: "", children: "Selecciona un grado" }), gradeOptions.map((g) => (_jsx("option", { value: g, children: gradeLabel(g) }, g)))] })] }), _jsxs("label", { children: ["Grupo", _jsxs("select", { className: "input", value: group, onChange: (e) => setGroup(e.target.value), disabled: !gradeLevel, children: [groupOptions.length === 0 && _jsx("option", { value: "", children: "Sin grupos" }), groupOptions.map((g) => (_jsx("option", { value: g.value, children: g.label }, `${g.value || "sin-grupo"}`)))] })] }), _jsxs("label", { children: ["Periodo", _jsx("select", { className: "input", value: period, onChange: (e) => setPeriod(e.target.value), children: PERIODS.map((p) => (_jsx("option", { value: p, children: p }, p))) })] })] }), gradeLevel && (_jsxs("div", { style: { color: "#64748b" }, children: ["Grupo seleccionado: ", _jsx("strong", { children: gradeLabel(gradeLevel) }), " \u00B7 ", _jsx("strong", { children: selectedGroupLabel })] }))] })] }), _jsx(Section, { title: "Nueva tarea", children: _jsxs("form", { className: "card", onSubmit: handleCreateTask, children: [_jsxs("div", { className: "grid grid-3", children: [_jsxs("label", { children: ["Nombre de la tarea", _jsx("input", { className: "input", value: taskForm.title, onChange: (e) => setTaskForm((prev) => ({ ...prev, title: e.target.value })) })] }), _jsxs("label", { children: ["Aspecto", _jsx("select", { className: "input", value: taskForm.aspect, onChange: (e) => setTaskForm((prev) => ({ ...prev, aspect: e.target.value })), children: ASPECTS.map((a) => (_jsx("option", { value: a.value, children: a.label }, a.value))) })] }), _jsxs("label", { children: ["Nota maxima", _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [_jsx("input", { className: "input", type: "number", min: 0, max: 5, step: "0.01", value: taskForm.maxScore, onChange: (e) => setTaskForm((prev) => ({ ...prev, maxScore: e.target.value })), style: { maxWidth: 120 } }), _jsx("span", { style: { color: "#64748b", minWidth: 20, textAlign: "right" }, children: "/5" })] })] })] }), _jsxs("div", { style: { color: "#64748b", marginTop: 8 }, children: ["Ponderacion aplicada: ", _jsxs("strong", { children: [getAspectWeight(taskForm.aspect), "%"] }), " \u00B7 Nota maxima 0\u20135"] }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.teacherTasks.taskError, message: error, onDismiss: () => setError(""), style: { marginTop: 8, marginBottom: 0 } }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.teacherTasks.taskSuccess, message: message, onDismiss: () => setMessage(""), style: { marginTop: 8, marginBottom: 0 } }), _jsx("button", { className: "button", style: { marginTop: 10 }, disabled: !gradeLevel, children: "Crear tarea" })] }) }), _jsx(Section, { title: "Ponderacion de evaluacion", children: _jsxs("form", { className: "card", onSubmit: saveWeights, children: [_jsxs("div", { className: "grid grid-3", children: [_jsxs("label", { children: ["Cognitivo (%)", _jsx("input", { className: "input", type: "number", min: 0, max: 100, value: weights.cognitiveWeight, onChange: (e) => setWeights({ ...weights, cognitiveWeight: e.target.value }) })] }), _jsxs("label", { children: ["Personal (%)", _jsx("input", { className: "input", type: "number", min: 0, max: 100, value: weights.personalWeight, onChange: (e) => setWeights({ ...weights, personalWeight: e.target.value }) })] }), _jsxs("label", { children: ["Social (%)", _jsx("input", { className: "input", type: "number", min: 0, max: 100, value: weights.socialWeight, onChange: (e) => setWeights({ ...weights, socialWeight: e.target.value }) })] })] }), _jsxs("div", { style: { marginTop: 8, color: totalWeight === 100 ? "#15803d" : "#b45309", fontWeight: 600 }, children: ["Total: ", totalWeight, "% ", totalWeight === 100 ? "(OK)" : "(debe ser 100)"] }), weightsMsg && _jsx("div", { style: { marginTop: 8, color: "#64748b" }, children: weightsMsg }), _jsx("button", { className: "button", style: { marginTop: 10 }, children: "Guardar ponderacion" })] }) }), editingTaskId && (_jsx(Section, { title: "Editar tarea", children: _jsxs("form", { className: "card", onSubmit: handleUpdateTask, children: [_jsxs("div", { className: "grid grid-3", children: [_jsxs("label", { children: ["Nombre de la tarea", _jsx("input", { className: "input", value: editingForm.title, onChange: (e) => setEditingForm((prev) => ({ ...prev, title: e.target.value })) })] }), _jsxs("label", { children: ["Aspecto", _jsx("select", { className: "input", value: editingForm.aspect, onChange: (e) => setEditingForm((prev) => ({ ...prev, aspect: e.target.value })), children: ASPECTS.map((a) => (_jsx("option", { value: a.value, children: a.label }, a.value))) })] }), _jsxs("label", { children: ["Nota maxima", _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [_jsx("input", { className: "input", type: "number", min: 0, max: 5, step: "0.01", value: editingForm.maxScore, onChange: (e) => setEditingForm((prev) => ({ ...prev, maxScore: e.target.value })), style: { maxWidth: 120 } }), _jsx("span", { style: { color: "#64748b", minWidth: 20, textAlign: "right" }, children: "/5" })] })] })] }), _jsxs("div", { className: "grid grid-3", children: [_jsxs("label", { children: ["Periodo", _jsx("select", { className: "input", value: editingForm.period, onChange: (e) => setEditingForm((prev) => ({ ...prev, period: e.target.value })), children: PERIODS.map((p) => (_jsx("option", { value: p, children: p }, p))) })] }), _jsx("div", {}), _jsx("div", {})] }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.teacherTasks.updateError, message: editingError, onDismiss: () => setEditingError(""), style: { marginTop: 8, marginBottom: 0 } }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.teacherTasks.updateSuccess, message: editingMessage, onDismiss: () => setEditingMessage(""), style: { marginTop: 8, marginBottom: 0 } }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 10 }, children: [_jsx("button", { className: "button", type: "submit", children: "Guardar cambios" }), _jsx("button", { className: "button secondary", type: "button", onClick: cancelEditTask, children: "Cancelar" })] })] }) })), _jsxs(Section, { title: "Registro de calificaciones por tarea", children: [loading && _jsx("div", { className: "card", style: { color: "#64748b" }, children: "Cargando..." }), !loading && !gradeLevel && (_jsx("div", { className: "card", style: { color: "#64748b" }, children: "Selecciona grado y grupo para ver estudiantes." })), !loading && gradeLevel && students.length === 0 && (_jsx("div", { className: "card", style: { color: "#64748b" }, children: "No hay estudiantes para este grado/grupo." })), !loading && gradeLevel && students.length > 0 && (_jsxs("div", { className: "card", children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }, children: [_jsxs("div", { style: { color: "#64748b" }, children: [students.length, " estudiante(s) \u00B7 ", tasks.length, " tarea(s)"] }), _jsx("button", { className: "button secondary", type: "button", onClick: saveScores, disabled: saving, children: saving ? "Guardando..." : "Guardar calificaciones" })] }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: {
                                                            position: "sticky",
                                                            top: 0,
                                                            left: 0,
                                                            zIndex: 4,
                                                            background: "#fff",
                                                            boxShadow: "2px 0 0 rgba(226,232,240,0.9)"
                                                        }, children: "Estudiante" }), tasks.map((task) => (_jsxs("th", { style: { minWidth: 220, background: "#fff", position: "sticky", top: 0, zIndex: 3 }, children: [_jsx("div", { children: task.title }), _jsxs("div", { style: { color: "#94a3b8", fontSize: 12 }, children: [ASPECTS.find((a) => a.value === task.aspect)?.label || task.aspect, " \u00B7 ", getAspectWeight(task.aspect), "% \u00B7", " ", task.maxScore, "/5"] }), task.createdAt && (_jsxs("div", { style: { color: "#94a3b8", fontSize: 12 }, children: ["Creada: ", formatTaskDate(task.createdAt)] })), _jsxs("div", { style: { display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }, children: [_jsx("button", { className: "button secondary", type: "button", style: { padding: "2px 6px", fontSize: 12 }, onClick: () => startEditTask(task), children: "Editar" }), _jsx("button", { className: "button danger", type: "button", style: { padding: "2px 6px", fontSize: 12 }, onClick: () => deleteTask(task), children: "Eliminar" })] })] }, task.id)))] }) }), _jsx("tbody", { children: students.map((student) => (_jsxs("tr", { children: [_jsxs("td", { style: {
                                                            position: "sticky",
                                                            left: 0,
                                                            zIndex: 1,
                                                            background: "#fff",
                                                            boxShadow: "2px 0 0 rgba(226,232,240,0.9)"
                                                        }, children: [student.fullName, _jsxs("div", { style: { color: "#94a3b8", fontSize: 12 }, children: [gradeLabel(student.grade), " ", student.group ? `· Grupo ${student.group}` : ""] })] }), tasks.map((task) => (_jsx("td", { children: _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [_jsx("input", { className: "input", type: "number", min: 0, step: "0.01", max: Math.min(5, task.maxScore), value: scores?.[student.enrollmentId]?.[task.id] ?? "", onChange: (e) => setScoreValue(student.enrollmentId, task.id, e.target.value), placeholder: "/5", style: { maxWidth: 110 } }), _jsx("span", { style: { color: "#94a3b8", fontSize: 12, minWidth: 20, textAlign: "right" }, children: "/5" })] }) }, `${student.enrollmentId}-${task.id}`)))] }, student.enrollmentId))) })] }) }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.teacherTasks.gradesError, message: error, onDismiss: () => setError(""), style: { marginTop: 8, marginBottom: 0 } }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.teacherTasks.gradesSuccess, message: message, onDismiss: () => setMessage(""), style: { marginTop: 8, marginBottom: 0 } })] }))] }), _jsxs(Section, { title: "Nota final ponderada por estudiante", children: [gradeLevel && group && finalSummaryError && (_jsx("div", { className: "card", style: { color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }, children: finalSummaryError })), gradeLevel && group && !finalSummaryError && (_jsx(DataTable, { columns: [
                            { key: "student", label: "Estudiante", sticky: true },
                            { key: "grade", label: "Grado" },
                            { key: "group", label: "Grupo" },
                            { key: "period", label: "Periodo" },
                            { key: "cognitive", label: "Cognitivo %" },
                            { key: "personal", label: "Personal %" },
                            { key: "social", label: "Social %" },
                            { key: "final100", label: "Final /100" },
                            { key: "final5", label: "Final /5" }
                        ], rows: finalSummary.map((row) => ({
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
                            if (gradeA !== gradeB)
                                return gradeA.localeCompare(gradeB, "es");
                            const groupA = String(a.group || "");
                            const groupB = String(b.group || "");
                            if (groupA !== groupB)
                                return groupA.localeCompare(groupB, "es");
                            return String(a.student || "").localeCompare(String(b.student || ""), "es");
                        }), rowKey: "id" }))] })] }));
}
