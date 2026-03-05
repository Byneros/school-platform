import React, { useEffect, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
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
    apiGet("/parent/children").then((res) => setChildren(res)).catch(() => undefined);
  }, []);

  useEffect(() => {
    apiGet(`/parent/boletines?page=${page}&pageSize=10${periodFilter ? `&period=${periodFilter}` : ""}${studentId ? `&studentId=${studentId}` : ""}`).then((res) => {
      setGrades(res.data || []);
      setTotal(res.total || 0);
    }).catch(() => undefined);
  }, [page, periodFilter, studentId]);

  const download = async () => {
    if (!studentId) return;
    const blob = await apiDownload(`/reports/report-card/${studentId}`);
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
      <div className="help-card">
        Descarga boletines y revisa el historial academico.
      </div>
      <div className="card">
        <div className="section-title">Descargar boletin</div>
        <label>
          Estudiante
          <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Selecciona</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.fullName}</option>
            ))}
          </select>
        </label>
        <button className="button" style={{ marginTop: 10 }} onClick={download}>Descargar PDF</button>
      </div>
      <DataTable
        columns={[
          { key: "student", label: "Estudiante" },
          { key: "grade", label: "Grado" },
          { key: "period", label: "Periodo" },
          { key: "score", label: "Nota" }
        ]}
        rows={grades.map((g: any) => ({
          student: g.enrollment?.student?.fullName || "",
          grade: g.grade || getClassGradeLevel(g.enrollment?.class) || "",
          period: g.period,
          score: `${g.score}/${g.maxScore}`
        }))}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Todos los estudiantes</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>{c.fullName}</option>
          ))}
        </select>
        <select className="input" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
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
        <button className="button secondary" disabled={page >= Math.ceil(total / 10)} onClick={() => setPage(page + 1)}>
          Siguiente
        </button>
      </div>
    </Section>
  );
}
