import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActionFeedback from "../components/ActionFeedback";
import KpiCard from "../components/KpiCard";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiGet, apiPost, apiPut } from "../services/api";
import { gradeLabel } from "../services/grades";
import { feedbackTitles, inferFeedbackTone } from "../utils/feedback";
export default function TeacherDashboard() {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [studentId, setStudentId] = useState("");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState("");
    const [recentGrades, setRecentGrades] = useState([]);
    const [profileBusy, setProfileBusy] = useState(false);
    const [profileMsg, setProfileMsg] = useState("");
    const [profileForm, setProfileForm] = useState({
        professionalProfile: "",
        subjectsText: ""
    });
    useEffect(() => {
        apiGet("/students/simple")
            .then((res) => setStudents(res))
            .catch(() => undefined);
        apiGet("/teacher/grades?page=1&pageSize=5")
            .then((res) => setRecentGrades(res.data || []))
            .catch(() => setRecentGrades([]));
        apiGet("/teacher/profile")
            .then((res) => setProfileForm({
            professionalProfile: res.professionalProfile || "",
            subjectsText: Array.isArray(res.subjects) ? res.subjects.join(", ") : ""
        }))
            .catch(() => undefined);
    }, []);
    const sendNotification = async (e) => {
        e.preventDefault();
        setSending(true);
        setMessage("");
        try {
            await apiPost("/notifications", { title, body, studentId: studentId || undefined });
            setMessage("Notificacion enviada para revision.");
            setTitle("");
            setBody("");
            setStudentId("");
        }
        catch {
            setMessage("No se pudo enviar.");
        }
        finally {
            setSending(false);
        }
    };
    const saveProfile = async (e) => {
        e.preventDefault();
        setProfileBusy(true);
        setProfileMsg("");
        try {
            const subjects = profileForm.subjectsText
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            await apiPut("/teacher/profile", {
                professionalProfile: profileForm.professionalProfile,
                subjects
            });
            setProfileMsg("Perfil docente actualizado.");
        }
        catch (error) {
            setProfileMsg(error?.message || "No se pudo actualizar el perfil.");
        }
        finally {
            setProfileBusy(false);
        }
    };
    return (_jsxs("div", { className: "grid", style: { gap: 24 }, children: [_jsx("div", { className: "card", children: _jsxs("div", { className: "section-head", children: [_jsxs("div", { children: [_jsx("div", { className: "section-title", children: "Panel Docente" }), _jsx("div", { style: { color: "#6b7280" }, children: "Registra asistencia, notas y comunica tareas en minutos." })] }), _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("button", { className: "button secondary", onClick: () => navigate("/teacher/asistencia"), children: "Asistencia por grado" }), _jsx("button", { className: "button", onClick: () => navigate("/teacher/tareas-calificaciones"), children: "Tareas y calificaciones" })] })] }) }), _jsxs("div", { className: "grid grid-4", children: [_jsx(KpiCard, { title: "Clases asignadas", value: "5", trend: "Periodo 2026", tone: "primary" }), _jsx(KpiCard, { title: "Asistencia hoy", value: "92%", trend: "5 clases", tone: "success" }), _jsx(KpiCard, { title: "Notas pendientes", value: "18", trend: "Por cerrar", tone: "warning" }), _jsx(KpiCard, { title: "Notificaciones", value: "2", trend: "En revision", tone: "danger" })] }), _jsxs("div", { className: "grid grid-2", children: [_jsx(Section, { title: "Mi perfil profesional", children: _jsxs("form", { className: "card", onSubmit: saveProfile, children: [_jsxs("label", { children: ["Perfil profesional", _jsx("textarea", { className: "input", rows: 4, value: profileForm.professionalProfile, onChange: (e) => setProfileForm({ ...profileForm, professionalProfile: e.target.value }), placeholder: "Licenciado en..., experiencia, especializaciones..." })] }), _jsxs("label", { children: ["Asignaturas dictadas (separadas por coma)", _jsx("input", { className: "input", value: profileForm.subjectsText, onChange: (e) => setProfileForm({ ...profileForm, subjectsText: e.target.value }), placeholder: "Matematicas, Fisica, Quimica" })] }), _jsx(ActionFeedback, { tone: inferFeedbackTone(profileMsg), title: feedbackTitles.teacherDashboard.profile, message: profileMsg, onDismiss: () => setProfileMsg(""), style: { marginTop: 8 } }), _jsx("button", { className: "button", style: { marginTop: 10 }, disabled: profileBusy, children: profileBusy ? "Guardando..." : "Guardar perfil" })] }) }), _jsx(Section, { title: "Calificaciones recientes", action: _jsx("button", { className: "button secondary", onClick: () => navigate("/teacher/tareas-calificaciones"), children: "Tareas y calificaciones" }), children: _jsx(DataTable, { enableSearch: true, pageSize: 5, suggestionsEndpoint: "/suggestions?type=teacher-grades", columns: [
                                { key: "assessment", label: "Evaluacion" },
                                { key: "grade", label: "Grado" },
                                { key: "score", label: "Promedio" }
                            ], rows: recentGrades.map((g) => ({
                                assessment: g.name,
                                grade: gradeLabel(g.grade || g.enrollment?.class?.gradeLevel || ""),
                                score: Number(g.maxScore || 0) > 0 ? (Number(g.score || 0) / Number(g.maxScore || 0) * 20).toFixed(1) : String(g.score || "")
                            })) }) }), _jsxs(Section, { title: "Comunicaciones", children: [_jsx("div", { className: "help-card", children: "Tip: si eliges un estudiante, la notificacion solo llega a su familia." }), _jsxs("form", { className: "card", onSubmit: sendNotification, children: [_jsxs("label", { children: ["Estudiante (opcional)", _jsxs("select", { className: "input", value: studentId, onChange: (e) => setStudentId(e.target.value), children: [_jsx("option", { value: "", children: "Todos" }), students.map((s) => (_jsxs("option", { value: s.id, children: [s.fullName, " - ", gradeLabel(s.gradeLevel), s.studentGroup ? `${s.studentGroup}` : "", s.latestYear ? ` (${s.latestYear})` : ""] }, s.id)))] })] }), _jsxs("label", { children: ["Titulo", _jsx("input", { className: "input", value: title, onChange: (e) => setTitle(e.target.value) })] }), _jsxs("label", { children: ["Mensaje", _jsx("textarea", { className: "input", rows: 4, value: body, onChange: (e) => setBody(e.target.value) })] }), _jsx(ActionFeedback, { tone: inferFeedbackTone(message), title: feedbackTitles.teacherDashboard.communications, message: message, onDismiss: () => setMessage(""), style: { marginTop: 8 } }), _jsx("button", { className: "button", style: { marginTop: 10 }, disabled: sending, children: sending ? "Enviando..." : "Enviar a aprobacion" })] })] })] })] }));
}
