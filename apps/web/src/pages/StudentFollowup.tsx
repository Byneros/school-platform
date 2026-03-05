import React, { useEffect, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiDelete, apiDownload, apiGet, apiPost } from "../services/api";
import { gradeLabel } from "../services/grades";
import { useAuth } from "../context/AuthContext";

type StudentOption = {
  id: string;
  fullName: string;
  gradeLevel?: string;
  studentGroup?: string | null;
};

const observationTypeOptions = [
  { value: "", label: "Todos los tipos" },
  { value: "ACADEMIC", label: "Academico" },
  { value: "DISCIPLINARY", label: "Disciplinario" },
  { value: "COEXISTENCE", label: "Convivencia" }
];

function typeLabel(value: string) {
  return observationTypeOptions.find((item) => item.value === value)?.label || value;
}

export default function StudentFollowup() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [formType, setFormType] = useState("ACADEMIC");
  const [formDetail, setFormDetail] = useState("");
  const [formDate, setFormDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [data, setData] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyError, setVerifyError] = useState("");

  const isParent = user?.role === "PARENT";
  const isAdmin = user?.role === "ADMIN";

  const loadStudents = () => {
    const request = isParent ? apiGet("/parent/children") : apiGet("/students/simple");
    request
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        setStudents(list);
      })
      .catch(() => setStudents([]));
  };

  const load = () => {
    setLoading(true);
    const query = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      ...(studentId ? { studentId } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {})
    }).toString();

    apiGet(`/student-observations?${query}`)
      .then((res) => {
        setData(res.data || []);
        setTotal(Number(res.total || 0));
      })
      .catch(() => {
        setData([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStudents();
  }, [isParent]);

  useEffect(() => {
    load();
  }, [page, studentId, typeFilter, fromDate, toDate]);

  const createObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setMessage("Selecciona un estudiante.");
      return;
    }
    if (!formDetail.trim() || formDetail.trim().length < 5) {
      setMessage("Escribe una observacion valida (minimo 5 caracteres).");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await apiPost("/student-observations", {
        studentId,
        type: formType,
        detail: formDetail.trim(),
        ...(formDate ? { date: formDate } : {})
      });
      setFormDetail("");
      setFormDate("");
      setMessage("Observacion registrada.");
      load();
    } catch (error: any) {
      setMessage(error?.message || "No se pudo registrar la observacion.");
    } finally {
      setBusy(false);
    }
  };

  const deleteObservation = async (id: string) => {
    if (!isAdmin) return;
    const confirmed = window.confirm("Eliminar observacion?");
    if (!confirmed) return;
    try {
      await apiDelete(`/student-observations/${id}`);
      load();
    } catch (error: any) {
      setMessage(error?.message || "No se pudo eliminar.");
    }
  };

  const downloadCertificate = async (kind: "study" | "enrollment") => {
    if (!studentId) {
      setMessage("Selecciona un estudiante para descargar el certificado.");
      return;
    }
    const path = kind === "study" ? `/reports/certificate/study/${studentId}` : `/reports/certificate/enrollment/${studentId}`;
    const blob = await apiDownload(path);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = kind === "study" ? `constancia-estudio-${studentId}.pdf` : `certificado-matricula-${studentId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const verifyCertificate = async () => {
    if (!verifyCode.trim()) {
      setVerifyError("Ingresa un codigo de verificacion.");
      setVerifyResult(null);
      return;
    }
    setVerifyError("");
    try {
      const res = await apiGet(`/reports/certificate/verify/${encodeURIComponent(verifyCode.trim().toUpperCase())}`);
      setVerifyResult(res.certificate || null);
    } catch (error: any) {
      setVerifyResult(null);
      setVerifyError(error?.message || "No se pudo verificar el certificado.");
    }
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      <Section title="Seguimiento estudiantil">
        <div className="help-card">
          Consulta observaciones del estudiante y descarga certificados institucionales.
        </div>
        <div className="card">
          <label>
            Estudiante
            <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Selecciona</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                  {s.gradeLevel ? ` - ${gradeLabel(s.gradeLevel)}` : ""}
                  {s.studentGroup ? ` (${s.studentGroup})` : ""}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="button secondary" type="button" onClick={() => downloadCertificate("study")}>
              Constancia de estudio (PDF)
            </button>
            <button className="button secondary" type="button" onClick={() => downloadCertificate("enrollment")}>
              Certificado de matricula (PDF)
            </button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 10 }}>
          <div className="section-title">Verificar certificado por codigo</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="Ej: E-2026-12-ABC12345"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
            />
            <button type="button" className="button secondary" onClick={verifyCertificate}>
              Verificar
            </button>
          </div>
          {verifyError && <div style={{ color: "#b91c1c", marginTop: 8 }}>{verifyError}</div>}
          {verifyResult && (
            <div style={{ marginTop: 8, color: "#334155" }}>
              Valido: {verifyResult.type} #{verifyResult.serial}/{verifyResult.year} - {verifyResult.code}
              <br />
              Estudiante: {verifyResult.student?.fullName || "-"} ({verifyResult.student?.gradeLevel ? gradeLabel(verifyResult.student.gradeLevel) : "-"}
              {verifyResult.student?.studentGroup ? `-${verifyResult.student.studentGroup}` : ""})
              <br />
              Emitido por: {verifyResult.issuedBy?.fullName || "-"} ({verifyResult.issuedBy?.role || "-"})
            </div>
          )}
        </div>
      </Section>

      {!isParent && (
        <Section title="Observador del estudiante">
          <form className="card" onSubmit={createObservation}>
            <label>
              Tipo de observacion
              <select className="input" value={formType} onChange={(e) => setFormType(e.target.value)}>
                {observationTypeOptions
                  .filter((o) => o.value)
                  .map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Fecha (opcional)
              <input type="date" className="input" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </label>
            <label>
              Observacion
              <textarea className="input" rows={4} value={formDetail} onChange={(e) => setFormDetail(e.target.value)} />
            </label>
            {message && <div style={{ color: "#475569", marginTop: 8 }}>{message}</div>}
            <button className="button" style={{ marginTop: 10 }} disabled={busy}>
              {busy ? "Guardando..." : "Registrar observacion"}
            </button>
          </form>
        </Section>
      )}

      <Section title="Historial de observaciones">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {observationTypeOptions.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <DataTable
          columns={[
            { key: "date", label: "Fecha" },
            { key: "student", label: "Estudiante" },
            { key: "grade", label: "Grado" },
            { key: "group", label: "Grupo" },
            { key: "type", label: "Tipo" },
            { key: "detail", label: "Detalle" },
            { key: "author", label: "Registrado por" },
            ...(isAdmin ? [{ key: "actions", label: "Acciones" }] : [])
          ]}
          rows={
            loading
              ? [{ date: "Cargando...", student: "", grade: "", group: "", type: "", detail: "", author: "", ...(isAdmin ? { actions: "" } : {}) }]
              : data.map((row) => ({
                  date: String(row.date || "").slice(0, 10),
                  student: row.student?.fullName || "-",
                  grade: row.student?.gradeLevel ? gradeLabel(row.student.gradeLevel) : "-",
                  group: row.student?.studentGroup || "-",
                  type: typeLabel(row.type),
                  detail: row.detail || "",
                  author: row.createdBy?.fullName || "-",
                  ...(isAdmin
                    ? {
                        actions: (
                          <button className="button danger" type="button" onClick={() => deleteObservation(row.id)}>
                            Eliminar
                          </button>
                        )
                      }
                    : {})
                }))
          }
        />
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
    </div>
  );
}
