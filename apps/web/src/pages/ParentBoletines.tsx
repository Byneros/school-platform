import React, { useEffect, useState } from "react";

import DataTable from "../components/DataTable";
import Section from "../components/Section";
import { apiDownload, apiGet } from "../services/api";

function getClassGradeLevel(classData: any) {
  return String(classData?.gradeLevel || "").trim();
}

export default function ParentBoletines() {
  const [grades, setGrades] = useState<Array<any>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [periodFilter, setPeriodFilter] = useState("");
  const [children, setChildren] = useState<Array<{ id: string; fullName: string }>>([]);
  const [studentId, setStudentId] = useState("");

  useEffect(() => {
    apiGet("/parent/children")
      .then((res) => setChildren(res))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    apiGet(
      `/parent/boletines?page=${page}&pageSize=10${periodFilter ? `&period=${periodFilter}` : ""}${studentId ? `&studentId=${studentId}` : ""}`
    )
      .then((res) => {
        setGrades(res.data || []);
        setTotal(res.total || 0);
      })
      .catch(() => undefined);
  }, [page, periodFilter, studentId]);

  const download = async () => {
    if (!studentId) return;
    const query = periodFilter ? `?period=${encodeURIComponent(periodFilter)}` : "";
    const blob = await apiDownload(`/reports/report-card/${studentId}${query}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boletin-${studentId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Section title="Boletines">
      <div className="help-card">Descarga boletines y revisa el historial academico.</div>
      <div className="card">
        <div className="section-title">Descargar boletin</div>
        <label>
          Estudiante
          <select
            className="input"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Selecciona</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        </label>
        <button className="button" style={{ marginTop: 10 }} onClick={download}>
          Descargar PDF
        </button>
      </div>
      <DataTable
        columns={[
          { key: "student", label: "Estudiante" },
          { key: "grade", label: "Grado" },
          { key: "group", label: "Grupo" },
          { key: "period", label: "Periodo" },
          { key: "subject", label: "Asignatura" },
          { key: "score", label: "Nota definitiva" },
        ]}
        rows={grades
          .map((g: any) => ({
            student: g.student,
            grade: g.grade || getClassGradeLevel(g.enrollment?.class) || "",
            group: g.group || "Sin grupo",
            period: g.period,
            subject: g.subject,
            score: `${Number(g.finalScore || 0).toFixed(2)}/${g.maxScore ?? 0}`,
          }))
          .sort((a, b) => {
            const studentA = String(a.student || "");
            const studentB = String(b.student || "");
            if (studentA !== studentB) return studentA.localeCompare(studentB, "es");
            const gradeA = String(a.grade || "");
            const gradeB = String(b.grade || "");
            if (gradeA !== gradeB) return gradeA.localeCompare(gradeB, "es");
            const groupA = String(a.group || "");
            const groupB = String(b.group || "");
            if (groupA !== groupB) return groupA.localeCompare(groupB, "es");
            const periodA = String(a.period || "");
            const periodB = String(b.period || "");
            if (periodA !== periodB) return periodA.localeCompare(periodB, "es");
            const subjectA = String(a.subject || "");
            const subjectB = String(b.subject || "");
            if (subjectA !== subjectB) return subjectA.localeCompare(subjectB, "es");
            return String(a.score || "").localeCompare(String(b.score || ""), "es");
          })}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Todos los estudiantes</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
        >
          <option value="">Todos los periodos</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
          <option value="P4">P4</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <div style={{ alignSelf: "center", color: "#6b7280" }}>
          Pagina {page} de {Math.max(1, Math.ceil(total / 10))}
        </div>
        <button
          className="button secondary"
          disabled={page >= Math.ceil(total / 10)}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </Section>
  );
}
