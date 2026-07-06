import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import ActionFeedback from "../components/ActionFeedback";
import { apiDownload, apiGet, apiPost } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { feedbackTitles } from "../utils/feedback";
function toLocalDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function normalizeGradeKey(value) {
    return String(value || "")
        .trim()
        .toUpperCase()
        .split("-")[0]
        .trim();
}
function normalizeGroupKey(value) {
    return String(value || "").trim().toUpperCase();
}
function parseGradeGroupEntry(entry) {
    const raw = String(entry || "").trim().toUpperCase();
    const [grade, ...rest] = raw.split("-").map((p) => p.trim()).filter(Boolean);
    return {
        grade: grade || "",
        group: rest.join("-") || ""
    };
}
function getClassGradeLevel(classData) {
    return String(classData?.gradeLevel || "").trim();
}
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
function sortGradesAcademic(values) {
    return [...values].sort((a, b) => {
        const oa = GRADE_ORDER[normalizeGradeKey(a)] ?? 999;
        const ob = GRADE_ORDER[normalizeGradeKey(b)] ?? 999;
        if (oa !== ob)
            return oa - ob;
        return a.localeCompare(b, "es", { numeric: true });
    });
}
export default function TeacherAttendance() {
    const { user } = useAuth();
    const isAdminView = user?.role === "ADMIN";
    const [enrollments, setEnrollments] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState("");
    const [historyStudentFilter, setHistoryStudentFilter] = useState("");
    const [historyGradeFilter, setHistoryGradeFilter] = useState("");
    const [historyGroupFilter, setHistoryGroupFilter] = useState("");
    const [historyDateFilter, setHistoryDateFilter] = useState("");
    const [historyTeacherFilter, setHistoryTeacherFilter] = useState("");
    const [adminGroupOptions, setAdminGroupOptions] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [gradeCatalog, setGradeCatalog] = useState([]);
    const [consultGradeFilter, setConsultGradeFilter] = useState("");
    const [consultGroupFilter, setConsultGroupFilter] = useState("");
    const [registerGradeFilter, setRegisterGradeFilter] = useState("");
    const [registerGroupFilter, setRegisterGroupFilter] = useState("");
    const [registerDate, setRegisterDate] = useState(() => toLocalDateInputValue(new Date()));
    const [registerStatuses, setRegisterStatuses] = useState({});
    const [saveBusy, setSaveBusy] = useState(false);
    const [exportBusy, setExportBusy] = useState(false);
    const [exportPdfBusy, setExportPdfBusy] = useState(false);
    const [exportGradeDatesBusy, setExportGradeDatesBusy] = useState(false);
    const [exportGradeDatesPdfBusy, setExportGradeDatesPdfBusy] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");
    const [saveError, setSaveError] = useState("");
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [todayWindows, setTodayWindows] = useState({
        dayOfWeek: "",
        grades: []
    });
    useEffect(() => {
        const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
        return () => window.clearInterval(timer);
    }, []);
    const todayDate = new Date(nowMs);
    const todayString = toLocalDateInputValue(todayDate);
    const registerCutoff = new Date(todayDate);
    registerCutoff.setHours(23, 59, 59, 999);
    const isRegisterWindowOpen = nowMs <= registerCutoff.getTime() && registerDate === todayString;
    useEffect(() => {
        if (registerDate !== todayString) {
            setRegisterDate(todayString);
            setRegisterStatuses({});
        }
    }, [todayString, registerDate]);
    const loadBase = () => {
        if (isAdminView) {
            apiGet("/teacher/admin-subject-hours")
                .then((res) => {
                const data = Array.isArray(res) ? res : [];
                setTeachers(data
                    .map((t) => ({
                    id: String(t.teacherId || ""),
                    fullName: String(t.teacherName || "")
                }))
                    .filter((t) => t.id && t.fullName));
            })
                .catch(() => setTeachers([]));
            apiGet("/classes/simple")
                .then((res) => {
                const list = Array.isArray(res) ? res : [];
                const unique = new Map();
                list.forEach((c) => {
                    const gradeLevel = getClassGradeLevel(c);
                    if (!gradeLevel)
                        return;
                    const id = `grade:${gradeLevel}`;
                    unique.set(id, {
                        id,
                        name: gradeLevel,
                        gradeLevel
                    });
                });
                setGradeCatalog(Array.from(unique.values()));
            })
                .catch(() => setGradeCatalog([]));
            apiGet("/enrollments?page=0&pageSize=1")
                .then((res) => {
                const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
                const groups = Array.from(new Set(list
                    .map((item) => normalizeGroupKey(String(item?.student?.studentGroup || "")))
                    .filter((value) => Boolean(value)))).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
                setAdminGroupOptions(groups);
            })
                .catch(() => setAdminGroupOptions([]));
            return;
        }
        apiGet("/teacher/attendance/windows").then((res) => setTodayWindows(res)).catch(() => undefined);
        apiGet("/teacher/enrollments?today=1")
            .then((res) => {
            const list = res || [];
            setEnrollments(list);
            const unique = new Map();
            list.forEach((e) => {
                const gradeLevel = getClassGradeLevel(e.class);
                if (!gradeLevel)
                    return;
                const id = `grade:${gradeLevel}`;
                unique.set(id, {
                    id,
                    name: gradeLevel,
                    gradeLevel
                });
            });
            setGradeCatalog(Array.from(unique.values()));
        })
            .catch(() => undefined);
    };
    const loadHistory = () => {
        apiGet(`/teacher/attendance?page=${page}&pageSize=1&paginateByDate=1${!isAdminView ? "&validToday=1" : ""}${statusFilter ? `&status=${statusFilter}` : ""}${historyStudentFilter ? `&student=${encodeURIComponent(historyStudentFilter)}` : ""}${historyGradeFilter ? `&gradeLevel=${historyGradeFilter}` : ""}${historyGroupFilter ? `&group=${encodeURIComponent(historyGroupFilter)}` : ""}${historyDateFilter ? `&date=${historyDateFilter}` : ""}${isAdminView && historyTeacherFilter ? `&teacherId=${historyTeacherFilter}` : ""}`)
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
    }, [page, statusFilter, historyStudentFilter, historyGradeFilter, historyGroupFilter, historyDateFilter, historyTeacherFilter, isAdminView]);
    useEffect(() => {
        setPage(1);
    }, [statusFilter, historyStudentFilter, historyGradeFilter, historyGroupFilter, historyDateFilter, historyTeacherFilter]);
    const isSunday = normalizeGradeKey(todayWindows.dayOfWeek) === "DOMINGO";
    const hasTodayWindows = enrollments.length > 0 ||
        (todayWindows.grades && todayWindows.grades.length > 0) ||
        (todayWindows.gradeGroups && todayWindows.gradeGroups.length > 0);
    const validTodayCourses = useMemo(() => gradeCatalog, [gradeCatalog]);
    const validTodayGrades = useMemo(() => sortGradesAcademic(Array.from(new Set(validTodayCourses.map((c) => c.gradeLevel)))), [validTodayCourses]);
    const allTeacherGrades = useMemo(() => sortGradesAcademic(Array.from(new Set(gradeCatalog.map((c) => c.gradeLevel)))), [gradeCatalog]);
    const filteredTodayCourses = useMemo(() => consultGradeFilter
        ? validTodayCourses.filter((c) => normalizeGradeKey(c.gradeLevel) === normalizeGradeKey(consultGradeFilter))
        : validTodayCourses, [validTodayCourses, consultGradeFilter]);
    const validTodayGroups = useMemo(() => {
        const pairs = (todayWindows.gradeGroups || []).map(parseGradeGroupEntry);
        const groups = pairs
            .filter((pair) => pair.group)
            .filter((pair) => !consultGradeFilter || normalizeGradeKey(pair.grade) === normalizeGradeKey(consultGradeFilter))
            .map((pair) => normalizeGroupKey(pair.group))
            .filter(Boolean);
        return Array.from(new Set(groups)).sort();
    }, [todayWindows.gradeGroups, consultGradeFilter]);
    const historyValidGroups = useMemo(() => {
        const pairs = (todayWindows.gradeGroups || []).map(parseGradeGroupEntry);
        const groups = pairs
            .filter((pair) => pair.group)
            .filter((pair) => !historyGradeFilter || normalizeGradeKey(pair.grade) === normalizeGradeKey(historyGradeFilter))
            .map((pair) => normalizeGroupKey(pair.group))
            .filter(Boolean);
        return Array.from(new Set(groups)).sort();
    }, [todayWindows.gradeGroups, historyGradeFilter]);
    const registerEnrollments = useMemo(() => enrollments.filter((e) => (!registerGradeFilter || getClassGradeLevel(e.class) === registerGradeFilter) &&
        (!registerGroupFilter ||
            normalizeGroupKey(String(e.student?.studentGroup || "")) === normalizeGroupKey(registerGroupFilter))), [enrollments, registerGradeFilter, registerGroupFilter]);
    const validRegisterGroups = useMemo(() => {
        const pairs = (todayWindows.gradeGroups || []).map(parseGradeGroupEntry);
        const groups = pairs
            .filter((pair) => pair.group)
            .filter((pair) => !registerGradeFilter || normalizeGradeKey(pair.grade) === normalizeGradeKey(registerGradeFilter))
            .map((pair) => normalizeGroupKey(pair.group))
            .filter(Boolean);
        return Array.from(new Set(groups)).sort();
    }, [todayWindows.gradeGroups, registerGradeFilter]);
    const todayCourseStudents = useMemo(() => filteredTodayCourses.map((course) => {
        const students = enrollments
            .filter((e) => normalizeGradeKey(getClassGradeLevel(e.class)) === normalizeGradeKey(course.gradeLevel))
            .map((e) => ({
            enrollmentId: String(e.id || ""),
            fullName: String(e.student?.fullName || ""),
            gradeLevel: getClassGradeLevel(e.class),
            group: String(e.student?.studentGroup || "")
        }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName));
        return {
            ...course,
            students
        };
    }), [filteredTodayCourses, enrollments]);
    const visibleTodayCourseStudents = useMemo(() => {
        const list = todayCourseStudents.map((course) => ({
            ...course,
            students: consultGroupFilter
                ? course.students.filter((student) => normalizeGroupKey(String(student.group || "")) === normalizeGroupKey(consultGroupFilter))
                : course.students
        }));
        return consultGroupFilter ? list.filter((course) => course.students.length > 0) : list;
    }, [todayCourseStudents, consultGroupFilter]);
    const studentsBySelectedFilters = useMemo(() => visibleTodayCourseStudents
        .flatMap((course) => course.students.map((student) => ({
        enrollmentId: student.enrollmentId,
        fullName: student.fullName,
        gradeLevel: student.gradeLevel,
        group: student.group,
        gradeName: course.name
    })))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)), [visibleTodayCourseStudents]);
    useEffect(() => {
        if (registerGradeFilter && !validTodayGrades.includes(registerGradeFilter)) {
            setRegisterGradeFilter("");
            setRegisterGroupFilter("");
            setRegisterStatuses({});
        }
        if (registerGroupFilter && !validRegisterGroups.includes(registerGroupFilter)) {
            setRegisterGroupFilter("");
            setRegisterStatuses({});
        }
        if (consultGradeFilter && !validTodayGrades.includes(consultGradeFilter)) {
            setConsultGradeFilter("");
        }
        if (consultGroupFilter && !validTodayGroups.includes(consultGroupFilter)) {
            setConsultGroupFilter("");
        }
        if (historyGroupFilter && !historyValidGroups.includes(historyGroupFilter)) {
            setHistoryGroupFilter("");
        }
    }, [
        validTodayGrades,
        registerGradeFilter,
        registerGroupFilter,
        validRegisterGroups,
        consultGradeFilter,
        consultGroupFilter,
        validTodayGroups,
        historyGroupFilter,
        historyValidGroups
    ]);
    useEffect(() => {
        if (!registerDate) {
            setRegisterStatuses({});
            return;
        }
        const initial = {};
        registerEnrollments.forEach((e) => {
            initial[e.id] = "PRESENT";
        });
        apiGet(`/teacher/attendance?page=1&pageSize=500${registerGradeFilter ? `&gradeLevel=${registerGradeFilter}` : ""}${registerGroupFilter ? `&group=${encodeURIComponent(registerGroupFilter)}` : ""}&date=${registerDate}`)
            .then((res) => {
            const records = res?.data || [];
            const nextStatuses = { ...initial };
            records.forEach((r) => {
                const enrollmentId = String(r.enrollmentId || "");
                if (!enrollmentId || nextStatuses[enrollmentId] === undefined)
                    return;
                const status = String(r.status || "");
                if (status === "PRESENT" || status === "ABSENT" || status === "LATE" || status === "EXCUSED") {
                    nextStatuses[enrollmentId] = status;
                }
            });
            setRegisterStatuses(nextStatuses);
        })
            .catch(() => setRegisterStatuses(initial));
    }, [registerGradeFilter, registerGroupFilter, registerDate, registerEnrollments]);
    const checkedCount = registerEnrollments.filter((e) => registerStatuses[e.id] !== "ABSENT").length;
    const setAllStatus = (status) => {
        const next = {};
        registerEnrollments.forEach((e) => {
            next[e.id] = status;
        });
        setRegisterStatuses(next);
    };
    const saveCourseAttendance = async (e) => {
        e.preventDefault();
        if (!registerDate || registerEnrollments.length === 0)
            return;
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
                    status: (registerStatuses[enrollment.id] || "PRESENT")
                };
            });
            const result = await apiPost("/attendance/bulk", { items });
            const failed = Number(result?.summary?.failed || 0);
            const ok = Number(result?.summary?.ok || 0);
            if (failed > 0) {
                setSaveMessage(`Asistencia guardada parcialmente: ${ok} exitosos, ${failed} con error.`);
            }
            else {
                setSaveMessage("Asistencia guardada correctamente.");
            }
            loadHistory();
        }
        catch (error) {
            setSaveError(error?.message || "No fue posible registrar la asistencia del grado");
        }
        finally {
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
                isAdminView && historyTeacherFilter ? `teacherId=${encodeURIComponent(historyTeacherFilter)}` : ""
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
        }
        catch (error) {
            setSaveError(error?.message || "No fue posible exportar la asistencia");
        }
        finally {
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
                isAdminView && historyTeacherFilter ? `teacherId=${encodeURIComponent(historyTeacherFilter)}` : ""
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
        }
        catch (error) {
            setSaveError(error?.message || "No fue posible exportar la asistencia en PDF");
        }
        finally {
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
        }
        catch (error) {
            setSaveError(error?.message || "No fue posible exportar el reporte por grado en Excel");
        }
        finally {
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
        }
        catch (error) {
            setSaveError(error?.message || "No fue posible exportar el reporte por grado en PDF");
        }
        finally {
            setExportGradeDatesPdfBusy(false);
        }
    };
    return (_jsxs(Section, { title: "Asistencia", children: [_jsxs("div", { className: "help-card", children: [isAdminView
                        ? "Consulta la asistencia registrada por todos los docentes."
                        : "Consulta y registra la asistencia diaria por grado segun la franja valida.", !isAdminView && todayWindows.dayOfWeek && (_jsxs("div", { style: { marginTop: 8 }, children: [_jsxs("strong", { children: ["Franja valida hoy (", todayWindows.dayOfWeek, "):"] }), " ", todayWindows.gradeGroups && todayWindows.gradeGroups.length > 0
                                ? todayWindows.gradeGroups.join(", ")
                                : isSunday
                                    ? "No aplica los domingos"
                                    : "No tienes franjas registradas para hoy"] })), !isAdminView && !isSunday && !hasTodayWindows && (_jsx("div", { style: { marginTop: 8, color: "#b45309", fontWeight: 600 }, children: "No tienes franja horaria asignada para hoy. Solicita al administrador la asignacion en Horas docentes." }))] }), !isAdminView && _jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: "Grados y alumnos de la franja de hoy" }), isSunday ? (_jsx("div", { style: { color: "#64748b", fontWeight: 600 }, children: "Hoy es domingo. La consulta y el registro de asistencia no estan disponibles." })) : !isRegisterWindowOpen ? (_jsx("div", { style: { color: "#b91c1c", fontWeight: 600 }, children: "El listado de franja del dia solo se visualiza hasta las 11:59 PM." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { marginBottom: 8 }, children: [_jsxs("label", { children: ["Consultar por grado", _jsxs("select", { className: "input", value: consultGradeFilter, onChange: (e) => setConsultGradeFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los grados habilitados hoy" }), validTodayGrades.map((grade) => (_jsx("option", { value: grade, children: grade }, grade)))] })] }), _jsxs("label", { children: ["Consultar por grupo", _jsxs("select", { className: "input", value: consultGroupFilter, onChange: (e) => setConsultGroupFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los grupos habilitados hoy" }), validTodayGroups.map((group) => (_jsx("option", { value: group, children: group }, group)))] })] })] }), visibleTodayCourseStudents.length === 0 ? (_jsx("div", { style: { color: "#64748b" }, children: "No hay grados habilitados para la franja del dia de hoy." })) : (_jsx("div", { style: { display: "grid", gap: 10 }, children: visibleTodayCourseStudents.map((course) => (_jsxs("div", { style: { border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }, children: [_jsxs("div", { style: { fontWeight: 700, marginBottom: 6 }, children: [course.name, " (", course.gradeLevel, ") - ", course.students.length, " alumnos"] }), course.students.length === 0 ? (_jsx("div", { style: { color: "#64748b" }, children: "Sin alumnos matriculados en este grado." })) : (_jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Alumno" }), _jsx("th", { children: "Grado" }), _jsx("th", { children: "Grupo" })] }) }), _jsx("tbody", { children: course.students.map((s) => (_jsxs("tr", { children: [_jsx("td", { children: s.fullName }), _jsx("td", { children: s.gradeLevel }), _jsx("td", { children: s.group || "-" })] }, s.enrollmentId))) })] }) }))] }, course.id))) })), (consultGradeFilter || consultGroupFilter) && (_jsxs("div", { style: { marginTop: 10 }, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: 6 }, children: "Listado de alumnos filtrado" }), studentsBySelectedFilters.length === 0 ? (_jsx("div", { style: { color: "#64748b" }, children: "No hay alumnos para ese grado y grupo en la franja de hoy." })) : (_jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Alumno" }), _jsx("th", { children: "Grado" }), _jsx("th", { children: "Grupo" })] }) }), _jsx("tbody", { children: studentsBySelectedFilters.map((student) => (_jsxs("tr", { children: [_jsx("td", { children: student.fullName }), _jsx("td", { children: student.gradeLevel }), _jsx("td", { children: student.group || "-" })] }, student.enrollmentId))) })] }) }))] }))] }))] }), !isAdminView && _jsxs("form", { className: "card", onSubmit: saveCourseAttendance, children: [_jsx("div", { className: "section-title", children: "Registro de asistencia por grado y grupo (checkbox)" }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.teacherAttendance.success, message: saveMessage, onDismiss: () => setSaveMessage(""), style: { marginBottom: 10 } }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.teacherAttendance.error, message: saveError, onDismiss: () => setSaveError(""), style: { marginBottom: 10 } }), isSunday && (_jsx("div", { style: { marginBottom: 10, color: "#64748b", fontWeight: 600 }, children: "Registro no disponible en domingo." })), _jsxs("label", { children: ["Grado (franja valida de hoy)", _jsxs("select", { className: "input", value: registerGradeFilter, onChange: (e) => {
                                    setRegisterGradeFilter(e.target.value);
                                    setRegisterGroupFilter("");
                                    setRegisterStatuses({});
                                }, disabled: validTodayGrades.length === 0, children: [_jsx("option", { value: "", children: "Todos los grados habilitados hoy" }), validTodayGrades.map((grade) => (_jsx("option", { value: grade, children: grade }, grade)))] })] }), _jsxs("label", { children: ["Grupo (franja valida de hoy)", _jsxs("select", { className: "input", value: registerGroupFilter, onChange: (e) => {
                                    setRegisterGroupFilter(e.target.value);
                                    setRegisterStatuses({});
                                }, disabled: validRegisterGroups.length === 0, children: [_jsx("option", { value: "", children: "Todos los grupos habilitados hoy" }), validRegisterGroups.map((group) => (_jsx("option", { value: group, children: group }, group)))] })] }), _jsxs("label", { children: ["Fecha (solo hoy)", _jsx("input", { className: "input", type: "date", value: registerDate, disabled: true })] }), !isRegisterWindowOpen && (_jsx("div", { style: { marginTop: 10, color: "#b91c1c", fontWeight: 600 }, children: "Registro cerrado para hoy. Este formulario solo esta disponible hasta las 11:59 PM del mismo dia." })), registerDate && registerEnrollments.length > 0 && (_jsxs("div", { style: { marginTop: 10 }, children: [_jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }, children: [_jsx("button", { type: "button", className: "button secondary", onClick: () => setAllStatus("PRESENT"), children: "Todos presente" }), _jsx("button", { type: "button", className: "button secondary", onClick: () => setAllStatus("ABSENT"), children: "Todos ausente" }), _jsx("button", { type: "button", className: "button secondary", onClick: () => setAllStatus("LATE"), children: "Todos tarde" }), _jsx("button", { type: "button", className: "button secondary", onClick: () => setAllStatus("EXCUSED"), children: "Todos justificado" }), _jsxs("div", { style: { color: "#475569" }, children: ["Asistencia (no ausente): ", checkedCount, " / ", registerEnrollments.length] })] }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Estudiante" }), _jsx("th", { children: "Grado" }), _jsx("th", { children: "Grupo" }), _jsx("th", { children: "Presente" }), _jsx("th", { children: "Ausente" }), _jsx("th", { children: "Tarde" }), _jsx("th", { children: "Justificado" })] }) }), _jsx("tbody", { children: registerEnrollments.map((enrollment) => (_jsxs("tr", { children: [_jsx("td", { children: enrollment.student?.fullName || "" }), _jsx("td", { children: getClassGradeLevel(enrollment.class) || "-" }), _jsx("td", { children: String(enrollment.student?.studentGroup || "-") }), _jsx("td", { children: _jsx("input", { type: "checkbox", checked: (registerStatuses[enrollment.id] || "PRESENT") === "PRESENT", onChange: () => setRegisterStatuses((prev) => ({
                                                                ...prev,
                                                                [enrollment.id]: "PRESENT"
                                                            })) }) }), _jsx("td", { children: _jsx("input", { type: "checkbox", checked: (registerStatuses[enrollment.id] || "PRESENT") === "ABSENT", onChange: () => setRegisterStatuses((prev) => ({
                                                                ...prev,
                                                                [enrollment.id]: "ABSENT"
                                                            })) }) }), _jsx("td", { children: _jsx("input", { type: "checkbox", checked: (registerStatuses[enrollment.id] || "PRESENT") === "LATE", onChange: () => setRegisterStatuses((prev) => ({
                                                                ...prev,
                                                                [enrollment.id]: "LATE"
                                                            })) }) }), _jsx("td", { children: _jsx("input", { type: "checkbox", checked: (registerStatuses[enrollment.id] || "PRESENT") === "EXCUSED", onChange: () => setRegisterStatuses((prev) => ({
                                                                ...prev,
                                                                [enrollment.id]: "EXCUSED"
                                                            })) }) })] }, enrollment.id))) })] }) })] })), registerDate && registerEnrollments.length === 0 && (_jsx("div", { style: { marginTop: 10, color: "#b45309" }, children: "No hay estudiantes matriculados para los filtros seleccionados en la franja valida de hoy." })), _jsx("button", { className: "button", style: { marginTop: 10 }, disabled: isSunday || !isRegisterWindowOpen || !registerDate || registerEnrollments.length === 0 || saveBusy, children: saveBusy ? "Guardando..." : "Guardar asistencia" })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginBottom: 8 }, children: [isAdminView && (_jsxs("select", { className: "input", value: historyTeacherFilter, onChange: (e) => setHistoryTeacherFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los docentes" }), teachers.map((teacher) => (_jsx("option", { value: teacher.id, children: teacher.fullName }, teacher.id)))] })), _jsx("input", { className: "input", placeholder: "Estudiante", value: historyStudentFilter, onChange: (e) => setHistoryStudentFilter(e.target.value) }), _jsxs("select", { className: "input", value: historyGradeFilter, onChange: (e) => setHistoryGradeFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los grados" }), allTeacherGrades.map((grade) => (_jsx("option", { value: grade, children: grade }, grade)))] }), _jsxs("select", { className: "input", value: historyGroupFilter, onChange: (e) => setHistoryGroupFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los grupos" }), (isAdminView ? adminGroupOptions : historyValidGroups).map((group) => (_jsx("option", { value: group, children: group }, group)))] }), _jsx("input", { className: "input", type: "date", value: historyDateFilter, onChange: (e) => setHistoryDateFilter(e.target.value) }), _jsxs("select", { className: "input", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los estados" }), _jsx("option", { value: "PRESENT", children: "Presente" }), _jsx("option", { value: "ABSENT", children: "Ausente" }), _jsx("option", { value: "LATE", children: "Tarde" }), _jsx("option", { value: "EXCUSED", children: "Justificado" })] }), _jsx("button", { type: "button", className: "button secondary", onClick: () => {
                            setHistoryStudentFilter("");
                            setHistoryGradeFilter("");
                            setHistoryGroupFilter("");
                            setHistoryDateFilter("");
                            setStatusFilter("");
                            setHistoryTeacherFilter("");
                            setPage(1);
                        }, children: "Limpiar filtros" })] }), !isAdminView && (_jsx("div", { style: { marginBottom: 8, color: "#475569", fontWeight: 600 }, children: "Mostrando solo asistencia de tus grados y grupos de la franja valida de hoy." })), _jsxs("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 }, children: [_jsx("button", { type: "button", className: "button secondary", onClick: handleExportAttendance, disabled: exportBusy, children: exportBusy ? "Exportando..." : "Exportar asistencia" }), _jsx("button", { type: "button", className: "button secondary", onClick: handleExportAttendancePdf, disabled: exportPdfBusy, style: { marginLeft: 8 }, children: exportPdfBusy ? "Exportando PDF..." : "Exportar PDF" }), isAdminView && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "button secondary", onClick: handleExportAttendanceGradeDatesExcel, disabled: exportGradeDatesBusy, style: { marginLeft: 8 }, children: exportGradeDatesBusy ? "Exportando..." : "Reporte grado-fecha (Excel)" }), _jsx("button", { type: "button", className: "button secondary", onClick: handleExportAttendanceGradeDatesPdf, disabled: exportGradeDatesPdfBusy, style: { marginLeft: 8 }, children: exportGradeDatesPdfBusy ? "Exportando..." : "Reporte grado-fecha (PDF)" })] }))] }), _jsx(DataTable, { columns: [
                    { key: "student", label: "Estudiante" },
                    ...(isAdminView ? [{ key: "teacher", label: "Docente" }] : []),
                    { key: "grade", label: "Grado" },
                    { key: "group", label: "Grupo" },
                    { key: "date", label: "Fecha" },
                    { key: "status", label: "Estado" }
                ], rows: attendance.map((a) => ({
                    student: a.enrollment?.student?.fullName || "",
                    teacher: a.teacherName || a.enrollment?.class?.teacher?.user?.fullName || "",
                    grade: getClassGradeLevel(a.enrollment?.class),
                    group: a.enrollment?.student?.studentGroup || "",
                    date: a.date?.slice(0, 10) || "",
                    status: a.status
                })) }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: page <= 1, onClick: () => setPage(page - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", page, " de ", Math.max(1, Math.ceil(total / 1)), " (fecha)"] }), _jsx("button", { className: "button secondary", disabled: page >= Math.ceil(total / 1), onClick: () => setPage(page + 1), children: "Siguiente" })] })] }));
}
