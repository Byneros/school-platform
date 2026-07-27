import React, { useEffect, useMemo, useState } from "react";

import ActionFeedback from "../components/ActionFeedback";
import DataTable from "../components/DataTable";
import Section from "../components/Section";
import { useAuth } from "../context/AuthContext";
import { apiDownload, apiGet, apiPost } from "../services/api";
import { feedbackTitles } from "../utils/feedback";

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeGradeKey(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .split("-")[0]
    .trim();
}

function normalizeGroupKey(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function parseGradeGroupEntry(entry: string) {
  const raw = String(entry || "")
    .trim()
    .toUpperCase();
  const [grade, ...rest] = raw
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    grade: grade || "",
    group: rest.join("-") || "",
  };
}

function getClassGradeLevel(classData?: Partial<ClassSummary> | null) {
  return String(classData?.gradeLevel || "").trim();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ha ocurrido un error.";
}

type RegisterAttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface TeacherSummary {
  teacherId: string;
  teacherName: string;
}

interface StudentSummary {
  id: string;
  fullName: string;
  studentGroup?: string;
}

interface ClassSummary {
  id: string;
  name?: string;
  gradeLevel: string;
}

interface EnrollmentSummary {
  id: string;
  student: StudentSummary;
  class: ClassSummary;
}

interface AttendanceRecord {
  enrollmentId: string;
  status: RegisterAttendanceStatus;
}

interface AttendanceHistoryRecord {
  date?: string;
  status: RegisterAttendanceStatus;
  teacherName?: string;

  enrollment?: {
    student?: {
      fullName?: string;
      studentGroup?: string;
    };

    class?: {
      gradeLevel?: string;

      teacher?: {
        user?: {
          fullName?: string;
        };
      };
    };
  };
}

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
  ONCE: 14,
};

function sortGradesAcademic(values: string[]) {
  return [...values].sort((a, b) => {
    const oa = GRADE_ORDER[normalizeGradeKey(a)] ?? 999;
    const ob = GRADE_ORDER[normalizeGradeKey(b)] ?? 999;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b, "es", { numeric: true });
  });
}

export default function TeacherAttendance() {
  const { user } = useAuth();
  const isAdminView = user?.role === "ADMIN";
  const [enrollments, setEnrollments] = useState<EnrollmentSummary[]>([]);
  const [attendance, setAttendance] = useState<AttendanceHistoryRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [historyStudentFilter, setHistoryStudentFilter] = useState("");
  const [historyGradeFilter, setHistoryGradeFilter] = useState("");
  const [historyGroupFilter, setHistoryGroupFilter] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [historyTeacherFilter, setHistoryTeacherFilter] = useState("");
  const [adminGroupOptions, setAdminGroupOptions] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; fullName: string }>>([]);
  const [gradeCatalog, setGradeCatalog] = useState<
    Array<{ id: string; name: string; gradeLevel: string }>
  >([]);
  const [consultGradeFilter, setConsultGradeFilter] = useState("");
  const [consultGroupFilter, setConsultGroupFilter] = useState("");
  const [registerGradeFilter, setRegisterGradeFilter] = useState("");
  const [registerGroupFilter, setRegisterGroupFilter] = useState("");
  const [registerDate] = useState(() => toLocalDateInputValue(new Date()));
  const [registerStatuses, setRegisterStatuses] = useState<
    Record<string, RegisterAttendanceStatus>
  >({});
  const [saveBusy, setSaveBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportPdfBusy, setExportPdfBusy] = useState(false);
  const [exportGradeDatesBusy, setExportGradeDatesBusy] = useState(false);
  const [exportGradeDatesPdfBusy, setExportGradeDatesPdfBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [todayWindows, setTodayWindows] = useState<{
    dayOfWeek: string;
    grades: string[];
    gradeGroups?: string[];
  }>({
    dayOfWeek: "",
    grades: [],
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const todayDate = new Date(nowMs);
  const todayString = toLocalDateInputValue(todayDate);
  const registerCutoff = new Date(todayDate);
  registerCutoff.setHours(23, 59, 59, 999);
  const isRegisterWindowOpen = nowMs <= registerCutoff.getTime() && registerDate === todayString;
  /*
    useEffect(() => {
      if (registerDate !== todayString) {
        setRegisterDate(todayString);
        setRegisterStatuses({});
      }
    }, [todayString, registerDate]);
  */
  const loadBase = () => {
    if (isAdminView) {
      apiGet("/teacher/admin-subject-hours")
        .then((res) => {
          const data = Array.isArray(res) ? res : [];
          setTeachers(
            data
              .map((t: TeacherSummary) => ({
                id: String(t.teacherId || ""),
                fullName: String(t.teacherName || ""),
              }))
              .filter((t) => t.id && t.fullName)
          );
        })
        .catch(() => setTeachers([]));
      apiGet("/classes/simple")
        .then((res) => {
          const list = Array.isArray(res) ? res : [];
          const unique = new Map<string, { id: string; name: string; gradeLevel: string }>();
          list.forEach((c: ClassSummary) => {
            const gradeLevel = getClassGradeLevel(c);
            if (!gradeLevel) return;
            const id = `grade:${gradeLevel}`;
            unique.set(id, {
              id,
              name: gradeLevel,
              gradeLevel,
            });
          });
          setGradeCatalog(Array.from(unique.values()));
        })
        .catch(() => setGradeCatalog([]));
      apiGet("/enrollments?page=0&pageSize=1")
        .then((res) => {
          const list: EnrollmentSummary[] = Array.isArray(res?.data)
            ? (res.data as EnrollmentSummary[])
            : Array.isArray(res)
              ? (res as EnrollmentSummary[])
              : [];
          const groups = Array.from(
            new Set<string>(
              list
                .map((item: EnrollmentSummary) =>
                  normalizeGroupKey(String(item?.student?.studentGroup || ""))
                )
                .filter((value): value is string => Boolean(value))
            )
          ).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
          setAdminGroupOptions(groups);
        })
        .catch(() => setAdminGroupOptions([]));
      return;
    }
    apiGet("/teacher/attendance/windows")
      .then((res) => setTodayWindows(res))
      .catch(() => undefined);
    apiGet("/teacher/enrollments?today=1")
      .then((res) => {
        const list = res || [];
        setEnrollments(list);
        const unique = new Map<string, { id: string; name: string; gradeLevel: string }>();
        list.forEach((e: EnrollmentSummary) => {
          const gradeLevel = getClassGradeLevel(e.class);
          if (!gradeLevel) return;
          const id = `grade:${gradeLevel}`;
          unique.set(id, {
            id,
            name: gradeLevel,
            gradeLevel,
          });
        });
        setGradeCatalog(Array.from(unique.values()));
      })
      .catch(() => undefined);
  };

  const loadHistory = () => {
    apiGet(
      `/teacher/attendance?page=${page}&pageSize=1&paginateByDate=1${!isAdminView ? "&validToday=1" : ""}${statusFilter ? `&status=${statusFilter}` : ""}${historyStudentFilter ? `&student=${encodeURIComponent(historyStudentFilter)}` : ""}${historyGradeFilter ? `&gradeLevel=${historyGradeFilter}` : ""}${historyGroupFilter ? `&group=${encodeURIComponent(historyGroupFilter)}` : ""}${historyDateFilter ? `&date=${historyDateFilter}` : ""}${isAdminView && historyTeacherFilter ? `&teacherId=${historyTeacherFilter}` : ""}`
    )
      .then((res) => {
        setAttendance(res.data || []);
        setTotal(res.total || 0);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    loadBase();
  }, [isAdminView]);

  useEffect(() => {
    loadHistory();
  }, [
    page,
    statusFilter,
    historyStudentFilter,
    historyGradeFilter,
    historyGroupFilter,
    historyDateFilter,
    historyTeacherFilter,
    isAdminView,
  ]);
  /*
    useEffect(() => {
      setPage(1);
    }, [
      statusFilter,
      historyStudentFilter,
      historyGradeFilter,
      historyGroupFilter,
      historyDateFilter,
      historyTeacherFilter,
    ]);
  */
  const isSunday = normalizeGradeKey(todayWindows.dayOfWeek) === "DOMINGO";
  const hasTodayWindows =
    enrollments.length > 0 ||
    (todayWindows.grades && todayWindows.grades.length > 0) ||
    (todayWindows.gradeGroups && todayWindows.gradeGroups.length > 0);
  const validTodayCourses = useMemo(() => gradeCatalog, [gradeCatalog]);
  const validTodayGrades = useMemo(
    () => sortGradesAcademic(Array.from(new Set(validTodayCourses.map((c) => c.gradeLevel)))),
    [validTodayCourses]
  );
  const allTeacherGrades = useMemo(
    () => sortGradesAcademic(Array.from(new Set(gradeCatalog.map((c) => c.gradeLevel)))),
    [gradeCatalog]
  );
  const filteredTodayCourses = useMemo(
    () =>
      consultGradeFilter
        ? validTodayCourses.filter(
            (c) => normalizeGradeKey(c.gradeLevel) === normalizeGradeKey(consultGradeFilter)
          )
        : validTodayCourses,
    [validTodayCourses, consultGradeFilter]
  );
  const validTodayGroups = useMemo(() => {
    const pairs = (todayWindows.gradeGroups || []).map(parseGradeGroupEntry);
    const groups = pairs
      .filter((pair) => pair.group)
      .filter(
        (pair) =>
          !consultGradeFilter ||
          normalizeGradeKey(pair.grade) === normalizeGradeKey(consultGradeFilter)
      )
      .map((pair) => normalizeGroupKey(pair.group))
      .filter(Boolean);
    return Array.from(new Set(groups)).sort();
  }, [todayWindows.gradeGroups, consultGradeFilter]);
  const historyValidGroups = useMemo(() => {
    const pairs = (todayWindows.gradeGroups || []).map(parseGradeGroupEntry);
    const groups = pairs
      .filter((pair) => pair.group)
      .filter(
        (pair) =>
          !historyGradeFilter ||
          normalizeGradeKey(pair.grade) === normalizeGradeKey(historyGradeFilter)
      )
      .map((pair) => normalizeGroupKey(pair.group))
      .filter(Boolean);
    return Array.from(new Set(groups)).sort();
  }, [todayWindows.gradeGroups, historyGradeFilter]);
  const registerEnrollments = useMemo(
    () =>
      enrollments.filter(
        (e) =>
          (!registerGradeFilter || getClassGradeLevel(e.class) === registerGradeFilter) &&
          (!registerGroupFilter ||
            normalizeGroupKey(String(e.student?.studentGroup || "")) ===
              normalizeGroupKey(registerGroupFilter))
      ),
    [enrollments, registerGradeFilter, registerGroupFilter]
  );
  const validRegisterGroups = useMemo(() => {
    const pairs = (todayWindows.gradeGroups || []).map(parseGradeGroupEntry);
    const groups = pairs
      .filter((pair) => pair.group)
      .filter(
        (pair) =>
          !registerGradeFilter ||
          normalizeGradeKey(pair.grade) === normalizeGradeKey(registerGradeFilter)
      )
      .map((pair) => normalizeGroupKey(pair.group))
      .filter(Boolean);
    return Array.from(new Set(groups)).sort();
  }, [todayWindows.gradeGroups, registerGradeFilter]);
  const todayCourseStudents = useMemo(
    () =>
      filteredTodayCourses.map((course) => {
        const students = enrollments
          .filter(
            (e) =>
              normalizeGradeKey(getClassGradeLevel(e.class)) ===
              normalizeGradeKey(course.gradeLevel)
          )
          .map((e) => ({
            enrollmentId: String(e.id || ""),
            fullName: String(e.student?.fullName || ""),
            gradeLevel: getClassGradeLevel(e.class),
            group: String(e.student?.studentGroup || ""),
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName));

        return {
          ...course,
          students,
        };
      }),
    [filteredTodayCourses, enrollments]
  );
  const visibleTodayCourseStudents = useMemo(() => {
    const list = todayCourseStudents.map((course) => ({
      ...course,
      students: consultGroupFilter
        ? course.students.filter(
            (student) =>
              normalizeGroupKey(String(student.group || "")) ===
              normalizeGroupKey(consultGroupFilter)
          )
        : course.students,
    }));
    return consultGroupFilter ? list.filter((course) => course.students.length > 0) : list;
  }, [todayCourseStudents, consultGroupFilter]);
  const studentsBySelectedFilters = useMemo(
    () =>
      visibleTodayCourseStudents
        .flatMap((course) =>
          course.students.map((student) => ({
            enrollmentId: student.enrollmentId,
            fullName: student.fullName,
            gradeLevel: student.gradeLevel,
            group: student.group,
            gradeName: course.name,
          }))
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [visibleTodayCourseStudents]
  );

  useEffect(() => {
    /*
    if (registerGradeFilter && !validTodayGrades.includes(registerGradeFilter)) {
      setRegisterGradeFilter("");
      setRegisterGroupFilter("");
      setRegisterStatuses({});
    }
    */
    /*
     if (registerGroupFilter && !validRegisterGroups.includes(registerGroupFilter)) {
       setRegisterGroupFilter("");
       setRegisterStatuses({});
     }
     */
    /*
    if (consultGradeFilter && !validTodayGrades.includes(consultGradeFilter)) {
      setConsultGradeFilter("");
    }
    */
    /*
     if (consultGroupFilter && !validTodayGroups.includes(consultGroupFilter)) {
       setConsultGroupFilter("");
     }
       */
    /*
    if (historyGroupFilter && !historyValidGroups.includes(historyGroupFilter)) {
      setHistoryGroupFilter("");
    }
      */
  }, [
    validTodayGrades,
    registerGradeFilter,
    registerGroupFilter,
    validRegisterGroups,
    consultGradeFilter,
    consultGroupFilter,
    validTodayGroups,
    historyGroupFilter,
    historyValidGroups,
  ]);

  useEffect(() => {
    if (!registerDate) {
      return;
    }

    const initial: Record<string, RegisterAttendanceStatus> = {};
    registerEnrollments.forEach((e) => {
      initial[e.id] = "PRESENT";
    });

    apiGet(
      `/teacher/attendance?page=1&pageSize=500${registerGradeFilter ? `&gradeLevel=${registerGradeFilter}` : ""}${registerGroupFilter ? `&group=${encodeURIComponent(registerGroupFilter)}` : ""}&date=${registerDate}`
    )
      .then((res) => {
        const records = res?.data || [];
        const nextStatuses = { ...initial };
        records.forEach((r: AttendanceRecord) => {
          const enrollmentId = String(r.enrollmentId || "");
          if (!enrollmentId || nextStatuses[enrollmentId] === undefined) return;
          const status = String(r.status || "") as RegisterAttendanceStatus;
          if (
            status === "PRESENT" ||
            status === "ABSENT" ||
            status === "LATE" ||
            status === "EXCUSED"
          ) {
            nextStatuses[enrollmentId] = status;
          }
        });
        setRegisterStatuses(nextStatuses);
      })
      .catch(() => setRegisterStatuses(initial));
  }, [registerGradeFilter, registerGroupFilter, registerDate, registerEnrollments]);

  const checkedCount = registerEnrollments.filter(
    (e) => registerStatuses[e.id] !== "ABSENT"
  ).length;

  const setAllStatus = (status: RegisterAttendanceStatus) => {
    const next: Record<string, RegisterAttendanceStatus> = {};
    registerEnrollments.forEach((e) => {
      next[e.id] = status;
    });
    setRegisterStatuses(next);
  };

  const saveCourseAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerDate || registerEnrollments.length === 0) return;
    if (!isRegisterWindowOpen) {
      setSaveError("El registro de asistencia de hoy ya esta cerrado (11:59 PM).");
      return;
    }

    setSaveBusy(true);
    setSaveError("");
    setSaveMessage("");
    try {
      const dateIso = new Date(registerDate).toISOString();
      const items = registerEnrollments.map((enrollment) => {
        return {
          enrollmentId: enrollment.id,
          date: dateIso,
          status: (registerStatuses[enrollment.id] || "PRESENT") as RegisterAttendanceStatus,
        };
      });

      const result = await apiPost("/attendance/bulk", { items });
      const failed = Number(result?.summary?.failed || 0);
      const ok = Number(result?.summary?.ok || 0);
      if (failed > 0) {
        setSaveMessage(`Asistencia guardada parcialmente: ${ok} exitosos, ${failed} con error.`);
      } else {
        setSaveMessage("Asistencia guardada correctamente.");
      }
      loadHistory();
    } catch (error: unknown) {
      setSaveError(getErrorMessage(error));
    } finally {
      setSaveBusy(false);
    }
  };

  const handleExportAttendance = async () => {
    setExportBusy(true);
    try {
      const query = `?${[
        `validToday=${isAdminView ? "0" : "1"}`,
        statusFilter ? `status=${encodeURIComponent(statusFilter)}` : "",
        historyStudentFilter ? `student=${encodeURIComponent(historyStudentFilter)}` : "",
        historyGradeFilter ? `gradeLevel=${encodeURIComponent(historyGradeFilter)}` : "",
        historyGroupFilter ? `group=${encodeURIComponent(historyGroupFilter)}` : "",
        historyDateFilter ? `date=${encodeURIComponent(historyDateFilter)}` : "",
        isAdminView && historyTeacherFilter
          ? `teacherId=${encodeURIComponent(historyTeacherFilter)}`
          : "",
      ]
        .filter(Boolean)
        .join("&")}`;
      const blob = await apiDownload(`/teacher/attendance/export/excel${query}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "asistencia.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      setSaveError(getErrorMessage(error));
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportAttendancePdf = async () => {
    setExportPdfBusy(true);
    try {
      const query = `?${[
        `validToday=${isAdminView ? "0" : "1"}`,
        statusFilter ? `status=${encodeURIComponent(statusFilter)}` : "",
        historyStudentFilter ? `student=${encodeURIComponent(historyStudentFilter)}` : "",
        historyGradeFilter ? `gradeLevel=${encodeURIComponent(historyGradeFilter)}` : "",
        historyGroupFilter ? `group=${encodeURIComponent(historyGroupFilter)}` : "",
        historyDateFilter ? `date=${encodeURIComponent(historyDateFilter)}` : "",
        isAdminView && historyTeacherFilter
          ? `teacherId=${encodeURIComponent(historyTeacherFilter)}`
          : "",
      ]
        .filter(Boolean)
        .join("&")}`;
      const blob = await apiDownload(`/teacher/attendance/export/pdf${query}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "asistencia.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      setSaveError(getErrorMessage(error));
    } finally {
      setExportPdfBusy(false);
    }
  };

  const handleExportAttendanceGradeDatesExcel = async () => {
    setExportGradeDatesBusy(true);
    try {
      const blob = await apiDownload("/reports/attendance-grade-dates-excel");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "asistencia-por-grado-fechas.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      setSaveError(getErrorMessage(error));
    } finally {
      setExportGradeDatesBusy(false);
    }
  };

  const handleExportAttendanceGradeDatesPdf = async () => {
    setExportGradeDatesPdfBusy(true);
    try {
      const blob = await apiDownload("/reports/attendance-grade-dates-pdf");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "asistencia-por-grado-fechas.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      setSaveError(getErrorMessage(error));
    } finally {
      setExportGradeDatesPdfBusy(false);
    }
  };

  return (
    <Section title="Asistencia">
      <div className="help-card">
        {isAdminView
          ? "Consulta la asistencia registrada por todos los docentes."
          : "Consulta y registra la asistencia diaria por grado segun la franja valida."}
        {!isAdminView && todayWindows.dayOfWeek && (
          <div style={{ marginTop: 8 }}>
            <strong>Franja valida hoy ({todayWindows.dayOfWeek}):</strong>{" "}
            {todayWindows.gradeGroups && todayWindows.gradeGroups.length > 0
              ? todayWindows.gradeGroups.join(", ")
              : isSunday
                ? "No aplica los domingos"
                : "No tienes franjas registradas para hoy"}
          </div>
        )}
        {!isAdminView && !isSunday && !hasTodayWindows && (
          <div style={{ marginTop: 8, color: "#b45309", fontWeight: 600 }}>
            No tienes franja horaria asignada para hoy. Solicita al administrador la asignacion en
            Horas docentes.
          </div>
        )}
      </div>
      {!isAdminView && (
        <div className="card">
          <div className="section-title">Grados y alumnos de la franja de hoy</div>
          {isSunday ? (
            <div style={{ color: "#64748b", fontWeight: 600 }}>
              Hoy es domingo. La consulta y el registro de asistencia no estan disponibles.
            </div>
          ) : !isRegisterWindowOpen ? (
            <div style={{ color: "#b91c1c", fontWeight: 600 }}>
              El listado de franja del dia solo se visualiza hasta las 11:59 PM.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 8 }}>
                <label>
                  Consultar por grado
                  <select
                    className="input"
                    value={consultGradeFilter}
                    onChange={(e) => {
                      setConsultGradeFilter(e.target.value);
                      setConsultGroupFilter("");
                    }}
                  >
                    <option value="">Todos los grados habilitados hoy</option>
                    {validTodayGrades.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Consultar por grupo
                  <select
                    className="input"
                    value={consultGroupFilter}
                    onChange={(e) => {
                      setConsultGroupFilter(e.target.value);
                    }}
                  >
                    <option value="">Todos los grupos habilitados hoy</option>
                    {validTodayGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {visibleTodayCourseStudents.length === 0 ? (
                <div style={{ color: "#64748b" }}>
                  No hay grados habilitados para la franja del dia de hoy.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {visibleTodayCourseStudents.map((course) => (
                    <div
                      key={course.id}
                      style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>
                        {course.name} ({course.gradeLevel}) - {course.students.length} alumnos
                      </div>
                      {course.students.length === 0 ? (
                        <div style={{ color: "#64748b" }}>
                          Sin alumnos matriculados en este grado.
                        </div>
                      ) : (
                        <div className="table-wrap">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Alumno</th>
                                <th>Grado</th>
                                <th>Grupo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {course.students.map((s) => (
                                <tr key={s.enrollmentId}>
                                  <td>{s.fullName}</td>
                                  <td>{s.gradeLevel}</td>
                                  <td>{s.group || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {(consultGradeFilter || consultGroupFilter) && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    Listado de alumnos filtrado
                  </div>
                  {studentsBySelectedFilters.length === 0 ? (
                    <div style={{ color: "#64748b" }}>
                      No hay alumnos para ese grado y grupo en la franja de hoy.
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Alumno</th>
                            <th>Grado</th>
                            <th>Grupo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentsBySelectedFilters.map((student) => (
                            <tr key={student.enrollmentId}>
                              <td>{student.fullName}</td>
                              <td>{student.gradeLevel}</td>
                              <td>{student.group || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!isAdminView && (
        <form className="card" onSubmit={saveCourseAttendance}>
          <div className="section-title">Registro de asistencia por grado y grupo (checkbox)</div>
          <ActionFeedback
            tone="success"
            title={feedbackTitles.teacherAttendance.success}
            message={saveMessage}
            onDismiss={() => setSaveMessage("")}
            style={{ marginBottom: 10 }}
          />
          <ActionFeedback
            tone="error"
            title={feedbackTitles.teacherAttendance.error}
            message={saveError}
            onDismiss={() => setSaveError("")}
            style={{ marginBottom: 10 }}
          />
          {isSunday && (
            <div style={{ marginBottom: 10, color: "#64748b", fontWeight: 600 }}>
              Registro no disponible en domingo.
            </div>
          )}

          <label>
            Grado (franja valida de hoy)
            <select
              className="input"
              value={registerGradeFilter}
              onChange={(e) => {
                setRegisterGradeFilter(e.target.value);
                setRegisterGroupFilter("");
                setRegisterStatuses({});
              }}
              disabled={validTodayGrades.length === 0}
            >
              <option value="">Todos los grados habilitados hoy</option>
              {validTodayGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </label>
          <label>
            Grupo (franja valida de hoy)
            <select
              className="input"
              value={registerGroupFilter}
              onChange={(e) => {
                setRegisterGroupFilter(e.target.value);
                setRegisterStatuses({});
              }}
              disabled={validRegisterGroups.length === 0}
            >
              <option value="">Todos los grupos habilitados hoy</option>
              {validRegisterGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>

          <label>
            Fecha (solo hoy)
            <input className="input" type="date" value={registerDate} disabled />
          </label>

          {!isRegisterWindowOpen && (
            <div style={{ marginTop: 10, color: "#b91c1c", fontWeight: 600 }}>
              Registro cerrado para hoy. Este formulario solo esta disponible hasta las 11:59 PM del
              mismo dia.
            </div>
          )}

          {registerDate && registerEnrollments.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setAllStatus("PRESENT")}
                >
                  Todos presente
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setAllStatus("ABSENT")}
                >
                  Todos ausente
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setAllStatus("LATE")}
                >
                  Todos tarde
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setAllStatus("EXCUSED")}
                >
                  Todos justificado
                </button>
                <div style={{ color: "#475569" }}>
                  Asistencia (no ausente): {checkedCount} / {registerEnrollments.length}
                </div>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Grado</th>
                      <th>Grupo</th>
                      <th>Presente</th>
                      <th>Ausente</th>
                      <th>Tarde</th>
                      <th>Justificado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registerEnrollments.map((enrollment) => (
                      <tr key={enrollment.id}>
                        <td>{enrollment.student?.fullName || ""}</td>
                        <td>{getClassGradeLevel(enrollment.class) || "-"}</td>
                        <td>{String(enrollment.student?.studentGroup || "-")}</td>
                        <td>
                          <input
                            type="checkbox"
                            checked={(registerStatuses[enrollment.id] || "PRESENT") === "PRESENT"}
                            onChange={() =>
                              setRegisterStatuses((prev) => ({
                                ...prev,
                                [enrollment.id]: "PRESENT",
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={(registerStatuses[enrollment.id] || "PRESENT") === "ABSENT"}
                            onChange={() =>
                              setRegisterStatuses((prev) => ({
                                ...prev,
                                [enrollment.id]: "ABSENT",
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={(registerStatuses[enrollment.id] || "PRESENT") === "LATE"}
                            onChange={() =>
                              setRegisterStatuses((prev) => ({
                                ...prev,
                                [enrollment.id]: "LATE",
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={(registerStatuses[enrollment.id] || "PRESENT") === "EXCUSED"}
                            onChange={() =>
                              setRegisterStatuses((prev) => ({
                                ...prev,
                                [enrollment.id]: "EXCUSED",
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {registerDate && registerEnrollments.length === 0 && (
            <div style={{ marginTop: 10, color: "#b45309" }}>
              No hay estudiantes matriculados para los filtros seleccionados en la franja valida de
              hoy.
            </div>
          )}

          <button
            className="button"
            style={{ marginTop: 10 }}
            disabled={
              isSunday ||
              !isRegisterWindowOpen ||
              !registerDate ||
              registerEnrollments.length === 0 ||
              saveBusy
            }
          >
            {saveBusy ? "Guardando..." : "Guardar asistencia"}
          </button>
        </form>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {isAdminView && (
          <select
            className="input"
            value={historyTeacherFilter}
            onChange={(e) => setHistoryTeacherFilter(e.target.value)}
          >
            <option value="">Todos los docentes</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName}
              </option>
            ))}
          </select>
        )}
        <input
          className="input"
          placeholder="Estudiante"
          value={historyStudentFilter}
          onChange={(e) => setHistoryStudentFilter(e.target.value)}
        />
        <select
          className="input"
          value={historyGradeFilter}
          onChange={(e) => setHistoryGradeFilter(e.target.value)}
        >
          <option value="">Todos los grados</option>
          {allTeacherGrades.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={historyGroupFilter}
          onChange={(e) => {
            setHistoryGroupFilter(e.target.value);
          }}
        >
          <option value="">Todos los grupos</option>
          {(isAdminView ? adminGroupOptions : historyValidGroups).map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="date"
          value={historyDateFilter}
          onChange={(e) => setHistoryDateFilter(e.target.value)}
        />
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los estados</option>
          <option value="PRESENT">Presente</option>
          <option value="ABSENT">Ausente</option>
          <option value="LATE">Tarde</option>
          <option value="EXCUSED">Justificado</option>
        </select>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setHistoryStudentFilter("");
            setHistoryGradeFilter("");
            setHistoryGroupFilter("");
            setHistoryDateFilter("");
            setStatusFilter("");
            setHistoryTeacherFilter("");
            setPage(1);
          }}
        >
          Limpiar filtros
        </button>
      </div>
      {!isAdminView && (
        <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>
          Mostrando solo asistencia de tus grados y grupos de la franja valida de hoy.
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          type="button"
          className="button secondary"
          onClick={handleExportAttendance}
          disabled={exportBusy}
        >
          {exportBusy ? "Exportando..." : "Exportar asistencia"}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={handleExportAttendancePdf}
          disabled={exportPdfBusy}
          style={{ marginLeft: 8 }}
        >
          {exportPdfBusy ? "Exportando PDF..." : "Exportar PDF"}
        </button>
        {isAdminView && (
          <>
            <button
              type="button"
              className="button secondary"
              onClick={handleExportAttendanceGradeDatesExcel}
              disabled={exportGradeDatesBusy}
              style={{ marginLeft: 8 }}
            >
              {exportGradeDatesBusy ? "Exportando..." : "Reporte grado-fecha (Excel)"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={handleExportAttendanceGradeDatesPdf}
              disabled={exportGradeDatesPdfBusy}
              style={{ marginLeft: 8 }}
            >
              {exportGradeDatesPdfBusy ? "Exportando..." : "Reporte grado-fecha (PDF)"}
            </button>
          </>
        )}
      </div>

      <DataTable
        columns={[
          { key: "student", label: "Estudiante" },
          ...(isAdminView ? [{ key: "teacher", label: "Docente" }] : []),
          { key: "grade", label: "Grado" },
          { key: "group", label: "Grupo" },
          { key: "date", label: "Fecha" },
          { key: "status", label: "Estado" },
        ]}
        rows={attendance.map((a: AttendanceHistoryRecord) => ({
          student: a.enrollment?.student?.fullName || "",
          teacher: a.teacherName || a.enrollment?.class?.teacher?.user?.fullName || "",
          grade: getClassGradeLevel(a.enrollment?.class),
          group: a.enrollment?.student?.studentGroup || "",
          date: a.date?.slice(0, 10) || "",
          status: a.status,
        }))}
      />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <div style={{ alignSelf: "center", color: "#6b7280" }}>
          Pagina {page} de {Math.max(1, Math.ceil(total / 1))} (fecha)
        </div>
        <button
          className="button secondary"
          disabled={page >= Math.ceil(total / 1)}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </Section>
  );
}
