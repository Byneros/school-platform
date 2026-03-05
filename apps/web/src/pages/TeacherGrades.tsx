import React, { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiGet, apiPost, apiPut } from "../services/api";

const PERIODS = ["P1", "P2", "P3", "P4"];
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

function getClassGradeLevel(classData: any) {
  return String(classData?.gradeLevel || "").trim();
}

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

function aspectLabel(aspect: string) {
  if (aspect === "COGNITIVE") return "Cognitivo";
  if (aspect === "PERSONAL") return "Personal";
  if (aspect === "SOCIAL") return "Social";
  return aspect;
}

export default function TeacherGrades() {
  const [enrollments, setEnrollments] = useState<Array<any>>([]);
  const [gradeRows, setGradeRows] = useState<Array<any>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [periodFilter, setPeriodFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [enrollmentSearch, setEnrollmentSearch] = useState("");
  const [gradeOptions, setGradeOptions] = useState<Array<string>>([]);
  const [form, setForm] = useState({
    enrollmentId: "",
    period: "P1",
    name: "",
    aspect: "COGNITIVE",
    score: "",
    maxScore: "20"
  });
  const [weights, setWeights] = useState({
    cognitiveWeight: "60",
    personalWeight: "20",
    socialWeight: "20"
  });
  const [weightsMsg, setWeightsMsg] = useState("");
  const [finalSummary, setFinalSummary] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [formMsg, setFormMsg] = useState("");

  const totalWeight =
    Number(weights.cognitiveWeight || 0) +
    Number(weights.personalWeight || 0) +
    Number(weights.socialWeight || 0);

  const aspectWeight = useMemo(() => {
    if (form.aspect === "COGNITIVE") return Number(weights.cognitiveWeight || 0);
    if (form.aspect === "PERSONAL") return Number(weights.personalWeight || 0);
    return Number(weights.socialWeight || 0);
  }, [form.aspect, weights]);

  const scoreNum = Number(form.score || 0);
  const maxScoreNum = Number(form.maxScore || 0);
  const rawPercent = maxScoreNum > 0 ? (scoreNum / maxScoreNum) * 100 : 0;
  const boundedPercent = Number.isFinite(rawPercent) ? Math.max(0, Math.min(100, rawPercent)) : 0;
  const weightedContributionOver100 = (boundedPercent * aspectWeight) / 100;
  const weightedContributionOver5 = weightedContributionOver100 / 20;

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [enrollmentsRes, gradesRes, finalSummaryRes, profileRes] = await Promise.all([
        apiGet("/teacher/enrollments"),
        apiGet(
          `/teacher/grades?page=${page}&pageSize=10${periodFilter ? `&period=${periodFilter}` : ""}${
            gradeFilter ? `&gradeLevel=${gradeFilter}` : ""
          }`
        ),
        apiGet(
          `/teacher/grades/final-summary${
            periodFilter || gradeFilter ? "?" : ""
          }${periodFilter ? `period=${periodFilter}` : ""}${periodFilter && gradeFilter ? "&" : ""}${
            gradeFilter ? `gradeLevel=${gradeFilter}` : ""
          }`
        ),
        apiGet("/teacher/profile")
      ]);

      const enrollmentsList = Array.isArray(enrollmentsRes) ? enrollmentsRes : [];
      setEnrollments(enrollmentsList);
      const unique = new Set<string>();
      enrollmentsList.forEach((e: any) => {
        const grade = String(e.grade || getClassGradeLevel(e.class) || "").trim();
        if (grade) unique.add(grade);
      });
      setGradeOptions(sortGradesAcademic(Array.from(unique)));

      setGradeRows(gradesRes?.data || []);
      setTotal(Number(gradesRes?.total || 0));
      setFinalSummary(Array.isArray(finalSummaryRes) ? finalSummaryRes : []);

      setWeights({
        cognitiveWeight: String(profileRes?.cognitiveWeight ?? 60),
        personalWeight: String(profileRes?.personalWeight ?? 20),
        socialWeight: String(profileRes?.socialWeight ?? 20)
      });
    } catch (error: any) {
      setLoadError(error?.message || "No se pudieron cargar las calificaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, periodFilter, gradeFilter]);

  useEffect(() => {
    setPage(1);
  }, [periodFilter, gradeFilter]);

  const filteredEnrollments = useMemo(() => {
    const text = enrollmentSearch.trim().toLowerCase();
    return enrollments
      .filter((e: any) => {
        const grade = String(e.grade || getClassGradeLevel(e.class) || "");
        return !gradeFilter || grade === gradeFilter;
      })
      .filter((e: any) => {
        if (!text) return true;
        const studentName = String(e.student?.fullName || "").toLowerCase();
        const grade = String(e.grade || getClassGradeLevel(e.class) || "").toLowerCase();
        return studentName.includes(text) || grade.includes(text);
      })
      .sort((a: any, b: any) => {
        const ga = String(a.grade || getClassGradeLevel(a.class) || "");
        const gb = String(b.grade || getClassGradeLevel(b.class) || "");
        const oa = GRADE_ORDER[normalizeGradeKey(ga)] ?? 999;
        const ob = GRADE_ORDER[normalizeGradeKey(gb)] ?? 999;
        if (oa !== ob) return oa - ob;
        return String(a.student?.fullName || "").localeCompare(String(b.student?.fullName || ""), "es");
      });
  }, [enrollments, enrollmentSearch, gradeFilter]);

  const selectedEnrollment = useMemo(
    () => filteredEnrollments.find((e: any) => e.id === form.enrollmentId),
    [filteredEnrollments, form.enrollmentId]
  );

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormMsg("");
    if (!form.enrollmentId || !form.name || !form.score || !form.maxScore) {
      setFormError("Completa los campos obligatorios para guardar la nota.");
      return;
    }
    const score = Number(form.score);
    const maxScore = Number(form.maxScore);
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
      setFormError("La nota debe ser numerica y estar entre 0 y la nota maxima.");
      return;
    }
    try {
      await apiPost("/grades", {
        enrollmentId: form.enrollmentId,
        period: form.period,
        name: form.name,
        aspect: form.aspect,
        score,
        maxScore
      });
      setForm({
        enrollmentId: "",
        period: "P1",
        name: "",
        aspect: "COGNITIVE",
        score: "",
        maxScore: "20"
      });
      setFormMsg("Calificacion guardada correctamente.");
      load();
    } catch (error: any) {
      setFormError(error?.message || "No se pudo guardar la calificacion.");
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
      load();
    } catch (error: any) {
      setWeightsMsg(error?.message || "No se pudo guardar la ponderacion");
    }
  };

  const summaryByGrade = useMemo(() => {
    const map = new Map<string, { count: number; final100Sum: number }>();
    finalSummary.forEach((row: any) => {
      const grade = String(row.grade || "").trim() || "-";
      const current = map.get(grade) || { count: 0, final100Sum: 0 };
      current.count += 1;
      current.final100Sum += Number(row.finalOver100 || 0);
      map.set(grade, current);
    });
    return sortGradesAcademic(Array.from(map.keys())).map((grade) => {
      const entry = map.get(grade)!;
      return {
        grade,
        students: entry.count,
        avgFinal100: entry.count ? Number((entry.final100Sum / entry.count).toFixed(2)) : 0
      };
    });
  }, [finalSummary]);

  return (
    <Section title="Calificaciones">
      <div className="help-card">
        Registra notas por aspecto y calcula el resultado final respetando la ponderacion cognitiva/personal/social.
      </div>
      {loadError && (
        <div className="card" style={{ color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}>
          {loadError}
        </div>
      )}

      <form className="card" onSubmit={saveWeights}>
        <div className="section-title">1) Ponderacion de evaluacion</div>
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

      <form className="card" onSubmit={create}>
        <div className="section-title">2) Agregar calificacion</div>
        {formError && <div style={{ marginBottom: 8, color: "#b91c1c" }}>{formError}</div>}
        {formMsg && <div style={{ marginBottom: 8, color: "#15803d" }}>{formMsg}</div>}

        <div className="grid grid-2">
          <label>
            Buscar estudiante o grado
            <input
              className="input"
              placeholder="Ej: Maria o NOVENO"
              value={enrollmentSearch}
              onChange={(e) => setEnrollmentSearch(e.target.value)}
            />
          </label>
          <label>
            Grado para registro
            <select className="input" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
              <option value="">Todos los grados</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Estudiante / Grado
          <select
            className="input"
            value={form.enrollmentId}
            onChange={(e) => setForm({ ...form, enrollmentId: e.target.value })}
          >
            <option value="">Selecciona</option>
            {filteredEnrollments.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.student?.fullName} - {e.grade || getClassGradeLevel(e.class) || "-"} - {e.group || "-"}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-3">
          <label>
            Periodo
            <select className="input" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label>
            Aspecto
            <select className="input" value={form.aspect} onChange={(e) => setForm({ ...form, aspect: e.target.value })}>
              <option value="COGNITIVE">Cognitivo</option>
              <option value="PERSONAL">Personal</option>
              <option value="SOCIAL">Social</option>
            </select>
          </label>
          <label>
            Evaluacion
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
        </div>

        <div className="grid grid-2">
          <label>
            Nota obtenida
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={form.score}
              onChange={(e) => setForm({ ...form, score: e.target.value })}
            />
          </label>
          <label>
            Nota maxima
            <input
              className="input"
              type="number"
              min={0.01}
              step="0.01"
              value={form.maxScore}
              onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
            />
          </label>
        </div>

        <div className="help-card" style={{ marginTop: 10 }}>
          <div>
            <strong>Vista previa:</strong>{" "}
            {selectedEnrollment
              ? `${selectedEnrollment.student?.fullName} (${selectedEnrollment.grade || getClassGradeLevel(selectedEnrollment.class)})`
              : "Selecciona un estudiante"}
          </div>
          <div>
            Porcentaje de la nota: <strong>{boundedPercent.toFixed(2)}%</strong>
          </div>
          <div>
            Aporte al final segun ponderacion de {aspectLabel(form.aspect)} ({aspectWeight}%):{" "}
            <strong>{weightedContributionOver100.toFixed(2)}/100</strong> ({weightedContributionOver5.toFixed(2)}/5)
          </div>
        </div>

        <button className="button" style={{ marginTop: 10 }}>
          Guardar calificacion
        </button>
      </form>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select className="input" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
          <option value="">Todos los grados</option>
          {gradeOptions.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
        <select className="input" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
          <option value="">Todos los periodos</option>
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={[
          { key: "student", label: "Estudiante" },
          { key: "grade", label: "Grado" },
          { key: "group", label: "Grupo" },
          { key: "period", label: "Periodo" },
          { key: "name", label: "Evaluacion" },
          { key: "aspect", label: "Aspecto" },
          { key: "score", label: "Nota" }
        ]}
        rows={gradeRows.map((g: any) => ({
          id: g.id,
          student: g.enrollment?.student?.fullName || "",
          grade: g.grade || getClassGradeLevel(g.enrollment?.class) || "",
          group: g.group || "",
          period: g.period,
          name: g.name || "",
          aspect: aspectLabel(g.aspect),
          score: `${g.score}/${g.maxScore}`
        }))}
        rowKey="id"
      />

      <div className="section-title" style={{ marginTop: 12 }}>
        3) Nota final ponderada por estudiante
      </div>
      <DataTable
        columns={[
          { key: "student", label: "Estudiante" },
          { key: "grade", label: "Grado" },
          { key: "period", label: "Periodo" },
          { key: "cognitive", label: "Cognitivo %" },
          { key: "personal", label: "Personal %" },
          { key: "social", label: "Social %" },
          { key: "final100", label: "Final /100" },
          { key: "final5", label: "Final /5" }
        ]}
        rows={finalSummary.map((r, idx) => ({
          id: `${r.student}-${r.period}-${idx}`,
          student: r.student,
          grade: r.grade || "",
          period: r.period,
          cognitive: r.cognitiveAvg,
          personal: r.personalAvg,
          social: r.socialAvg,
          final100: r.finalOver100,
          final5: r.finalOver5
        }))}
        rowKey="id"
      />

      <div className="section-title" style={{ marginTop: 12 }}>
        Resumen por grado (final /100)
      </div>
      <DataTable
        columns={[
          { key: "grade", label: "Grado" },
          { key: "students", label: "Estudiantes" },
          { key: "avgFinal100", label: "Promedio final /100" }
        ]}
        rows={summaryByGrade}
      />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button className="button secondary" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <div style={{ alignSelf: "center", color: "#6b7280" }}>
          Pagina {page} de {Math.max(1, Math.ceil(total / 10))}
        </div>
        <button className="button secondary" disabled={loading || page >= Math.ceil(total / 10)} onClick={() => setPage(page + 1)}>
          Siguiente
        </button>
      </div>
    </Section>
  );
}

