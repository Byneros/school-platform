import React, { useEffect, useMemo, useState } from "react";
import ActionFeedback from "../components/ActionFeedback";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiDownload, apiGet, apiPut } from "../services/api";
import { gradeOptions } from "../services/grades";
import { feedbackTitles, inferFeedbackTone } from "../utils/feedback";

type SubjectHour = {
  subject: string;
  hoursPerWeek: number;
  slots: Array<{ dayOfWeek: string; startTime: string; endTime: string; gradeLevel: string; group: string }>;
  autoMode?: boolean;
};

type TeacherHourRow = {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  subjects: SubjectHour[];
  totalHours: number;
};

function toMinutes(time: string) {
  const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return -1;
  return Number(match[1]) * 60 + Number(match[2]);
}

function toHoursFromSlots(
  slots: Array<{ dayOfWeek: string; startTime: string; endTime: string }>
) {
  const totalMinutes = slots.reduce((sum, slot) => {
    const start = toMinutes(slot.startTime || "");
    const end = toMinutes(slot.endTime || "");
    if (!slot.dayOfWeek || start < 0 || end < 0 || end <= start) return sum;
    return sum + (end - start);
  }, 0);
  return Number((totalMinutes / 60).toFixed(2));
}

export default function AdminTeacherHours() {
  const [rows, setRows] = useState<TeacherHourRow[]>([]);
  const [hoursDraft, setHoursDraft] = useState<Record<string, string>>({});
  const [collapsedSlots, setCollapsedSlots] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [loadError, setLoadError] = useState("");
  const storageKey = "school-platform:teacher-hours:collapsed";

  const load = () =>
    apiGet("/teacher/admin-subject-hours")
      .then((data) => {
        setLoadError("");
        const list = (data || []) as TeacherHourRow[];
        setRows(list);
        const next: Record<string, string> = {};
        list.forEach((r) => {
          r.subjects.forEach((s) => {
            const slots = s.slots || [];
            next[`${r.teacherId}::${s.subject}::auto`] = s.autoMode === false ? "0" : "1";
            next[`${r.teacherId}::${s.subject}`] = String(
              slots.length ? toHoursFromSlots(slots) : (s.hoursPerWeek ?? 0)
            );
            next[`${r.teacherId}::${s.subject}::slots`] = JSON.stringify(slots);
          });
        });
        setHoursDraft(next);
        if (!selectedTeacherId && list.length > 0) {
          setSelectedTeacherId(list[0].teacherId);
        }
      })
      .catch((error: any) => {
        setLoadError(error?.message || "No se pudieron cargar las horas docentes.");
      });

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setCollapsedSlots(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(collapsedSlots));
    } catch {
      // ignore
    }
  }, [collapsedSlots]);

  const MAX_RECOMMENDED_HOURS = 40;
  const visibleRows = selectedTeacherId ? rows.filter((r) => r.teacherId === selectedTeacherId) : rows;

  const totals = useMemo(() => {
    const map = new Map<string, { teacherName: string; total: number }>();
    rows.forEach((r) => {
      const prev = map.get(r.teacherId) || { teacherName: r.teacherName, total: 0 };
      const total = r.subjects.reduce((sum, s) => {
        const key = `${r.teacherId}::${s.subject}`;
        const hours = Number(hoursDraft[key] ?? s.hoursPerWeek ?? 0);
        return sum + (Number.isNaN(hours) ? 0 : hours);
      }, 0);
      prev.total += total;
      map.set(r.teacherId, prev);
    });
    return Array.from(map.values()).map((t) => ({
      ...t,
      overload: t.total > MAX_RECOMMENDED_HOURS
    }));
  }, [rows, hoursDraft]);

  const validation = useMemo(() => {
    const slotErrors: Record<string, { fields: Record<string, string>; message: string }> = {};
    const teacherHasErrors: Record<string, boolean> = {};
    const subjectMissingSlots: Record<string, boolean> = {};

    rows.forEach((r) => {
      const teacherIntervals: Array<{
        id: string;
        dayOfWeek: string;
        start: number;
        end: number;
        startTime: string;
        endTime: string;
        subject: string;
        gradeLevel: string;
        group: string;
      }> = [];
      r.subjects.forEach((s) => {
        const hoursKey = `${r.teacherId}::${s.subject}`;
        const hours = Number(hoursDraft[hoursKey] ?? s.hoursPerWeek ?? 0);
        const key = `${r.teacherId}::${s.subject}::slots`;
        let slots: Array<{ dayOfWeek: string; startTime: string; endTime: string; gradeLevel: string; group: string }> = [];
        try {
          slots = JSON.parse(hoursDraft[key] || "[]");
        } catch {
          slots = s.slots || [];
        }

        if (hours > 0 && slots.length === 0) {
          subjectMissingSlots[`${r.teacherId}::${s.subject}`] = true;
          teacherHasErrors[r.teacherId] = true;
        }

        const localKeyMap = new Map<string, number[]>();
        slots.forEach((slot, idx) => {
          const fields: Record<string, string> = {};
          if (!slot.gradeLevel) fields.gradeLevel = "Grado requerido";
          if (!slot.group) fields.group = "Grupo requerido";
          if (!slot.dayOfWeek) fields.dayOfWeek = "Dia requerido";
          if (!slot.startTime) fields.startTime = "Hora inicio requerida";
          if (!slot.endTime) fields.endTime = "Hora fin requerida";
          if (slot.startTime && slot.endTime) {
            const start = toMinutes(slot.startTime);
            const end = toMinutes(slot.endTime);
            if (start < 0 || end < 0 || start >= end) {
              fields.startTime = "Rango invalido";
              fields.endTime = "Rango invalido";
            } else if (slot.dayOfWeek) {
              teacherIntervals.push({
                id: `${r.teacherId}::${s.subject}::${idx}`,
                dayOfWeek: slot.dayOfWeek,
                start,
                end,
                startTime: slot.startTime,
                endTime: slot.endTime,
                subject: s.subject,
                gradeLevel: slot.gradeLevel,
                group: slot.group
              });
            }
          }
          const dedupeKey = `${slot.gradeLevel}|${slot.group}|${slot.dayOfWeek}|${slot.startTime}|${slot.endTime}`;
          if (slot.gradeLevel && slot.group && slot.dayOfWeek && slot.startTime && slot.endTime) {
            const items = localKeyMap.get(dedupeKey) || [];
            items.push(idx);
            localKeyMap.set(dedupeKey, items);
          }
          if (Object.keys(fields).length > 0) {
            const id = `${r.teacherId}::${s.subject}::${idx}`;
            slotErrors[id] = {
              fields,
              message: Object.values(fields).join(", ")
            };
            teacherHasErrors[r.teacherId] = true;
          }
        });
        localKeyMap.forEach((indexes) => {
          if (indexes.length < 2) return;
          indexes.forEach((idx) => {
            const id = `${r.teacherId}::${s.subject}::${idx}`;
            const prev = slotErrors[id];
            slotErrors[id] = {
              fields: { ...(prev?.fields || {}), duplicate: "Franja duplicada" },
              message: prev?.message
                ? `${prev.message}, franja duplicada`
                : "Franja duplicada"
            };
            teacherHasErrors[r.teacherId] = true;
          });
        });
      });

      for (let i = 0; i < teacherIntervals.length; i += 1) {
        for (let j = i + 1; j < teacherIntervals.length; j += 1) {
          const a = teacherIntervals[i];
          const b = teacherIntervals[j];
          if (a.dayOfWeek === b.dayOfWeek && a.start < b.end && b.start < a.end) {
            const mark = (id: string, message: string) => {
              const prev = slotErrors[id];
              slotErrors[id] = {
                fields: { ...(prev?.fields || {}), overlap: "Cruce de horario" },
                message: prev?.message
                  ? `${prev.message}, ${message}`
                  : message
              };
              teacherHasErrors[r.teacherId] = true;
            };
            const msgA = `Cruce con ${b.subject} ${b.gradeLevel}-${b.group} ${b.dayOfWeek} ${b.startTime}-${b.endTime}`;
            const msgB = `Cruce con ${a.subject} ${a.gradeLevel}-${a.group} ${a.dayOfWeek} ${a.startTime}-${a.endTime}`;
            mark(a.id, msgA);
            mark(b.id, msgB);
          }
        }
      }
    });

    return { slotErrors, teacherHasErrors, subjectMissingSlots };
  }, [rows, hoursDraft]);

  const weeklySummary = useMemo(() => {
    const days = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

    return rows.map((r) => {
      const totalsByDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
      const gradeGroupByDay: Record<string, Set<string>> = Object.fromEntries(days.map((d) => [d, new Set<string>()]));
      r.subjects.forEach((s) => {
        let slots: Array<{ dayOfWeek: string; startTime: string; endTime: string }> = [];
        try {
          const raw = hoursDraft[`${r.teacherId}::${s.subject}::slots`];
          slots = raw ? JSON.parse(raw) : s.slots || [];
        } catch {
          slots = s.slots || [];
        }
        slots.forEach((slot) => {
          const day = slot.dayOfWeek;
          if (!(day in totalsByDay)) return;
          if (slot.gradeLevel && slot.group) {
            gradeGroupByDay[day].add(`${slot.gradeLevel}-${slot.group}`);
          } else if (slot.gradeLevel) {
            gradeGroupByDay[day].add(slot.gradeLevel);
          } else if (slot.group) {
            gradeGroupByDay[day].add(slot.group);
          }
          const start = toMinutes(slot.startTime);
          const end = toMinutes(slot.endTime);
          if (end > start) totalsByDay[day] += end - start;
        });
      });
      const toHours = (mins: number) => Number((mins / 60).toFixed(2));
      const formatDay = (day: string) => {
        const hours = toHours(totalsByDay[day]);
        const grades = Array.from(gradeGroupByDay[day]);
        if (grades.length === 0) return String(hours);
        return (
          <div>
            <div>{hours}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12, color: "#64748b" }}>
              {grades.map((g) => (
                <span key={g}>{g}</span>
              ))}
            </div>
          </div>
        );
      };
      return {
        teacher: r.teacherName,
        LUNES: formatDay("LUNES"),
        MARTES: formatDay("MARTES"),
        MIERCOLES: formatDay("MIERCOLES"),
        JUEVES: formatDay("JUEVES"),
        VIERNES: formatDay("VIERNES"),
        SABADO: formatDay("SABADO")
      };
    });
  }, [rows, hoursDraft]);

  const weeklyDetails = useMemo(() => {
    return rows.flatMap((r) => {
      return r.subjects.flatMap((s) => {
        let slots: Array<{ dayOfWeek: string; startTime: string; endTime: string; gradeLevel: string; group: string }> = [];
        try {
          const raw = hoursDraft[`${r.teacherId}::${s.subject}::slots`];
          slots = raw ? JSON.parse(raw) : s.slots || [];
        } catch {
          slots = s.slots || [];
        }
        return slots.map((slot, idx) => ({
          teacherId: r.teacherId,
          subject: s.subject,
          slotIndex: idx,
          teacher: r.teacherName,
          grade: slot.gradeLevel || "-",
          group: slot.group || "-",
          day: slot.dayOfWeek || "-",
          start: slot.startTime || "-",
          end: slot.endTime || "-",
        }));
      });
    });
  }, [rows, hoursDraft]);

  const buildSubjectHours = (teacherId: string, draft: Record<string, string>) => {
    const teacher = rows.find((r) => r.teacherId === teacherId);
    if (!teacher) return null;
    return teacher.subjects.map((s) => ({
      subject: s.subject,
      hoursPerWeek: Number(draft[`${teacherId}::${s.subject}`] ?? s.hoursPerWeek ?? 0),
      autoMode: draft[`${teacherId}::${s.subject}::auto`] !== "0",
      slots: (() => {
        const raw = draft[`${teacherId}::${s.subject}::slots`];
        try {
          const parsed = raw ? JSON.parse(raw) : s.slots || [];
          return parsed;
        } catch {
          return s.slots || [];
        }
      })()
    }));
  };

  const saveHours = async (teacherId: string, draftOverride?: Record<string, string>) => {
    const teacher = rows.find((r) => r.teacherId === teacherId);
    if (!teacher) return;
    const draft = draftOverride || hoursDraft;
    const subjectHours = buildSubjectHours(teacherId, draft);
    if (!subjectHours) return;
    if (subjectHours.some((s) => Number.isNaN(s.hoursPerWeek))) return;

    setBusyId(teacherId);
    setMessage("");
    try {
      const updated = await apiPut(`/teacher/${teacherId}/subject-hours`, { subjectHours });
      setRows((prev) => prev.map((r) => (r.teacherId === teacherId ? { ...r, ...updated } : r)));
      setMessage("Horas actualizadas correctamente.");
    } catch (error: any) {
      setMessage(error?.message || "No se pudo actualizar la asignacion de horas.");
    } finally {
      setBusyId("");
    }
  };

  const downloadFile = async (path: string, filename: string) => {
    const blob = await apiDownload(path);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Section title="Asignacion de horas docentes">
      <div className="help-card">
        Define las horas semanales por asignatura dictada para cada docente.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button
          type="button"
          className="button secondary"
          onClick={() => downloadFile("/teacher/admin-subject-hours/export/excel", "horario-docentes.xlsx")}
        >
          Exportar horario docentes
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => downloadFile("/teacher/admin-students-format/export/excel", "formato-estudiantes.xlsx")}
        >
          Exportar formato estudiantes
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => downloadFile("/teacher/admin-subject-hours/export/pdf", "horario-docentes.pdf")}
        >
          PDF horario docentes
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => downloadFile("/teacher/admin-students-format/export/pdf", "formato-estudiantes.pdf")}
        >
          PDF formato estudiantes
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 260 }}>
          Docente
          <select className="input" value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} style={{ maxWidth: 420 }}>
            {rows.map((r) => (
              <option key={r.teacherId} value={r.teacherId}>
                {r.teacherName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ActionFeedback
        tone={inferFeedbackTone(message)}
        title={feedbackTitles.teacherHours.success}
        message={message}
        onDismiss={() => setMessage("")}
        style={{ marginBottom: 8 }}
      />
      <ActionFeedback
        tone="error"
        title={feedbackTitles.teacherHours.error}
        message={loadError}
        onDismiss={() => setLoadError("")}
        style={{ marginBottom: 8 }}
      />
      <div style={{ display: "grid", gap: 10 }}>
        {visibleRows.map((r) => (
          <div key={r.teacherId} className="card">
            <div className="section-head" style={{ marginBottom: 12, alignItems: "center" }}>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 700 }}>{r.teacherName}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{r.teacherEmail}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {validation.teacherHasErrors[r.teacherId] && (
                  <span style={{ fontSize: 12, color: "#dc2626" }}>Corrige los campos resaltados.</span>
                )}
                <button
                  className="button secondary"
                  onClick={() => saveHours(r.teacherId)}
                  disabled={busyId === r.teacherId || validation.teacherHasErrors[r.teacherId]}
                >
                  {busyId === r.teacherId ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
            <DataTable
              columns={[
                { key: "teacher", label: "Docente" },
                { key: "subject", label: "Asignatura" },
                { key: "hours", label: "Horas/semana" },
                { key: "slots", label: "Grado / Grupo / Horario" }
              ]}
              rows={r.subjects.map((s) => ({
                teacher: r.teacherName,
                subject: s.subject,
                hours: (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={60}
                      readOnly={hoursDraft[`${r.teacherId}::${s.subject}::auto`] !== "0"}
                      value={hoursDraft[`${r.teacherId}::${s.subject}`] ?? "0"}
                      onChange={(e) =>
                        setHoursDraft((prev) => ({
                          ...prev,
                          [`${r.teacherId}::${s.subject}`]: e.target.value
                        }))
                      }
                      style={{
                        maxWidth: 120,
                        textAlign: "center",
                        background:
                          hoursDraft[`${r.teacherId}::${s.subject}::auto`] !== "0" ? "#f8fafc" : "white"
                      }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}>
                      <input
                        type="checkbox"
                        checked={hoursDraft[`${r.teacherId}::${s.subject}::auto`] !== "0"}
                        onChange={(e) => {
                          const auto = e.target.checked;
                          setHoursDraft((prev) => {
                            const next = { ...prev, [`${r.teacherId}::${s.subject}::auto`]: auto ? "1" : "0" };
                            if (auto) {
                              const raw = prev[`${r.teacherId}::${s.subject}::slots`];
                              try {
                                const parsed = raw ? JSON.parse(raw) : [];
                                next[`${r.teacherId}::${s.subject}`] = String(toHoursFromSlots(parsed));
                              } catch {
                                // ignore
                              }
                            }
                            return next;
                          });
                        }}
                      />
                      Auto
                    </label>
                  </div>
                ),
                slots: (() => {
                  const key = `${r.teacherId}::${s.subject}::slots`;
                  let slots: Array<{ dayOfWeek: string; startTime: string; endTime: string; gradeLevel: string; group: string }> = [];
                  try {
                    slots = JSON.parse(hoursDraft[key] || "[]");
                  } catch {
                    slots = s.slots || [];
                  }
                  const updateSlots = (next: typeof slots) => {
                    setHoursDraft((prev) => ({
                      ...prev,
                      [key]: JSON.stringify(next),
                      ...(prev[`${r.teacherId}::${s.subject}::auto`] !== "0"
                        ? { [`${r.teacherId}::${s.subject}`]: String(toHoursFromSlots(next)) }
                        : {})
                    }));
                  };
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {slots.map((slot, idx) => (
                        <div key={`${s.subject}-${idx}`} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
                          <div
                            className="teacher-hours-slot-grid"
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "minmax(140px, 1.2fr) minmax(80px, 0.6fr) minmax(120px, 1fr) minmax(110px, 0.8fr) minmax(110px, 0.8fr) minmax(170px, 1fr)",
                              gap: 6,
                              alignItems: "center"
                            }}
                          >
                          {(() => {
                            const errorKey = `${r.teacherId}::${s.subject}::${idx}`;
                            const err = validation.slotErrors[errorKey];
                            const errorStyle = (field: string) =>
                              err?.fields?.[field] || err?.fields?.duplicate
                                ? { borderColor: "#dc2626", boxShadow: "0 0 0 1px rgba(220,38,38,0.25)" }
                                : undefined;
                            const collapseKey = `${r.teacherId}::${s.subject}::${idx}`;
                            const isCollapsed = collapsedSlots[collapseKey];
                            if (isCollapsed) {
                              return (
                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 12, color: "#64748b" }}>
                                    {slot.gradeLevel || "Grado"}-{slot.group || "Grupo"} {slot.dayOfWeek || "Dia"} {slot.startTime || "--:--"}-{slot.endTime || "--:--"}
                                  </span>
                                  <button
                                    type="button"
                                    className="button secondary"
                                    onClick={() => setCollapsedSlots((prev) => ({ ...prev, [collapseKey]: false }))}
                                  >
                                    Mostrar
                                  </button>
                                  <button
                                    type="button"
                                    className="button danger"
                                    onClick={() => {
                                      const ok = window.confirm(
                                        `Quitar la franja ${slot.gradeLevel || "-"}-${slot.group || "-"} ${slot.dayOfWeek || "-"} ${slot.startTime || "--:--"}-${slot.endTime || "--:--"} de ${s.subject}?`
                                      );
                                      if (!ok) return;
                                      updateSlots(slots.filter((_, i) => i !== idx));
                                    }}
                                  >
                                    Quitar
                                  </button>
                                </div>
                              );
                            }
                            return (
                              <>
                          <select
                            className="input"
                            value={slot.gradeLevel}
                            onChange={(e) => {
                              const next = [...slots];
                              next[idx] = { ...next[idx], gradeLevel: e.target.value };
                              updateSlots(next);
                            }}
                            style={{ minWidth: 140, ...errorStyle("gradeLevel") }}
                          >
                            <option value="">Grado</option>
                            {gradeOptions.map((g) => (
                              <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                          </select>
                          <input
                            className="input"
                            value={slot.group}
                            onChange={(e) => {
                              const next = [...slots];
                              next[idx] = { ...next[idx], group: e.target.value };
                              updateSlots(next);
                            }}
                            placeholder="Grupo"
                            style={{ maxWidth: 90, ...errorStyle("group") }}
                          />
                          <select
                            className="input"
                            value={slot.dayOfWeek}
                            onChange={(e) => {
                              const next = [...slots];
                              next[idx] = { ...next[idx], dayOfWeek: e.target.value };
                              updateSlots(next);
                            }}
                            style={{ minWidth: 120, ...errorStyle("dayOfWeek") }}
                          >
                            <option value="">Selecciona</option>
                            <option value="LUNES">Lunes</option>
                            <option value="MARTES">Martes</option>
                            <option value="MIERCOLES">Miercoles</option>
                            <option value="JUEVES">Jueves</option>
                            <option value="VIERNES">Viernes</option>
                            <option value="SABADO">Sabado</option>
                          </select>
                          <input
                            className="input"
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => {
                              const next = [...slots];
                              next[idx] = { ...next[idx], startTime: e.target.value };
                              updateSlots(next);
                            }}
                            style={{ maxWidth: 110, ...errorStyle("startTime") }}
                          />
                          <input
                            className="input"
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => {
                              const next = [...slots];
                              next[idx] = { ...next[idx], endTime: e.target.value };
                              updateSlots(next);
                            }}
                            style={{ maxWidth: 110, ...errorStyle("endTime") }}
                          />
                          <div className="teacher-hours-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => setCollapsedSlots((prev) => ({ ...prev, [collapseKey]: true }))}
                            >
                              Ocultar
                            </button>
                            <button
                              type="button"
                              className="button danger"
                              onClick={() => {
                                const ok = window.confirm(
                                  `Quitar la franja ${slot.gradeLevel || "-"}-${slot.group || "-"} ${slot.dayOfWeek || "-"} ${slot.startTime || "--:--"}-${slot.endTime || "--:--"} de ${s.subject}?`
                                );
                                if (!ok) return;
                                updateSlots(slots.filter((_, i) => i !== idx));
                              }}
                            >
                              Quitar
                            </button>
                          </div>
                              </>
                            );
                          })()}
                          </div>
                          {(() => {
                            const errorKey = `${r.teacherId}::${s.subject}::${idx}`;
                            const err = validation.slotErrors[errorKey];
                            if (!err) return null;
                            return (
                              <div style={{ fontSize: 12, color: "#dc2626" }}>
                                {err.message}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                      {validation.subjectMissingSlots[`${r.teacherId}::${s.subject}`] && (
                        <div style={{ fontSize: 12, color: "#dc2626" }}>
                          Debes agregar al menos una franja para esta asignatura.
                        </div>
                      )}
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => updateSlots([...slots, { dayOfWeek: "", startTime: "", endTime: "", gradeLevel: "", group: "" }])}
                      >
                        Agregar franja
                      </button>
                    </div>
                  );
                })()
              }))}
            />
          </div>
        ))}
      </div>
      <div className="section-title" style={{ marginTop: 12 }}>Total por docente</div>
      <DataTable
        columns={[
          { key: "teacher", label: "Docente" },
          { key: "total", label: "Total horas/semana" },
          { key: "alert", label: "Estado" }
        ]}
        rows={totals.map((t) => ({
          teacher: t.teacherName,
          total: t.total,
          alert: t.overload ? (
            <span className="status-badge status-rejected">Sobrecarga</span>
          ) : (
            <span className="status-badge status-approved">Normal</span>
          )
        }))}
      />
      <div style={{ marginTop: 8, color: "#64748b" }}>
        Limite recomendado: {MAX_RECOMMENDED_HOURS} horas por semana.
      </div>
      <div className="section-title" style={{ marginTop: 12 }}>Resumen semanal por docente</div>
      <DataTable
        columns={[
          { key: "teacher", label: "Docente" },
          { key: "LUNES", label: "Lunes (h / grado-grupo)" },
          { key: "MARTES", label: "Martes (h / grado-grupo)" },
          { key: "MIERCOLES", label: "Miercoles (h / grado-grupo)" },
          { key: "JUEVES", label: "Jueves (h / grado-grupo)" },
          { key: "VIERNES", label: "Viernes (h / grado-grupo)" },
          { key: "SABADO", label: "Sabado (h / grado-grupo)" }
        ]}
        rows={weeklySummary}
      />
      <div className="section-title" style={{ marginTop: 12 }}>Detalle de franjas (vista inmediata)</div>
      <DataTable
        columns={[
          { key: "teacher", label: "Docente" },
          { key: "subject", label: "Asignatura" },
          { key: "grade", label: "Grado" },
          { key: "group", label: "Grupo" },
          { key: "day", label: "Dia" },
          { key: "start", label: "Inicio" },
          { key: "end", label: "Fin" },
          { key: "actions", label: "Acciones" }
        ]}
        rows={weeklyDetails.map((row) => ({
          ...row,
          actions: (
            <button
              className="button danger"
              type="button"
              onClick={() => {
                const ok = window.confirm(
                  `Eliminar la franja de ${row.subject} para ${row.teacher} (${row.grade}-${row.group} ${row.day} ${row.start}-${row.end})?`
                );
                if (!ok) return;
                const key = `${row.teacherId}::${row.subject}::slots`;
                let slots: Array<{ dayOfWeek: string; startTime: string; endTime: string; gradeLevel: string; group: string }> = [];
                try {
                  slots = JSON.parse(hoursDraft[key] || "[]");
                } catch {
                  slots = [];
                }
                const next = slots.filter((_, i) => i !== row.slotIndex);
                const nextDraft = { ...hoursDraft, [key]: JSON.stringify(next) };
                setHoursDraft(nextDraft);
                if (!validation.teacherHasErrors[row.teacherId]) {
                  saveHours(row.teacherId, nextDraft);
                }
              }}
            >
              Eliminar
            </button>
          )
        }))}
      />
    </Section>
  );
}
