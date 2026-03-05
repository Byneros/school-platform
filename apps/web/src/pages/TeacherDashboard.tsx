import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import KpiCard from "../components/KpiCard";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiGet, apiPost, apiPut } from "../services/api";
import { gradeLabel } from "../services/grades";

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Array<{ id: string; fullName: string; gradeLevel: string }>>([]);
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
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
    apiGet("/teacher/profile")
      .then((res) =>
        setProfileForm({
          professionalProfile: res.professionalProfile || "",
          subjectsText: Array.isArray(res.subjects) ? res.subjects.join(", ") : ""
        })
      )
      .catch(() => undefined);
  }, []);

  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMessage("");
    try {
      await apiPost("/notifications", { title, body, studentId: studentId || undefined });
      setMessage("Notificacion enviada para revision.");
      setTitle("");
      setBody("");
      setStudentId("");
    } catch {
      setMessage("No se pudo enviar.");
    } finally {
      setSending(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
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
    } catch (error: any) {
      setProfileMsg(error?.message || "No se pudo actualizar el perfil.");
    } finally {
      setProfileBusy(false);
    }
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="card">
        <div className="section-head">
          <div>
            <div className="section-title">Panel Docente</div>
            <div style={{ color: "#6b7280" }}>Registra asistencia, notas y comunica tareas en minutos.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button secondary" onClick={() => navigate("/teacher/asistencia")}>Asistencia por grado</button>
            <button className="button">Agregar nota</button>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <KpiCard title="Clases asignadas" value="5" trend="Periodo 2026" tone="primary" />
        <KpiCard title="Asistencia hoy" value="92%" trend="5 clases" tone="success" />
        <KpiCard title="Notas pendientes" value="18" trend="Por cerrar" tone="warning" />
        <KpiCard title="Notificaciones" value="2" trend="En revision" tone="danger" />
      </div>

      <div className="grid grid-2">
        <Section title="Mi perfil profesional">
          <form className="card" onSubmit={saveProfile}>
            <label>
              Perfil profesional
              <textarea
                className="input"
                rows={4}
                value={profileForm.professionalProfile}
                onChange={(e) => setProfileForm({ ...profileForm, professionalProfile: e.target.value })}
                placeholder="Licenciado en..., experiencia, especializaciones..."
              />
            </label>
            <label>
              Asignaturas dictadas (separadas por coma)
              <input
                className="input"
                value={profileForm.subjectsText}
                onChange={(e) => setProfileForm({ ...profileForm, subjectsText: e.target.value })}
                placeholder="Matematicas, Fisica, Quimica"
              />
            </label>
            {profileMsg && <div style={{ color: "#64748b", marginTop: 8 }}>{profileMsg}</div>}
            <button className="button" style={{ marginTop: 10 }} disabled={profileBusy}>
              {profileBusy ? "Guardando..." : "Guardar perfil"}
            </button>
          </form>
        </Section>

        <Section title="Calificaciones recientes" action={<button className="button secondary">Agregar nota</button>}>
          <DataTable
            enableSearch
            pageSize={5}
            columns={[
              { key: "assessment", label: "Evaluacion" },
              { key: "grade", label: "Grado" },
              { key: "score", label: "Promedio" }
            ]}
            rows={[
              { assessment: "Examen 1", grade: "QUINTO", score: "16.5" },
              { assessment: "Tarea 3", grade: "CUARTO", score: "18.0" },
              { assessment: "Proyecto", grade: "QUINTO", score: "17.2" },
              { assessment: "Examen 2", grade: "QUINTO", score: "15.8" },
              { assessment: "Quiz", grade: "CUARTO", score: "17.9" }
            ]}
          />
        </Section>

        <Section title="Comunicaciones">
          <div className="help-card">
            Tip: si eliges un estudiante, la notificacion solo llega a su familia.
          </div>
          <form className="card" onSubmit={sendNotification}>
            <label>
              Estudiante (opcional)
              <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">Todos</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} - {gradeLabel(s.gradeLevel)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Titulo
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Mensaje
              <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
            {message && <div style={{ color: "#64748b", marginTop: 8 }}>{message}</div>}
            <button className="button" style={{ marginTop: 10 }} disabled={sending}>
              {sending ? "Enviando..." : "Enviar a aprobacion"}
            </button>
          </form>
        </Section>
      </div>
    </div>
  );
}
