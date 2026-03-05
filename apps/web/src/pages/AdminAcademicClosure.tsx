import React, { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiDownload, apiGet, apiPost, apiPut } from "../services/api";
import { gradeLabel, gradeOptions } from "../services/grades";

export default function AdminAcademicClosure() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rulesBusy, setRulesBusy] = useState(false);
  const [minAverageRule, setMinAverageRule] = useState("60");
  const [maxFailedRule, setMaxFailedRule] = useState("2");
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);

  const [statusFilter, setStatusFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [search, setSearch] = useState("");

  const query = useMemo(
    () =>
      new URLSearchParams({
        year,
        page: String(page),
        pageSize: "10",
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(gradeFilter ? { gradeLevel: gradeFilter } : {}),
        ...(groupFilter ? { group: groupFilter } : {}),
        ...(search ? { search } : {})
      }).toString(),
    [year, page, statusFilter, gradeFilter, groupFilter, search]
  );

  const load = () => {
    setLoading(true);
    setError("");
    apiGet(`/academic-closure?${query}`)
      .then((res) => {
        setRows(res.data || []);
        setTotal(Number(res.total || 0));
      })
      .catch((e: any) => setError(e?.message || "No se pudo cargar el cierre academico."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [query]);

  const loadSettings = () => {
    apiGet("/academic-closure/settings")
      .then((res) => {
        setMinAverageRule(String(res.minAverage ?? 60));
        setMaxFailedRule(String(res.maxFailedSubjects ?? 2));
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadHistory = () => {
    apiGet(`/academic-closure/settings/history?page=${historyPage}&pageSize=10`)
      .then((res) => {
        setHistoryRows(res.data || []);
        setHistoryTotal(Number(res.total || 0));
      })
      .catch(() => {
        setHistoryRows([]);
        setHistoryTotal(0);
      });
  };

  useEffect(() => {
    loadHistory();
  }, [historyPage]);

  const runClosure = async () => {
    setError("");
    setMessage("");
    try {
      const res = await apiPost("/academic-closure/run", { year: Number(year) });
      setMessage(
        `Cierre ejecutado: ${res.processed || 0} estudiantes procesados para ${res.year}. ` +
          `Reglas: promedio >= ${res?.rules?.minAverage ?? minAverageRule}, reprobadas <= ${res?.rules?.maxFailedSubjects ?? maxFailedRule}.`
      );
      setPage(1);
      load();
    } catch (e: any) {
      setError(e?.message || "No se pudo ejecutar el cierre.");
    }
  };

  const saveRules = async () => {
    setRulesBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await apiPut("/academic-closure/settings", {
        minAverage: Number(minAverageRule),
        maxFailedSubjects: Number(maxFailedRule)
      });
      setMinAverageRule(String(res.minAverage));
      setMaxFailedRule(String(res.maxFailedSubjects));
      setMessage(`Reglas guardadas: promedio >= ${res.minAverage}, reprobadas <= ${res.maxFailedSubjects}.`);
      setHistoryPage(1);
      loadHistory();
    } catch (e: any) {
      setError(e?.message || "No se pudieron guardar las reglas de promocion.");
    } finally {
      setRulesBusy(false);
    }
  };

  const restoreRulesVersion = async (id: string) => {
    if (!id) return;
    const confirmed = window.confirm("Restaurar esta version de reglas de promocion?");
    if (!confirmed) return;
    setError("");
    setMessage("");
    try {
      const res = await apiPost("/academic-closure/settings/restore", { id });
      setMessage(
        `Version restaurada. Reglas activas: promedio >= ${res?.promotionRules?.minAverage ?? "-"}, ` +
          `reprobadas <= ${res?.promotionRules?.maxFailedSubjects ?? "-"}.`
      );
      loadSettings();
      setHistoryPage(1);
      loadHistory();
    } catch (e: any) {
      setError(e?.message || "No se pudo restaurar la version.");
    }
  };

  const download = async (type: "excel" | "pdf") => {
    const blob = await apiDownload(`/academic-closure/export/${type}?${query.replace(/(^|&)page=[^&]*/g, "").replace(/(^|&)pageSize=[^&]*/g, "").replace(/^&/, "")}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = type === "excel" ? `cierre-academico-${year}.xlsx` : `cierre-academico-${year}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Section title="Cierre academico y promocion">
      <div className="help-card">
        Ejecuta el cierre por ano y consolida estado final: PROMOTED, NOT_PROMOTED o PENDING.
      </div>
      <div className="card">
        <div className="section-title" style={{ marginBottom: 8 }}>Reglas de promocion</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(110px, 1fr))", gap: 8, marginBottom: 8 }}>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            value={minAverageRule}
            onChange={(e) => setMinAverageRule(e.target.value)}
            placeholder="Promedio minimo"
          />
          <input
            className="input"
            type="number"
            min={0}
            max={20}
            value={maxFailedRule}
            onChange={(e) => setMaxFailedRule(e.target.value)}
            placeholder="Max reprobadas"
          />
          <button className="button secondary" type="button" onClick={saveRules} disabled={rulesBusy}>
            {rulesBusy ? "Guardando..." : "Guardar reglas"}
          </button>
        </div>

        <div className="section-title" style={{ marginBottom: 8 }}>Ejecucion de cierre</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(110px, 1fr))", gap: 8 }}>
          <input className="input" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Ano" />
          <select className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Todos los estados</option>
            <option value="PROMOTED">PROMOTED</option>
            <option value="NOT_PROMOTED">NOT_PROMOTED</option>
            <option value="PENDING">PENDING</option>
          </select>
          <select className="input" value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setPage(1); }}>
            <option value="">Todos los grados</option>
            {gradeOptions.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          <input className="input" placeholder="Grupo" value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }} />
          <input className="input" placeholder="Buscar estudiante" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <button className="button" type="button" onClick={runClosure}>Ejecutar cierre</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="button secondary" type="button" onClick={() => download("excel")}>Exportar Excel</button>
          <button className="button secondary" type="button" onClick={() => download("pdf")}>Exportar PDF</button>
        </div>
        {message && <div style={{ color: "#166534", marginTop: 8 }}>{message}</div>}
        {error && <div style={{ color: "#b91c1c", marginTop: 8 }}>{error}</div>}
      </div>

      <DataTable
        columns={[
          { key: "student", label: "Estudiante" },
          { key: "grade", label: "Grado" },
          { key: "group", label: "Grupo" },
          { key: "finalAverage", label: "Promedio final" },
          { key: "totalSubjects", label: "Asignaturas" },
          { key: "failedSubjects", label: "Reprobadas" },
          { key: "status", label: "Estado final" },
          { key: "closedBy", label: "Cerrado por" },
          { key: "closedAt", label: "Fecha cierre" }
        ]}
        rows={
          loading
            ? [{ student: "Cargando...", grade: "", group: "", finalAverage: "", totalSubjects: "", failedSubjects: "", status: "", closedBy: "", closedAt: "" }]
            : rows.map((r) => ({
                student: r.enrollment?.student?.fullName || r.enrollment?.studentFullName || "-",
                grade: r.enrollment?.class?.gradeLevel ? gradeLabel(r.enrollment.class.gradeLevel) : "-",
                group: r.enrollment?.student?.studentGroup || "-",
                finalAverage: Number(r.finalAverage || 0).toFixed(2),
                totalSubjects: r.totalSubjects,
                failedSubjects: r.failedSubjects,
                status: r.status,
                closedBy: r.closedBy?.fullName || "-",
                closedAt: String(r.closedAt || "").slice(0, 10)
              }))
        }
      />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
        <div style={{ alignSelf: "center", color: "#6b7280" }}>
          Pagina {page} de {Math.max(1, Math.ceil(total / 10))}
        </div>
        <button className="button secondary" disabled={page >= Math.ceil(total / 10)} onClick={() => setPage(page + 1)}>Siguiente</button>
      </div>

      <Section title="Historial de reglas de promocion">
        <DataTable
          columns={[
            { key: "changedAt", label: "Fecha" },
            { key: "changedBy", label: "Modificado por" },
            { key: "previous", label: "Regla anterior" },
            { key: "next", label: "Regla nueva" },
            { key: "origin", label: "Origen de restauracion" },
            { key: "actions", label: "Accion" }
          ]}
          rows={
            historyRows.length === 0
              ? [{ changedAt: "Sin cambios registrados", changedBy: "-", previous: "-", next: "-", origin: "-", actions: "", isRestored: "0" }]
              : historyRows.map((h) => ({
                  changedAt: String(h.changedAt || "").slice(0, 19).replace("T", " "),
                  changedBy: h.changedByName || h.changedById || "-",
                  previous: `Prom >= ${h.previous?.minAverage ?? "-"} | Rep <= ${h.previous?.maxFailedSubjects ?? "-"}`,
                  next: `Prom >= ${h.next?.minAverage ?? "-"} | Rep <= ${h.next?.maxFailedSubjects ?? "-"}`,
                  origin: h.restoredFrom
                    ? `Restaurada desde ${String(h.restoredFrom.changedAt || "").slice(0, 19).replace("T", " ")} por ${h.restoredFrom.changedByName || "-"} (Prom >= ${h.restoredFrom.next?.minAverage ?? "-"}, Rep <= ${h.restoredFrom.next?.maxFailedSubjects ?? "-"})`
                    : "-",
                  isRestored: h.restoredFromId ? "1" : "0",
                  actions: h.id ? (
                    <button className="button secondary" type="button" onClick={() => restoreRulesVersion(h.id)} style={{ padding: "4px 8px", fontSize: 12 }}>
                      Restaurar version
                    </button>
                  ) : (
                    "No disponible"
                  )
                }))
          }
          rowStyle={(row) =>
            String(row.isRestored || "0") === "1"
              ? { background: "#fffbeb" }
              : undefined
          }
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button className="button secondary" disabled={historyPage <= 1} onClick={() => setHistoryPage(historyPage - 1)}>Anterior</button>
          <div style={{ alignSelf: "center", color: "#6b7280" }}>
            Pagina {historyPage} de {Math.max(1, Math.ceil(historyTotal / 10))}
          </div>
          <button className="button secondary" disabled={historyPage >= Math.ceil(historyTotal / 10)} onClick={() => setHistoryPage(historyPage + 1)}>Siguiente</button>
        </div>
      </Section>
    </Section>
  );
}
