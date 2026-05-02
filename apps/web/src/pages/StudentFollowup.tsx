import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ActionFeedback from "../components/ActionFeedback";
import Section from "../components/Section";
import KpiCard from "../components/KpiCard";
import DataTable from "../components/DataTable";
import { apiDelete, apiDownload, apiGet, apiPatch, apiPost } from "../services/api";
import { gradeLabel } from "../services/grades";
import { useAuth } from "../context/AuthContext";
import { feedbackTitles, inferFeedbackTone } from "../utils/feedback";

type StudentOption = {
  id: string;
  fullName: string;
  gradeLevel?: string;
  studentGroup?: string | null;
  latestYear?: number | null;
};

const observationTypeOptions = [
  { value: "", label: "Todos los tipos" },
  { value: "ACADEMIC", label: "Academico" },
  { value: "COEXISTENCE", label: "Convivencia" }
];

function typeLabel(value: string) {
  if (value === "DISCIPLINARY") return "Disciplinario";
  return observationTypeOptions.find((item) => item.value === value)?.label || value;
}

export default function StudentFollowup() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<StudentOption[]>([]);
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
  const [certificateRequests, setCertificateRequests] = useState<any[]>([]);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [certificateMessage, setCertificateMessage] = useState("");
  const [associationBusy, setAssociationBusy] = useState(false);
  const [associationMessage, setAssociationMessage] = useState("");
  const [parentRefreshBusy, setParentRefreshBusy] = useState(false);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [summary, setSummary] = useState<{ total: number; academic: number; coexistence: number; pendingFollowUps: number } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [detailObservation, setDetailObservation] = useState<any>(null);

  const isParent = user?.role === "PARENT";
  const isAdmin = user?.role === "ADMIN";
  const isTeacher = user?.role === "TEACHER";
  const noTeacherStudents = isTeacher && students.length === 0;
  const shouldShowTimeline = !isParent || data.length > 0;
  const certificateTypes = [
    { type: "STUDY", kind: "study" as const, label: "Constancia de estudio" },
    { type: "ENROLLMENT", kind: "enrollment" as const, label: "Certificado de matricula" }
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
    if (isParent) return;
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

  const createObservation = async (e: React.FormEvent) => {
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

  const markFollowUpDone = async (id: string) => {
    setFollowUpMessage("");
    try {
      await apiPatch(`/student-observations/${id}`, { followUpCompleted: true });
      loadFollowUps();
      load();
    } catch (error: any) {
      setFollowUpMessage(error?.message || "No se pudo actualizar el seguimiento.");
    }
  };

  const openDetail = (row: any) => {
    setDetailObservation(row);
  };

  const downloadCertificate = async (kind: "study" | "enrollment") => {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      setCertificateMessage(error?.message || "No se pudo exportar las plantillas del observador.");
    }
  };

  const downloadConvivenciaTool = async (kind: "protocolos" | "acta" | "cartel") => {
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
    } catch (error: any) {
      setCertificateMessage(error?.message || "No se pudo descargar la herramienta de convivencia.");
    }
  };

  const requestCertificate = async (type: "STUDY" | "ENROLLMENT") => {
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
    } catch (error: any) {
      setCertificateMessage(error?.message || "No se pudo enviar la solicitud.");
    } finally {
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
      } else {
        setAssociationMessage("Solicitud enviada al area administrativa.");
      }
    } catch (error: any) {
      setAssociationMessage(error?.message || "No se pudo enviar la solicitud.");
    } finally {
      setAssociationBusy(false);
    }
  };

  const refreshParentObservations = async () => {
    if (parentRefreshBusy) return;
    setParentRefreshBusy(true);
    try {
      await Promise.all([loadStudents(), load()]);
    } finally {
      setParentRefreshBusy(false);
    }
  };

  const latestRequestFor = (type: "STUDY" | "ENROLLMENT") =>
    certificateRequests.find((r) => r.type === type);

  const protocolHint = (protocol: string) => {
    if (protocol === "TIPO_I") return "Tipo I (conflictos leves)";
    if (protocol === "TIPO_II") return "Tipo II (agresion o acoso escolar)";
    if (protocol === "TIPO_III") return "Tipo III (situaciones que pueden ser delito)";
    return "";
  };

  const protocolLabel = (protocol?: string | null) => {
    if (protocol === "TIPO_I") return "Tipo I";
    if (protocol === "TIPO_II") return "Tipo II";
    if (protocol === "TIPO_III") return "Tipo III";
    return "-";
  };

  const formatFollowUpStatus = (done?: boolean) => (done ? "Completado" : "Pendiente");

  const daysUntil = (date?: string) => {
    if (!date) return "";
    const due = new Date(date);
    if (Number.isNaN(due.getTime())) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Hoy";
    if (diff > 0) return `En ${diff} dia(s)`;
    return `Atrasado ${Math.abs(diff)} dia(s)`;
  };

  const buildConvivenciaDetail = (description: string, protocol: string, offense?: string) => {
    const templates: Record<
      string,
      { label: string; procedure: string[]; commitments: string[]; followups: string[]; citations: string[] }
    > = {
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
    const lines: string[] = [
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

  const offenseOptionsByProtocol: Record<string, string[]> = {
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

  const buildAcademicDetail = (description: string) => {
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

    const lines: string[] = [
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
    } catch (error: any) {
      setVerifyResult(null);
      setVerifyError(error?.message || "No se pudo verificar el certificado.");
    }
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      <Section title="Seguimiento estudiantil">
        <div className="help-card">
          Consulta observaciones del estudiante y gestiona certificados desde el area administrativa.
        </div>
        <div className="card">
          <label>
            Estudiante
            <select
              className="input"
              value={studentId}
              onChange={(e) => {
                const nextStudentId = e.target.value;
                setStudentId(nextStudentId);
                setFormDescription("");
                setFormDetail("");
                setConvivenciaOffense("");
                if (formType === "COEXISTENCE") {
                  const nextOffense = offenseOptionsByProtocol[convivenciaProtocol]?.[0] || "";
                  setConvivenciaOffense(nextOffense);
                  setFormDetail(buildConvivenciaDetail("", convivenciaProtocol, nextOffense));
                } else if (formType === "ACADEMIC") {
                  setFormDetail(buildAcademicDetail(""));
                }
              }}
            >
              <option value="">Selecciona</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                  {s.gradeLevel ? ` - ${gradeLabel(s.gradeLevel)}${s.studentGroup ? s.studentGroup : ""}` : ""}
                  {s.latestYear ? ` (${s.latestYear})` : ""}
                </option>
              ))}
            </select>
          </label>
          {isParent && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button className="button secondary" type="button" onClick={refreshParentObservations} disabled={parentRefreshBusy}>
                {parentRefreshBusy ? "Actualizando..." : "Actualizar observaciones"}
              </button>
            </div>
          )}
          {isParent && students.length === 0 && (
            <div style={{ color: "#64748b", marginTop: 6, display: "grid", gap: 8 }}>
              <div>
                No hay estudiantes asociados a tu cuenta. Verifica que el correo del acudiente coincida con el registrado en la matrícula.
                {user?.email ? ` Correo actual: ${user.email}.` : ""}
              </div>
              <div>
                <button className="button secondary" type="button" onClick={requestAssociation} disabled={associationBusy}>
                  {associationBusy ? "Enviando solicitud..." : "Solicitar asociación"}
                </button>
              </div>
              <ActionFeedback
                tone={inferFeedbackTone(associationMessage)}
                title={feedbackTitles.studentFollowup.association}
                message={associationMessage}
                onDismiss={() => setAssociationMessage("")}
                style={{ marginBottom: 0 }}
              />
            </div>
          )}
        </div>
        <ActionFeedback
          tone={inferFeedbackTone(certificateMessage)}
          title={feedbackTitles.studentFollowup.certificates}
          message={certificateMessage}
          onDismiss={() => setCertificateMessage("")}
          style={{ marginTop: 8 }}
        />
        {studentId && (
          <div className="grid grid-4" style={{ marginTop: 10 }}>
            <KpiCard title="Observaciones" value={summaryLoading ? "..." : String(summary?.total || 0)} trend="Total" tone="primary" />
            <KpiCard title="Academico" value={summaryLoading ? "..." : String(summary?.academic || 0)} trend="Tipo academico" tone="success" />
            <KpiCard title="Convivencia" value={summaryLoading ? "..." : String(summary?.coexistence || 0)} trend="Tipo convivencia" tone="warning" />
            <KpiCard title="Seguimientos" value={summaryLoading ? "..." : String(summary?.pendingFollowUps || 0)} trend="Pendientes" tone="danger" />
          </div>
        )}
        {isAdmin ? (
          <>
            <div className="card" style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="button secondary" type="button" onClick={() => downloadCertificate("study")}>
                  Constancia de estudio (PDF)
                </button>
                <button className="button secondary" type="button" onClick={() => downloadCertificate("enrollment")}>
                  Certificado de matricula (PDF)
                </button>
                <button className="button secondary" type="button" onClick={downloadObserverFormat}>
                  Exportar observador (PDF)
                </button>
                <button className="button secondary" type="button" onClick={downloadObserverTemplates}>
                  Plantillas observador (PDF)
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
              <ActionFeedback
                tone="error"
                title={feedbackTitles.studentFollowup.verifyError}
                message={verifyError}
                onDismiss={() => setVerifyError("")}
                style={{ marginTop: 8 }}
              />
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
          </>
        ) : isParent ? (
          <div className="card" style={{ marginTop: 10 }}>
            <div className="section-title">Solicitudes de certificados</div>
            <div style={{ color: "#475569", marginBottom: 8 }}>
              La descarga solo estara disponible despues de la aprobacion administrativa.
            </div>
            {certificateLoading ? (
              <div style={{ color: "#64748b" }}>Cargando solicitudes...</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {certificateTypes.map((item) => {
                  const latest = latestRequestFor(item.type);
                  const status = latest?.status || "NONE";
                  const statusLabel =
                    status === "APPROVED"
                      ? "Aprobado"
                      : status === "PENDING"
                      ? "En revision"
                      : status === "REJECTED"
                      ? "Rechazado"
                      : "Sin solicitud";
                  return (
                    <div key={item.type} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ minWidth: 180 }}>{item.label}</strong>
                      <span style={{ color: status === "APPROVED" ? "#166534" : status === "REJECTED" ? "#b91c1c" : "#475569" }}>
                        {statusLabel}
                      </span>
                      {status === "APPROVED" ? (
                        <button className="button secondary" type="button" onClick={() => downloadCertificate(item.kind)}>
                          Descargar PDF
                        </button>
                      ) : (
                        <button
                          className="button secondary"
                          type="button"
                          disabled={certificateLoading || status === "PENDING"}
                          onClick={() => requestCertificate(item.type)}
                        >
                          {status === "REJECTED" ? "Reenviar solicitud" : status === "PENDING" ? "En revision" : "Solicitar autorizacion"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </Section>

      {!isParent && (
        <Section title="Observador del estudiante">
          <div className="card">
            <div className="section-title">Ruta Integral para la Convivencia Escolar</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="button secondary" type="button" onClick={() => downloadConvivenciaTool("protocolos")}>
                Protocolos Tipo I-II-III (PDF)
              </button>
              <button className="button secondary" type="button" onClick={() => downloadConvivenciaTool("acta")}>
                Acta Comite de Convivencia (PDF)
              </button>
              <button className="button secondary" type="button" onClick={() => downloadConvivenciaTool("cartel")}>
                Cartel Ruta de Convivencia (PDF)
              </button>
            </div>
          </div>
          {noTeacherStudents ? (
            <div className="card" style={{ color: "#64748b" }}>
              No tienes grados o grupos asignados para registrar observaciones. Contacta al administrador para asignarte horarios/grade-group.
            </div>
          ) : (
            <form className="card" onSubmit={createObservation}>
              <label>
                Tipo de observacion
                <select
                  className="input"
                  value={formType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setFormType(nextType);
                    setFormDescription("");
                    setConvivenciaOffense("");
                    if (nextType === "COEXISTENCE") {
                      const nextOffense = offenseOptionsByProtocol[convivenciaProtocol]?.[0] || "";
                      setConvivenciaOffense(nextOffense);
                      setFormDetail(buildConvivenciaDetail("", convivenciaProtocol, nextOffense));
                    } else if (nextType === "ACADEMIC") {
                      setFormDetail(buildAcademicDetail(""));
                    } else {
                      setFormDetail("");
                    }
                  }}
                >
                  {observationTypeOptions
                    .filter((o) => o.value)
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                </select>
              </label>
              {formType === "COEXISTENCE" && (
                <>
                  <label>
                    Protocolo sugerido (Ruta de Convivencia)
                    <select
                      className="input"
                      value={convivenciaProtocol}
                      onChange={(e) => {
                        const nextProtocol = e.target.value;
                        setConvivenciaProtocol(nextProtocol);
                        const nextOffense = offenseOptionsByProtocol[nextProtocol]?.[0] || "";
                        setConvivenciaOffense(nextOffense);
                        setFormDetail(buildConvivenciaDetail(formDescription.trim(), nextProtocol, nextOffense));
                      }}
                    >
                      <option value="TIPO_I">Tipo I (conflictos leves)</option>
                      <option value="TIPO_II">Tipo II (agresion o acoso escolar)</option>
                      <option value="TIPO_III">Tipo III (situaciones que pueden ser delito)</option>
                    </select>
                  </label>
                  <label>
                    Falta reportada
                    <select
                      className="input"
                      value={convivenciaOffense}
                      onChange={(e) => {
                        const nextOffense = e.target.value;
                        setConvivenciaOffense(nextOffense);
                        setFormDetail(buildConvivenciaDetail(formDescription.trim(), convivenciaProtocol, nextOffense));
                      }}
                    >
                      <option value="">Selecciona la falta</option>
                      {offenseOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div style={{ color: "#64748b", marginTop: -6 }}>
                    {protocolHint(convivenciaProtocol)}
                  </div>
                </>
              )}
              <label>
                Fecha (opcional)
                <input type="date" className="input" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </label>
              <label>
                Fecha de seguimiento (opcional)
                <input type="date" className="input" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
              </label>
              <div style={{ color: "#64748b", marginTop: -6 }}>
                Si agregas una fecha, aparecera en "Seguimientos pendientes".
              </div>
              {formType === "COEXISTENCE" || formType === "ACADEMIC" ? (
                <>
                  <label>
                    {formType === "ACADEMIC" ? "Descripcion academica" : "Descripcion de la situacion"}
                    <textarea
                      className="input"
                      rows={3}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                    />
                  </label>
                  <label>
                    Detalle automatico (editable)
                    <textarea className="input" rows={8} value={formDetail} onChange={(e) => setFormDetail(e.target.value)} />
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        const description = formDescription.trim();
                        setFormDetail(
                          formType === "COEXISTENCE"
                            ? buildConvivenciaDetail(description, convivenciaProtocol, convivenciaOffense)
                            : buildAcademicDetail(description)
                        );
                      }}
                    >
                      Restaurar plantilla
                    </button>
                  </div>
                </>
              ) : (
                <label>
                  Observacion
                  <textarea className="input" rows={4} value={formDetail} onChange={(e) => setFormDetail(e.target.value)} />
                </label>
              )}
              <ActionFeedback
                tone={inferFeedbackTone(message)}
                title={feedbackTitles.studentFollowup.observation}
                message={message}
                onDismiss={() => setMessage("")}
                style={{ marginTop: 8 }}
              />
              <button className="button" style={{ marginTop: 10 }} disabled={busy}>
                {busy ? "Guardando..." : "Registrar observacion"}
              </button>
            </form>
          )}
        </Section>
      )}

      {!isParent && (
        <Section title="Seguimientos pendientes">
          <div className="help-card">
            Listado automatico de seguimientos por vencer (proximos 7 dias).
          </div>
          {noTeacherStudents ? (
            <div className="card" style={{ color: "#64748b" }}>
              No tienes grados o grupos asignados para gestionar seguimientos.
            </div>
          ) : (
            <>
              <ActionFeedback
                tone={inferFeedbackTone(followUpMessage)}
                title={feedbackTitles.studentFollowup.followUps}
                message={followUpMessage}
                onDismiss={() => setFollowUpMessage("")}
              />
              <DataTable
                columns={[
                  { key: "date", label: "Seguimiento" },
                  { key: "status", label: "Estado" },
                  { key: "student", label: "Estudiante" },
                  { key: "grade", label: "Grado" },
                  { key: "type", label: "Tipo" },
                  { key: "detail", label: "Detalle" },
                  { key: "actions", label: "Acciones" }
                ]}
                rows={
                  followUpLoading
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
                        actions: (
                          <button className="button secondary" type="button" onClick={() => markFollowUpDone(row.id)}>
                            Marcar hecho
                          </button>
                        )
                      }))
                }
              />
            </>
          )}
        </Section>
      )}

      {shouldShowTimeline && (
        <Section title="Linea de tiempo">
          <div className="help-card">
            Ultimas observaciones registradas para el estudiante seleccionado.
          </div>
          <div className="card" style={{ display: "grid", gap: 10 }}>
            {data.length === 0 ? (
              <div style={{ color: "#64748b" }}>
                Selecciona un estudiante para ver la linea de tiempo.
              </div>
            ) : (
              data.slice(0, 6).map((row) => (
                <div key={row.id} style={{ display: "grid", gap: 6, padding: 10, border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <strong>{row.student?.fullName || "-"}</strong>
                    <span style={{ color: "#64748b" }}>{String(row.date || "").slice(0, 10)}</span>
                  </div>
                  <div style={{ color: "#475569" }}>
                    {typeLabel(row.type)} {row.coexistenceProtocol ? `- ${protocolLabel(row.coexistenceProtocol)}` : ""}
                  </div>
                  <div style={{ color: "#334155" }}>{row.detail || "-"}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="button secondary" type="button" onClick={() => openDetail(row)}>
                      Ver detalle
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Section>
      )}

      <Section title="Historial de observaciones">
        {!noTeacherStudents && (
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
        )}
        {noTeacherStudents ? (
          <div className="card" style={{ color: "#64748b" }}>
            No tienes grados o grupos asignados para consultar historial de observaciones.
          </div>
        ) : (
          <DataTable
            columns={[
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
            ]}
            rows={
              loading
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
                    view: (
                      <button className="button secondary" type="button" onClick={() => openDetail(row)}>
                        Ver
                      </button>
                    ),
                    author: row.createdBy?.fullName || "-",
                    ...(isAdmin
                      ? {
                          actions: (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="button secondary" type="button" onClick={() => openDetail(row)}>
                                Ver
                              </button>
                              <button className="button danger" type="button" onClick={() => deleteObservation(row.id)}>
                                Eliminar
                              </button>
                            </div>
                          )
                        }
                      : {})
                  }))
            }
          />
        )}
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
      {detailObservation && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 16
          }}
          onClick={() => setDetailObservation(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 720, width: "100%", maxHeight: "80vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div className="section-title">Detalle de observacion</div>
              <button className="button secondary" onClick={() => setDetailObservation(null)}>Cerrar</button>
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              <div><strong>Estudiante:</strong> {detailObservation.student?.fullName || "-"}</div>
              <div><strong>Fecha:</strong> {String(detailObservation.date || "").slice(0, 10)}</div>
              <div><strong>Tipo:</strong> {typeLabel(detailObservation.type)}</div>
              {detailObservation.type === "COEXISTENCE" && (
                <>
                  <div><strong>Protocolo:</strong> {protocolLabel(detailObservation.coexistenceProtocol)}</div>
                  <div><strong>Falta:</strong> {detailObservation.coexistenceOffense || "-"}</div>
                </>
              )}
              {!isParent && (
                <>
                  <div><strong>Seguimiento:</strong> {detailObservation.followUpDate ? String(detailObservation.followUpDate).slice(0, 10) : "-"}</div>
                  <div><strong>Estado seguimiento:</strong> {formatFollowUpStatus(detailObservation.followUpCompleted)}</div>
                </>
              )}
              <div><strong>Detalle:</strong></div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, color: "#334155" }}>{detailObservation.detail || "-"}</pre>
              <div><strong>Registrado por:</strong> {detailObservation.createdBy?.fullName || "-"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
