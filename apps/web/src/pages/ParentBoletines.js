import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiDownload, apiGet } from "../services/api";
function getClassGradeLevel(classData) {
    return String(classData?.gradeLevel || "").trim();
}
export default function ParentBoletines() {
    const [grades, setGrades] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [periodFilter, setPeriodFilter] = useState("");
    const [children, setChildren] = useState([]);
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
        if (!studentId)
            return;
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
    return (_jsxs(Section, { title: "Boletines", children: [_jsx("div", { className: "help-card", children: "Descarga boletines y revisa el historial academico." }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: "Descargar boletin" }), _jsxs("label", { children: ["Estudiante", _jsxs("select", { className: "input", value: studentId, onChange: (e) => setStudentId(e.target.value), children: [_jsx("option", { value: "", children: "Selecciona" }), children.map((c) => (_jsx("option", { value: c.id, children: c.fullName }, c.id)))] })] }), _jsx("button", { className: "button", style: { marginTop: 10 }, onClick: download, children: "Descargar PDF" })] }), _jsx(DataTable, { columns: [
                    { key: "student", label: "Estudiante" },
                    { key: "grade", label: "Grado" },
                    { key: "group", label: "Grupo" },
                    { key: "period", label: "Periodo" },
                    { key: "subject", label: "Asignatura" },
                    { key: "score", label: "Nota definitiva" }
                ], rows: grades.map((g) => ({
                    student: g.student,
                    grade: g.grade || getClassGradeLevel(g.enrollment?.class) || "",
                    group: g.group || "Sin grupo",
                    period: g.period,
                    subject: g.subject,
                    score: `${Number(g.finalScore || 0).toFixed(2)}/${g.maxScore ?? 0}`
                })).sort((a, b) => {
                    const studentA = String(a.student || "");
                    const studentB = String(b.student || "");
                    if (studentA !== studentB)
                        return studentA.localeCompare(studentB, "es");
                    const gradeA = String(a.grade || "");
                    const gradeB = String(b.grade || "");
                    if (gradeA !== gradeB)
                        return gradeA.localeCompare(gradeB, "es");
                    const groupA = String(a.group || "");
                    const groupB = String(b.group || "");
                    if (groupA !== groupB)
                        return groupA.localeCompare(groupB, "es");
                    const periodA = String(a.period || "");
                    const periodB = String(b.period || "");
                    if (periodA !== periodB)
                        return periodA.localeCompare(periodB, "es");
                    const subjectA = String(a.subject || "");
                    const subjectB = String(b.subject || "");
                    if (subjectA !== subjectB)
                        return subjectA.localeCompare(subjectB, "es");
                    return String(a.score || "").localeCompare(String(b.score || ""), "es");
                }) }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 8 }, children: [_jsxs("select", { className: "input", value: studentId, onChange: (e) => setStudentId(e.target.value), children: [_jsx("option", { value: "", children: "Todos los estudiantes" }), children.map((c) => (_jsx("option", { value: c.id, children: c.fullName }, c.id)))] }), _jsxs("select", { className: "input", value: periodFilter, onChange: (e) => setPeriodFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los periodos" }), _jsx("option", { value: "P1", children: "P1" }), _jsx("option", { value: "P2", children: "P2" }), _jsx("option", { value: "P3", children: "P3" }), _jsx("option", { value: "P4", children: "P4" })] })] }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: page <= 1, onClick: () => setPage(page - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", page, " de ", Math.max(1, Math.ceil(total / 10))] }), _jsx("button", { className: "button secondary", disabled: page >= Math.ceil(total / 10), onClick: () => setPage(page + 1), children: "Siguiente" })] })] }));
}
