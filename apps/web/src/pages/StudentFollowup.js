import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ActionFeedback from "../components/ActionFeedback";
import Section from "../components/Section";
import KpiCard from "../components/KpiCard";
import DataTable from "../components/DataTable";
import { apiDelete, apiDownload, apiGet, apiPatch, apiPost } from "../services/api";
import { gradeLabel } from "../services/grades";
import { useAuth } from "../context/AuthContext";
import { feedbackTitles, inferFeedbackTone } from "../utils/feedback";
const observationTypeOptions = [
    { value: "", label: "Todos los tipos" },
    { value: "ACADEMIC", label: "Academico" },
    { value: "COEXISTENCE", label: "Convivencia" }
];
function typeLabel(value) {
    if (value === "DISCIPLINARY")
        return "Disciplinario";
    return observationTypeOptions.find((item) => item.value === value)?.label || value;
}
export default function StudentFollowup() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const [students, setStudents] = useState([]);
    const [studentId, setStudentId] = useState("");
    const [formType, setFormType] = useState("ACADEMIC");
    const [convivenciaProtocol, setConvivenciaProtocol] = useState("TIPO_I");
    const [convivenciaOffense, setConvivenciaOffense] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formDetail, setFormDetail] = useState("");
    const [formDate, setFormDate] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [data, setData] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [typeFilter, setTypeFilter] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [loading, setLoading] = useState(false);
    const [verifyCode, setVerifyCode] = useState("");
    const [verifyResult, setVerifyResult] = useState(null);
    const [verifyError, setVerifyError] = useState("");
    const [certificateRequests, setCertificateRequests] = useState([]);
    const [certificateLoading, setCertificateLoading] = useState(false);
    const [certificateMessage, setCertificateMessage] = useState("");
    const [associationBusy, setAssociationBusy] = useState(false);
    const [associationMessage, setAssociationMessage] = useState("");
    const [parentRefreshBusy, setParentRefreshBusy] = useState(false);
    const [followUps, setFollowUps] = useState([]);
    const [followUpLoading, setFollowUpLoading] = useState(false);
    const [followUpMessage, setFollowUpMessage] = useState("");
    const [summary, setSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [detailObservation, setDetailObservation] = useState(null);
    const isParent = user?.role === "PARENT";
    const isAdmin = user?.role === "ADMIN";
    const isTeacher = user?.role === "TEACHER";
    const noTeacherStudents = isTeacher && students.length === 0;
    const shouldShowTimeline = !isParent || data.length > 0;
    const certificateTypes = [
        { type: "STUDY", kind: "study", label: "Constancia de estudio" },
        { type: "ENROLLMENT", kind: "enrollment", label: "Certificado de matricula" }
    ];
    const loadStudents = () => {
        const request = isParent
            ? apiGet("/parent/children")
            : isTeacher
                ? apiGet("/student-observations/allowed-students")
                : apiGet("/students/simple");
        return request
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
        return apiGet(`/student-observations?${query}`)
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
    const loadFollowUps = () => {
        if (isParent)
            return;
        setFollowUpLoading(true);
        const query = new URLSearchParams({
            days: "7",
            ...(studentId ? { studentId } : {})
        }).toString();
        apiGet(`/student-observations/follow-ups?${query}`)
            .then((res) => {
            setFollowUps(res.data || []);
        })
            .catch(() => setFollowUps([]))
            .finally(() => setFollowUpLoading(false));
    };
    useEffect(() => {
        loadStudents();
    }, [isParent, isTeacher]);
    useEffect(() => {
        const fromQuery = searchParams.get("studentId");
        if (fromQuery && fromQuery !== studentId) {
            setStudentId(fromQuery);
        }
    }, [searchParams, studentId]);
    useEffect(() => {
        load();
    }, [page, studentId, typeFilter, fromDate, toDate]);
    useEffect(() => {
        if (isParent) {
            setFollowUps([]);
            return;
        }
        loadFollowUps();
    }, [studentId, isParent]);
    useEffect(() => {
        if (!isParent || !studentId) {
            setCertificateRequests([]);
            return;
        }
        setCertificateLoading(true);
        apiGet(`/reports/certificate/requests/me?studentId=${encodeURIComponent(studentId)}`)
            .then((res) => {
            setCertificateRequests(Array.isArray(res?.data) ? res.data : []);
        })
            .catch(() => setCertificateRequests([]))
            .finally(() => setCertificateLoading(false));
    }, [isParent, studentId]);
    useEffect(() => {
        if (!studentId) {
            setSummary(null);
            return;
        }
        setSummaryLoading(true);
        apiGet(`/student-observations/summary?studentId=${encodeURIComponent(studentId)}`)
            .then((res) => {
            setSummary({
                total: Number(res.total || 0),
                academic: Number(res.academic || 0),
                coexistence: Number(res.coexistence || 0),
                pendingFollowUps: Number(res.pendingFollowUps || 0)
            });
        })
            .catch(() => setSummary(null))
            .finally(() => setSummaryLoading(false));
    }, [studentId]);
    const createObservation = async (e) => {
        e.preventDefault();
        if (!studentId) {
            setMessage("Selecciona un estudiante.");
            return;
        }
        if (formType === "ACADEMIC" && !formDescription.trim()) {
            setMessage("Describe la situacion academica.");
            return;
        }
        if (formType === "COEXISTENCE" && !formDescription.trim()) {
            setMessage("Describe la situacion presentada.");
            return;
        }
        if (formType === "COEXISTENCE" && !convivenciaOffense) {
            setMessage("Selecciona la falta reportada.");
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
                ...(formType === "COEXISTENCE" ? { coexistenceProtocol: convivenciaProtocol } : {}),
                ...(formType === "COEXISTENCE" ? { coexistenceOffense: convivenciaOffense } : {}),
                ...(formType === "COEXISTENCE" || formType === "ACADEMIC" ? { autoDetail: false } : {}),
                ...(formDate ? { date: formDate } : {}),
                ...(followUpDate ? { followUpDate } : {})
            });
            setFormDetail("");
            setFormDescription("");
            setConvivenciaOffense("");
            setFormDate("");
            setFollowUpDate("");
            setMessage("Observacion registrada.");
            load();
            loadFollowUps();
        }
        catch (error) {
            setMessage(error?.message || "No se pudo registrar la observacion.");
        }
        finally {
            setBusy(false);
        }
    };
    const deleteObservation = async (id) => {
        if (!isAdmin)
            return;
        const confirmed = window.confirm("Eliminar observacion?");
        if (!confirmed)
            return;
        try {
            await apiDelete(`/student-observations/${id}`);
            load();
        }
        catch (error) {
            setMessage(error?.message || "No se pudo eliminar.");
        }
    };
    const markFollowUpDone = async (id) => {
        setFollowUpMessage("");
        try {
            await apiPatch(`/student-observations/${id}`, { followUpCompleted: true });
            loadFollowUps();
            load();
        }
        catch (error) {
            setFollowUpMessage(error?.message || "No se pudo actualizar el seguimiento.");
        }
    };
    const openDetail = (row) => {
        setDetailObservation(row);
    };
    const downloadCertificate = async (kind) => {
        if (!studentId) {
            setCertificateMessage("Selecciona un estudiante para descargar el certificado.");
            return;
        }
        try {
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
            setCertificateMessage("");
        }
        catch (error) {
            setCertificateMessage(error?.message || "No se pudo descargar el certificado.");
        }
    };
    const downloadObserverFormat = async () => {
        if (!studentId) {
            setCertificateMessage("Selecciona un estudiante para exportar el observador.");
            return;
        }
        try {
            const blob = await apiDownload(`/reports/student-observer/${studentId}`);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `observador-estudiante-${studentId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setCertificateMessage("");
        }
        catch (error) {
            setCertificateMessage(error?.message || "No se pudo exportar el observador.");
        }
    };
    const downloadObserverTemplates = async () => {
        try {
            const blob = await apiDownload("/reports/student-observer/templates");
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "plantillas-observador-estudiante.pdf";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }
        catch (error) {
            setCertificateMessage(error?.message || "No se pudo exportar las plantillas del observador.");
        }
    };
    const downloadConvivenciaTool = async (kind) => {
        try {
            const blob = await apiDownload(`/reports/convivencia/${kind}`);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download =
                kind === "protocolos"
                    ? "protocolos-convivencia.pdf"
                    : kind === "acta"
                        ? "acta-comite-convivencia.pdf"
                        : "cartel-ruta-convivencia.pdf";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }
        catch (error) {
            setCertificateMessage(error?.message || "No se pudo descargar la herramienta de convivencia.");
        }
    };
    const requestCertificate = async (type) => {
        if (!studentId) {
            setCertificateMessage("Selecciona un estudiante para solicitar el certificado.");
            return;
        }
        setCertificateLoading(true);
        setCertificateMessage("");
        try {
            await apiPost("/reports/certificate/requests", { studentId, type });
            const res = await apiGet(`/reports/certificate/requests/me?studentId=${encodeURIComponent(studentId)}`);
            setCertificateRequests(Array.isArray(res?.data) ? res.data : []);
            setCertificateMessage("Solicitud enviada al area administrativa.");
        }
        catch (error) {
            setCertificateMessage(error?.message || "No se pudo enviar la solicitud.");
        }
        finally {
            setCertificateLoading(false);
        }
    };
    const requestAssociation = async () => {
        setAssociationBusy(true);
        setAssociationMessage("");
        try {
            const res = await apiPost("/parent/association-request", {});
            if (res?.alreadyPending) {
                setAssociationMessage(res?.message || "Ya existe una solicitud pendiente.");
            }
            else {
                setAssociationMessage("Solicitud enviada al area administrativa.");
            }
        }
        catch (error) {
            setAssociationMessage(error?.message || "No se pudo enviar la solicitud.");
        }
        finally {
            setAssociationBusy(false);
        }
    };
    const refreshParentObservations = async () => {
        if (parentRefreshBusy)
            return;
        setParentRefreshBusy(true);
        try {
            await Promise.all([loadStudents(), load()]);
        }
        finally {
            setParentRefreshBusy(false);
        }
    };
    const latestRequestFor = (type) => certificateRequests.find((r) => r.type === type);
    const protocolHint = (protocol) => {
        if (protocol === "TIPO_I")
            return "Tipo I (conflictos leves)";
        if (protocol === "TIPO_II")
            return "Tipo II (agresion o acoso escolar)";
        if (protocol === "TIPO_III")
            return "Tipo III (situaciones que pueden ser delito)";
        return "";
    };
    const protocolLabel = (protocol) => {
        if (protocol === "TIPO_I")
            return "Tipo I";
        if (protocol === "TIPO_II")
            return "Tipo II";
        if (protocol === "TIPO_III")
            return "Tipo III";
        return "-";
    };
    const formatFollowUpStatus = (done) => (done ? "Completado" : "Pendiente");
    const daysUntil = (date) => {
        if (!date)
            return "";
        const due = new Date(date);
        if (Number.isNaN(due.getTime()))
            return "";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 0)
            return "Hoy";
        if (diff > 0)
            return `En ${diff} dia(s)`;
        return `Atrasado ${Math.abs(diff)} dia(s)`;
    };
    const buildConvivenciaDetail = (description, protocol, offense) => {
        const templates = {
            TIPO_I: {
                label: "Tipo I (conflictos leves)",
                procedure: [
                    "El docente identifica la situacion.",
                    "Se separa a los estudiantes involucrados.",
                    "Se realiza dialogo pedagogico entre las partes.",
                    "Se promueve la mediacion y reconciliacion.",
                    "Se establecen compromisos de convivencia.",
                    "Se registra el hecho en el observador del estudiante.",
                    "El docente realiza seguimiento para evitar repeticion."
                ],
                commitments: [
                    "Respetar los acuerdos de convivencia definidos.",
                    "Participar en actividades de mediacion y reparacion.",
                    "Evitar reincidencia y reportar nuevas situaciones."
                ],
                followups: [
                    "Seguimiento docente inicial (fecha: ____ / responsable: ____).",
                    "Verificacion de compromisos a 15 dias (fecha: ____ / responsable: ____)."
                ],
                citations: ["Citar a acudientes si hay reincidencia (fecha: ____ / medio: ____)."]
            },
            TIPO_II: {
                label: "Tipo II (agresion o acoso escolar)",
                procedure: [
                    "El docente informa al coordinador o directivo.",
                    "Se realiza registro formal del caso.",
                    "Se convoca al Comite Escolar de Convivencia.",
                    "Se analiza la situacion y se escuchan las partes.",
                    "Se cita a padres o acudientes.",
                    "Se establecen acciones pedagogicas o correctivas.",
                    "Se realiza seguimiento institucional."
                ],
                commitments: [
                    "Compromiso pedagogico firmado por el estudiante.",
                    "Plan de apoyo socioemocional y seguimiento.",
                    "Cumplir medidas correctivas definidas por el comite."
                ],
                followups: [
                    "Seguimiento institucional semanal (fecha: ____ / responsable: ____).",
                    "Informe de avance al Comite de Convivencia (fecha: ____)."
                ],
                citations: [
                    "Citar a padres/acudientes (fecha: ____ / medio: ____).",
                    "Registro en acta del Comite de Convivencia."
                ]
            },
            TIPO_III: {
                label: "Tipo III (situaciones que pueden constituir delito)",
                procedure: [
                    "Se protege inmediatamente al estudiante afectado.",
                    "Se informa al rector o directivo.",
                    "Se activa la Ruta de Atencion Externa.",
                    "Se informa a las autoridades competentes.",
                    "Se registra el caso en el sistema institucional.",
                    "Se realiza seguimiento institucional."
                ],
                commitments: [
                    "Garantizar proteccion inmediata del estudiante.",
                    "Coordinar con entidades externas y soporte psicosocial.",
                    "Registrar avances y decisiones institucionales."
                ],
                followups: [
                    "Seguimiento institucional permanente (fecha: ____ / responsable: ____).",
                    "Reporte de avances a entidades competentes (fecha: ____)."
                ],
                citations: [
                    "Citar a padres/acudientes de forma inmediata (fecha: ____ / medio: ____).",
                    "Notificar a ICBF/Policia/Fiscalia segun corresponda."
                ]
            }
        };
        const template = templates[protocol] || templates.TIPO_I;
        const lines = [
            "RUTA INTEGRAL PARA LA CONVIVENCIA ESCOLAR",
            `Protocolo: ${template.label}`,
            `Falta reportada: ${offense || "-"}`,
            "",
            "Descripcion de la situacion:",
            description,
            "",
            "Procedimiento aplicado:"
        ];
        template.procedure.forEach((line, index) => lines.push(`${index + 1}. ${line}`));
        lines.push("", "Compromisos automaticos:");
        template.commitments.forEach((line) => lines.push(`- ${line}`));
        lines.push("", "Tareas de seguimiento:");
        template.followups.forEach((line) => lines.push(`- [ ] ${line}`));
        lines.push("", "Citaciones y comunicaciones:");
        template.citations.forEach((line) => lines.push(`- [ ] ${line}`));
        return lines.join("\n");
    };
    const offenseOptionsByProtocol = {
        TIPO_I: [
            "Llegar tarde a clase sin justificacion.",
            "Interrumpir constantemente la clase.",
            "No portar el uniforme correctamente.",
            "Comer dentro del aula sin autorizacion.",
            "Uso inadecuado del celular durante la clase.",
            "No traer materiales de trabajo.",
            "Hacer ruido o distracciones durante la explicacion del docente.",
            "Levantarse del puesto sin permiso.",
            "Burlas leves entre companeros.",
            "Incumplir normas basicas del aula."
        ],
        TIPO_II: [
            "Insultar o faltar al respeto a un companero.",
            "Amenazar a otro estudiante.",
            "Empujar o agredir fisicamente sin causar lesiones graves.",
            "Difundir rumores o chismes que afecten a otros.",
            "Realizar ciberacoso o burlas en redes sociales.",
            "Dañar materiales o pertenencias de companeros.",
            "Desobedecer de forma reiterada a los docentes.",
            "Participar en peleas dentro de la institucion.",
            "Esconder o robar objetos de poco valor a companeros.",
            "Actos de discriminacion por apariencia, origen o creencias."
        ],
        TIPO_III: [
            "Agresion fisica grave que cause lesiones.",
            "Amenazas graves o intimidacion constante.",
            "Porte o uso de armas dentro de la institucion.",
            "Consumo o distribucion de sustancias psicoactivas.",
            "Robo de objetos de valor.",
            "Acoso escolar grave o sistematico (bullying).",
            "Abuso o acoso sexual.",
            "Extorsion o intimidacion a companeros.",
            "Daño grave a la infraestructura del colegio.",
            "Publicar contenido intimo o humillante de otros estudiantes."
        ]
    };
    const offenseOptions = offenseOptionsByProtocol[convivenciaProtocol] || [];
    const buildAcademicDetail = (description) => {
        const template = {
            procedure: [
                "El docente identifica la dificultad academica.",
                "Se revisa el desempeño y evidencias del estudiante.",
                "Se diseña un plan de apoyo pedagogico.",
                "Se acuerdan estrategias con el estudiante.",
                "Se comunica a padres o acudientes.",
                "Se registra el seguimiento en el observador."
            ],
            commitments: [
                "Cumplir el plan de apoyo y tareas asignadas.",
                "Asistir a refuerzos o tutorias programadas.",
                "Mantener comunicacion con docente y acudientes."
            ],
            followups: [
                "Seguimiento semanal del avance (fecha: ____ / responsable: ____).",
                "Reevaluacion del desempeño a 30 dias (fecha: ____ / responsable: ____)."
            ],
            citations: ["Citar a padres/acudientes si persiste la dificultad (fecha: ____ / medio: ____)."]
        };
        const lines = [
            "SEGUIMIENTO ACADEMICO",
            "Descripcion de la situacion:",
            description,
            "",
            "Procedimiento aplicado:"
        ];
        template.procedure.forEach((line, index) => lines.push(`${index + 1}. ${line}`));
        lines.push("", "Compromisos automaticos:");
        template.commitments.forEach((line) => lines.push(`- ${line}`));
        lines.push("", "Tareas de seguimiento:");
        template.followups.forEach((line) => lines.push(`- [ ] ${line}`));
        lines.push("", "Citaciones y comunicaciones:");
        template.citations.forEach((line) => lines.push(`- [ ] ${line}`));
        return lines.join("\n");
    };
    useEffect(() => {
        if (formType === "COEXISTENCE") {
            setFormDetail(buildConvivenciaDetail(formDescription.trim(), convivenciaProtocol, convivenciaOffense));
            return;
        }
        if (formType === "ACADEMIC") {
            setFormDetail(buildAcademicDetail(formDescription.trim()));
        }
    }, [formType, convivenciaProtocol, convivenciaOffense, formDescription]);
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
        }
        catch (error) {
            setVerifyResult(null);
            setVerifyError(error?.message || "No se pudo verificar el certificado.");
        }
    };
    return (_jsxs("div", { className: "grid", style: { gap: 20 }, children: [_jsxs(Section, { title: "Seguimiento estudiantil", children: [_jsx("div", { className: "help-card", children: "Consulta observaciones del estudiante y gestiona certificados desde el area administrativa." }), _jsxs("div", { className: "card", children: [_jsxs("label", { children: ["Estudiante", _jsxs("select", { className: "input", value: studentId, onChange: (e) => {
                                            const nextStudentId = e.target.value;
                                            setStudentId(nextStudentId);
                                            setFormDescription("");
                                            setFormDetail("");
                                            setConvivenciaOffense("");
                                            if (formType === "COEXISTENCE") {
                                                const nextOffense = offenseOptionsByProtocol[convivenciaProtocol]?.[0] || "";
                                                setConvivenciaOffense(nextOffense);
                                                setFormDetail(buildConvivenciaDetail("", convivenciaProtocol, nextOffense));
                                            }
                                            else if (formType === "ACADEMIC") {
                                                setFormDetail(buildAcademicDetail(""));
                                            }
                                        }, children: [_jsx("option", { value: "", children: "Selecciona" }), students.map((s) => (_jsxs("option", { value: s.id, children: [s.fullName, s.gradeLevel ? ` - ${gradeLabel(s.gradeLevel)}${s.studentGroup ? s.studentGroup : ""}` : "", s.latestYear ? ` (${s.latestYear})` : ""] }, s.id)))] })] }), isParent && (_jsx("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 8 }, children: _jsx("button", { className: "button secondary", type: "button", onClick: refreshParentObservations, disabled: parentRefreshBusy, children: parentRefreshBusy ? "Actualizando..." : "Actualizar observaciones" }) })), isParent && students.length === 0 && (_jsxs("div", { style: { color: "#64748b", marginTop: 6, display: "grid", gap: 8 }, children: [_jsxs("div", { children: ["No hay estudiantes asociados a tu cuenta. Verifica que el correo del acudiente coincida con el registrado en la matr\u00EDcula.", user?.email ? ` Correo actual: ${user.email}.` : ""] }), _jsx("div", { children: _jsx("button", { className: "button secondary", type: "button", onClick: requestAssociation, disabled: associationBusy, children: associationBusy ? "Enviando solicitud..." : "Solicitar asociación" }) }), _jsx(ActionFeedback, { tone: inferFeedbackTone(associationMessage), title: feedbackTitles.studentFollowup.association, message: associationMessage, onDismiss: () => setAssociationMessage(""), style: { marginBottom: 0 } })] }))] }), _jsx(ActionFeedback, { tone: inferFeedbackTone(certificateMessage), title: feedbackTitles.studentFollowup.certificates, message: certificateMessage, onDismiss: () => setCertificateMessage(""), style: { marginTop: 8 } }), studentId && (_jsxs("div", { className: "grid grid-4", style: { marginTop: 10 }, children: [_jsx(KpiCard, { title: "Observaciones", value: summaryLoading ? "..." : String(summary?.total || 0), trend: "Total", tone: "primary" }), _jsx(KpiCard, { title: "Academico", value: summaryLoading ? "..." : String(summary?.academic || 0), trend: "Tipo academico", tone: "success" }), _jsx(KpiCard, { title: "Convivencia", value: summaryLoading ? "..." : String(summary?.coexistence || 0), trend: "Tipo convivencia", tone: "warning" }), _jsx(KpiCard, { title: "Seguimientos", value: summaryLoading ? "..." : String(summary?.pendingFollowUps || 0), trend: "Pendientes", tone: "danger" })] })), isAdmin ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "card", style: { marginTop: 10 }, children: _jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [_jsx("button", { className: "button secondary", type: "button", onClick: () => downloadCertificate("study"), children: "Constancia de estudio (PDF)" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => downloadCertificate("enrollment"), children: "Certificado de matricula (PDF)" }), _jsx("button", { className: "button secondary", type: "button", onClick: downloadObserverFormat, children: "Exportar observador (PDF)" }), _jsx("button", { className: "button secondary", type: "button", onClick: downloadObserverTemplates, children: "Plantillas observador (PDF)" })] }) }), _jsxs("div", { className: "card", style: { marginTop: 10 }, children: [_jsx("div", { className: "section-title", children: "Verificar certificado por codigo" }), _jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [_jsx("input", { className: "input", placeholder: "Ej: E-2026-12-ABC12345", value: verifyCode, onChange: (e) => setVerifyCode(e.target.value) }), _jsx("button", { type: "button", className: "button secondary", onClick: verifyCertificate, children: "Verificar" })] }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.studentFollowup.verifyError, message: verifyError, onDismiss: () => setVerifyError(""), style: { marginTop: 8 } }), verifyResult && (_jsxs("div", { style: { marginTop: 8, color: "#334155" }, children: ["Valido: ", verifyResult.type, " #", verifyResult.serial, "/", verifyResult.year, " - ", verifyResult.code, _jsx("br", {}), "Estudiante: ", verifyResult.student?.fullName || "-", " (", verifyResult.student?.gradeLevel ? gradeLabel(verifyResult.student.gradeLevel) : "-", verifyResult.student?.studentGroup ? `-${verifyResult.student.studentGroup}` : "", ")", _jsx("br", {}), "Emitido por: ", verifyResult.issuedBy?.fullName || "-", " (", verifyResult.issuedBy?.role || "-", ")"] }))] })] })) : isParent ? (_jsxs("div", { className: "card", style: { marginTop: 10 }, children: [_jsx("div", { className: "section-title", children: "Solicitudes de certificados" }), _jsx("div", { style: { color: "#475569", marginBottom: 8 }, children: "La descarga solo estara disponible despues de la aprobacion administrativa." }), certificateLoading ? (_jsx("div", { style: { color: "#64748b" }, children: "Cargando solicitudes..." })) : (_jsx("div", { style: { display: "grid", gap: 10 }, children: certificateTypes.map((item) => {
                                    const latest = latestRequestFor(item.type);
                                    const status = latest?.status || "NONE";
                                    const statusLabel = status === "APPROVED"
                                        ? "Aprobado"
                                        : status === "PENDING"
                                            ? "En revision"
                                            : status === "REJECTED"
                                                ? "Rechazado"
                                                : "Sin solicitud";
                                    return (_jsxs("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }, children: [_jsx("strong", { style: { minWidth: 180 }, children: item.label }), _jsx("span", { style: { color: status === "APPROVED" ? "#166534" : status === "REJECTED" ? "#b91c1c" : "#475569" }, children: statusLabel }), status === "APPROVED" ? (_jsx("button", { className: "button secondary", type: "button", onClick: () => downloadCertificate(item.kind), children: "Descargar PDF" })) : (_jsx("button", { className: "button secondary", type: "button", disabled: certificateLoading || status === "PENDING", onClick: () => requestCertificate(item.type), children: status === "REJECTED" ? "Reenviar solicitud" : status === "PENDING" ? "En revision" : "Solicitar autorizacion" }))] }, item.type));
                                }) }))] })) : null] }), !isParent && (_jsxs(Section, { title: "Observador del estudiante", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: "Ruta Integral para la Convivencia Escolar" }), _jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [_jsx("button", { className: "button secondary", type: "button", onClick: () => downloadConvivenciaTool("protocolos"), children: "Protocolos Tipo I-II-III (PDF)" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => downloadConvivenciaTool("acta"), children: "Acta Comite de Convivencia (PDF)" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => downloadConvivenciaTool("cartel"), children: "Cartel Ruta de Convivencia (PDF)" })] })] }), noTeacherStudents ? (_jsx("div", { className: "card", style: { color: "#64748b" }, children: "No tienes grados o grupos asignados para registrar observaciones. Contacta al administrador para asignarte horarios/grade-group." })) : (_jsxs("form", { className: "card", onSubmit: createObservation, children: [_jsxs("label", { children: ["Tipo de observacion", _jsx("select", { className: "input", value: formType, onChange: (e) => {
                                            const nextType = e.target.value;
                                            setFormType(nextType);
                                            setFormDescription("");
                                            setConvivenciaOffense("");
                                            if (nextType === "COEXISTENCE") {
                                                const nextOffense = offenseOptionsByProtocol[convivenciaProtocol]?.[0] || "";
                                                setConvivenciaOffense(nextOffense);
                                                setFormDetail(buildConvivenciaDetail("", convivenciaProtocol, nextOffense));
                                            }
                                            else if (nextType === "ACADEMIC") {
                                                setFormDetail(buildAcademicDetail(""));
                                            }
                                            else {
                                                setFormDetail("");
                                            }
                                        }, children: observationTypeOptions
                                            .filter((o) => o.value)
                                            .map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) })] }), formType === "COEXISTENCE" && (_jsxs(_Fragment, { children: [_jsxs("label", { children: ["Protocolo sugerido (Ruta de Convivencia)", _jsxs("select", { className: "input", value: convivenciaProtocol, onChange: (e) => {
                                                    const nextProtocol = e.target.value;
                                                    setConvivenciaProtocol(nextProtocol);
                                                    const nextOffense = offenseOptionsByProtocol[nextProtocol]?.[0] || "";
                                                    setConvivenciaOffense(nextOffense);
                                                    setFormDetail(buildConvivenciaDetail(formDescription.trim(), nextProtocol, nextOffense));
                                                }, children: [_jsx("option", { value: "TIPO_I", children: "Tipo I (conflictos leves)" }), _jsx("option", { value: "TIPO_II", children: "Tipo II (agresion o acoso escolar)" }), _jsx("option", { value: "TIPO_III", children: "Tipo III (situaciones que pueden ser delito)" })] })] }), _jsxs("label", { children: ["Falta reportada", _jsxs("select", { className: "input", value: convivenciaOffense, onChange: (e) => {
                                                    const nextOffense = e.target.value;
                                                    setConvivenciaOffense(nextOffense);
                                                    setFormDetail(buildConvivenciaDetail(formDescription.trim(), convivenciaProtocol, nextOffense));
                                                }, children: [_jsx("option", { value: "", children: "Selecciona la falta" }), offenseOptions.map((item) => (_jsx("option", { value: item, children: item }, item)))] })] }), _jsx("div", { style: { color: "#64748b", marginTop: -6 }, children: protocolHint(convivenciaProtocol) })] })), _jsxs("label", { children: ["Fecha (opcional)", _jsx("input", { type: "date", className: "input", value: formDate, onChange: (e) => setFormDate(e.target.value) })] }), _jsxs("label", { children: ["Fecha de seguimiento (opcional)", _jsx("input", { type: "date", className: "input", value: followUpDate, onChange: (e) => setFollowUpDate(e.target.value) })] }), _jsx("div", { style: { color: "#64748b", marginTop: -6 }, children: "Si agregas una fecha, aparecera en \"Seguimientos pendientes\"." }), formType === "COEXISTENCE" || formType === "ACADEMIC" ? (_jsxs(_Fragment, { children: [_jsxs("label", { children: [formType === "ACADEMIC" ? "Descripcion academica" : "Descripcion de la situacion", _jsx("textarea", { className: "input", rows: 3, value: formDescription, onChange: (e) => setFormDescription(e.target.value) })] }), _jsxs("label", { children: ["Detalle automatico (editable)", _jsx("textarea", { className: "input", rows: 8, value: formDetail, onChange: (e) => setFormDetail(e.target.value) })] }), _jsx("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: _jsx("button", { type: "button", className: "button secondary", onClick: () => {
                                                const description = formDescription.trim();
                                                setFormDetail(formType === "COEXISTENCE"
                                                    ? buildConvivenciaDetail(description, convivenciaProtocol, convivenciaOffense)
                                                    : buildAcademicDetail(description));
                                            }, children: "Restaurar plantilla" }) })] })) : (_jsxs("label", { children: ["Observacion", _jsx("textarea", { className: "input", rows: 4, value: formDetail, onChange: (e) => setFormDetail(e.target.value) })] })), _jsx(ActionFeedback, { tone: inferFeedbackTone(message), title: feedbackTitles.studentFollowup.observation, message: message, onDismiss: () => setMessage(""), style: { marginTop: 8 } }), _jsx("button", { className: "button", style: { marginTop: 10 }, disabled: busy, children: busy ? "Guardando..." : "Registrar observacion" })] }))] })), !isParent && (_jsxs(Section, { title: "Seguimientos pendientes", children: [_jsx("div", { className: "help-card", children: "Listado automatico de seguimientos por vencer (proximos 7 dias)." }), noTeacherStudents ? (_jsx("div", { className: "card", style: { color: "#64748b" }, children: "No tienes grados o grupos asignados para gestionar seguimientos." })) : (_jsxs(_Fragment, { children: [_jsx(ActionFeedback, { tone: inferFeedbackTone(followUpMessage), title: feedbackTitles.studentFollowup.followUps, message: followUpMessage, onDismiss: () => setFollowUpMessage("") }), _jsx(DataTable, { columns: [
                                    { key: "date", label: "Seguimiento" },
                                    { key: "status", label: "Estado" },
                                    { key: "student", label: "Estudiante" },
                                    { key: "grade", label: "Grado" },
                                    { key: "type", label: "Tipo" },
                                    { key: "detail", label: "Detalle" },
                                    { key: "actions", label: "Acciones" }
                                ], rows: followUpLoading
                                    ? [
                                        { date: "Cargando...", status: "", student: "", grade: "", type: "", detail: "", actions: "" }
                                    ]
                                    : followUps.length === 0
                                        ? [
                                            { date: "Sin seguimientos pendientes", status: "", student: "", grade: "", type: "", detail: "", actions: "" }
                                        ]
                                        : followUps.map((row) => ({
                                            date: row.followUpDate ? `${String(row.followUpDate).slice(0, 10)} (${daysUntil(row.followUpDate)})` : "-",
                                            status: formatFollowUpStatus(row.followUpCompleted),
                                            student: row.student?.fullName || "-",
                                            grade: row.student?.gradeLevel ? gradeLabel(row.student.gradeLevel) : "-",
                                            type: typeLabel(row.type),
                                            detail: row.detail || "",
                                            actions: (_jsx("button", { className: "button secondary", type: "button", onClick: () => markFollowUpDone(row.id), children: "Marcar hecho" }))
                                        })) })] }))] })), shouldShowTimeline && (_jsxs(Section, { title: "Linea de tiempo", children: [_jsx("div", { className: "help-card", children: "Ultimas observaciones registradas para el estudiante seleccionado." }), _jsx("div", { className: "card", style: { display: "grid", gap: 10 }, children: data.length === 0 ? (_jsx("div", { style: { color: "#64748b" }, children: "Selecciona un estudiante para ver la linea de tiempo." })) : (data.slice(0, 6).map((row) => (_jsxs("div", { style: { display: "grid", gap: 6, padding: 10, border: "1px solid #e2e8f0", borderRadius: 8 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }, children: [_jsx("strong", { children: row.student?.fullName || "-" }), _jsx("span", { style: { color: "#64748b" }, children: String(row.date || "").slice(0, 10) })] }), _jsxs("div", { style: { color: "#475569" }, children: [typeLabel(row.type), " ", row.coexistenceProtocol ? `- ${protocolLabel(row.coexistenceProtocol)}` : ""] }), _jsx("div", { style: { color: "#334155" }, children: row.detail || "-" }), _jsx("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: _jsx("button", { className: "button secondary", type: "button", onClick: () => openDetail(row), children: "Ver detalle" }) })] }, row.id)))) })] })), _jsxs(Section, { title: "Historial de observaciones", children: [!noTeacherStudents && (_jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }, children: [_jsx("select", { className: "input", value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), children: observationTypeOptions.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value || "all"))) }), _jsx("input", { type: "date", className: "input", value: fromDate, onChange: (e) => setFromDate(e.target.value) }), _jsx("input", { type: "date", className: "input", value: toDate, onChange: (e) => setToDate(e.target.value) })] })), noTeacherStudents ? (_jsx("div", { className: "card", style: { color: "#64748b" }, children: "No tienes grados o grupos asignados para consultar historial de observaciones." })) : (_jsx(DataTable, { columns: [
                            { key: "date", label: "Fecha" },
                            { key: "student", label: "Estudiante" },
                            { key: "grade", label: "Grado" },
                            { key: "group", label: "Grupo" },
                            { key: "type", label: "Tipo" },
                            { key: "protocol", label: "Protocolo" },
                            { key: "offense", label: "Falta" },
                            ...(!isParent
                                ? [
                                    { key: "followUp", label: "Seguimiento" },
                                    { key: "followUpStatus", label: "Estado seguimiento" }
                                ]
                                : []),
                            { key: "detail", label: "Detalle" },
                            ...(!isAdmin ? [{ key: "view", label: "Ver" }] : []),
                            { key: "author", label: "Registrado por" },
                            ...(isAdmin ? [{ key: "actions", label: "Acciones" }] : [])
                        ], rows: loading
                            ? [
                                {
                                    date: "Cargando...",
                                    student: "",
                                    grade: "",
                                    group: "",
                                    type: "",
                                    protocol: "",
                                    offense: "",
                                    detail: "",
                                    author: "",
                                    ...(isAdmin ? { actions: "" } : {})
                                }
                            ]
                            : data.map((row) => ({
                                date: String(row.date || "").slice(0, 10),
                                student: row.student?.fullName || "-",
                                grade: row.student?.gradeLevel ? gradeLabel(row.student.gradeLevel) : "-",
                                group: row.student?.studentGroup || "-",
                                type: typeLabel(row.type),
                                protocol: row.type === "COEXISTENCE" ? protocolLabel(row.coexistenceProtocol) : "-",
                                offense: row.type === "COEXISTENCE" ? row.coexistenceOffense || "-" : "-",
                                followUp: row.followUpDate ? String(row.followUpDate).slice(0, 10) : "-",
                                followUpStatus: formatFollowUpStatus(row.followUpCompleted),
                                detail: row.detail || "",
                                view: (_jsx("button", { className: "button secondary", type: "button", onClick: () => openDetail(row), children: "Ver" })),
                                author: row.createdBy?.fullName || "-",
                                ...(isAdmin
                                    ? {
                                        actions: (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("button", { className: "button secondary", type: "button", onClick: () => openDetail(row), children: "Ver" }), _jsx("button", { className: "button danger", type: "button", onClick: () => deleteObservation(row.id), children: "Eliminar" })] }))
                                    }
                                    : {})
                            })) })), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: page <= 1, onClick: () => setPage(page - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", page, " de ", Math.max(1, Math.ceil(total / 10))] }), _jsx("button", { className: "button secondary", disabled: page >= Math.ceil(total / 10), onClick: () => setPage(page + 1), children: "Siguiente" })] })] }), detailObservation && (_jsx("div", { style: {
                    position: "fixed",
                    inset: 0,
                    background: "rgba(15, 23, 42, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 60,
                    padding: 16
                }, onClick: () => setDetailObservation(null), children: _jsxs("div", { className: "card", style: { maxWidth: 720, width: "100%", maxHeight: "80vh", overflow: "auto" }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }, children: [_jsx("div", { className: "section-title", children: "Detalle de observacion" }), _jsx("button", { className: "button secondary", onClick: () => setDetailObservation(null), children: "Cerrar" })] }), _jsxs("div", { style: { display: "grid", gap: 6, marginTop: 8 }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Estudiante:" }), " ", detailObservation.student?.fullName || "-"] }), _jsxs("div", { children: [_jsx("strong", { children: "Fecha:" }), " ", String(detailObservation.date || "").slice(0, 10)] }), _jsxs("div", { children: [_jsx("strong", { children: "Tipo:" }), " ", typeLabel(detailObservation.type)] }), detailObservation.type === "COEXISTENCE" && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("strong", { children: "Protocolo:" }), " ", protocolLabel(detailObservation.coexistenceProtocol)] }), _jsxs("div", { children: [_jsx("strong", { children: "Falta:" }), " ", detailObservation.coexistenceOffense || "-"] })] })), !isParent && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("strong", { children: "Seguimiento:" }), " ", detailObservation.followUpDate ? String(detailObservation.followUpDate).slice(0, 10) : "-"] }), _jsxs("div", { children: [_jsx("strong", { children: "Estado seguimiento:" }), " ", formatFollowUpStatus(detailObservation.followUpCompleted)] })] })), _jsx("div", { children: _jsx("strong", { children: "Detalle:" }) }), _jsx("pre", { style: { whiteSpace: "pre-wrap", margin: 0, color: "#334155" }, children: detailObservation.detail || "-" }), _jsxs("div", { children: [_jsx("strong", { children: "Registrado por:" }), " ", detailObservation.createdBy?.fullName || "-"] })] })] }) }))] }));
}
