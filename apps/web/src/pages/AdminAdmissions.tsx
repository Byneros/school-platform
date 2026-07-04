import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ActionFeedback from "../components/ActionFeedback";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import Autocomplete from "../components/Autocomplete";
import { apiDelete, apiDownload, apiGet, apiPatch, apiPost } from "../services/api";
import { gradeLabel, gradeOptions } from "../services/grades";
import useDebounce from "../hooks/useDebounce";
import useSuggestions from "../hooks/useSuggestions";
import { feedbackTitles } from "../utils/feedback";

function getClassGradeLevel(classData: any) {
  return String(classData?.gradeLevel || "").trim();
}

const guardianDocTypeOptions = [
  { value: "CEDULA", label: "Cedula" },
  { value: "CEDULA_EXTRANJERIA", label: "Cedula de extranjeria" },
  { value: "PASAPORTE", label: "Pasaporte" }
];

const guardianRelationOptions = [
  { value: "PADRE", label: "Padre" },
  { value: "MADRE", label: "Madre" },
  { value: "ABUELO", label: "Abuelo" },
  { value: "ABUELA", label: "Abuela" },
  { value: "TIO", label: "Tio" },
  { value: "TIA", label: "Tia" },
  { value: "HERMANO", label: "Hermano" },
  { value: "HERMANA", label: "Hermana" },
  { value: "ACUDIENTE_LEGAL", label: "Acudiente legal" }
];

function normalizeGuardianRelation(value: string) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (normalized === "ACUDIENTE") return "ACUDIENTE_LEGAL";
  return guardianRelationOptions.some((item) => item.value === normalized) ? normalized : "";
}

function normalizeGuardianDocType(value: string) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return guardianDocTypeOptions.some((item) => item.value === normalized) ? normalized : "";
}

export default function AdminAdmissions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [admissions, setAdmissions] = useState<
    Array<{
      id: string;
      studentName: string;
      gradeLevel: string;
      status: string;
      createdAt?: string;
      notes?: string | null;
      enrollmentDueAt?: string | null;
      documents?: {
        studentIdentity?: boolean;
        parentsIds?: boolean;
        recentReportCards?: boolean;
        previousSchoolCertificates?: boolean;
        addressProof?: boolean;
        vaccinationCard?: boolean;
      } | null;
    }>
  >([]);
  const [classes, setClasses] = useState<Array<any>>([]);
  const [approvedAdmissions, setApprovedAdmissions] = useState<Array<any>>([]);
  const [enrollments, setEnrollments] = useState<Array<any>>([]);
  const [enrollmentsPage, setEnrollmentsPage] = useState(1);
  const [enrollmentsTotal, setEnrollmentsTotal] = useState(0);
  const [enrollmentsSearch, setEnrollmentsSearch] = useState("");
  const debouncedEnrollmentsSearch = useDebounce(enrollmentsSearch, 350);
  const [savedFilters, setSavedFilters] = useState<Array<{ id: string; name: string; statusFilter: string; gradeFilter: string; search: string }>>([]);
  const [filterName, setFilterName] = useState("");
  const [selectedFilterId, setSelectedFilterId] = useState("");
  const initialPage = Number(searchParams.get("page") || "1");
  const initialStatus = searchParams.get("status") || "";
  const initialGrade = searchParams.get("grade") || "";
  const initialSearch = searchParams.get("search") || "";

  const [page, setPage] = useState(Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [gradeFilter, setGradeFilter] = useState(initialGrade);
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 350);
  const [admissionMessage, setAdmissionMessage] = useState("");
  const [admissionError, setAdmissionError] = useState("");
  const [form, setForm] = useState({
    studentName: "",
    gradeLevel: "PRE_JARDIN",
    notes: "",
    documents: {
      studentIdentity: false,
      parentsIds: false,
      recentReportCards: false,
      previousSchoolCertificates: false,
      addressProof: false,
      vaccinationCard: false
    }
  });
  const [enrollmentBusy, setEnrollmentBusy] = useState(false);
  const [enrollmentMessage, setEnrollmentMessage] = useState("");
  const [enrollmentError, setEnrollmentError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingBusy, setEditingBusy] = useState(false);
  const [editingError, setEditingError] = useState("");
  const [editingMessage, setEditingMessage] = useState("");
  const [editingForm, setEditingForm] = useState({
    studentName: "",
    gradeLevel: "PRE_JARDIN",
    notes: "",
    documents: {
      studentIdentity: false,
      parentsIds: false,
      recentReportCards: false,
      previousSchoolCertificates: false,
      addressProof: false,
      vaccinationCard: false
    }
  });
  const [enrollmentForm, setEnrollmentForm] = useState({
    admissionId: "",
    classId: "",
    year: "2026",
    status: "ACTIVE",
    studentFullName: "",
    studentBirthDate: "",
    studentBirthPlaceDept: "",
    studentBirthPlaceCity: "",
    studentGender: "",
    studentDocType: "",
    studentDocNumber: "",
    studentGradeLevel: "PRE_JARDIN",
    studentAddress: "",
    guardianFullName: "",
    guardianDocType: "",
    guardianDocNumber: "",
    guardianRelation: "",
    contactPhone: "",
    contactEmail: "",
    documents: {
      civilRegistry: false,
      guardianId: false,
      residenceProof: false,
      healthCertificate: false,
      vaccinationCard: false,
      previousReport: false
    },
    documentsNotes: ""
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loadError, setLoadError] = useState("");
  const [enrollmentsError, setEnrollmentsError] = useState("");
  const [editingEnrollmentId, setEditingEnrollmentId] = useState("");
  const [editingEnrollmentBusy, setEditingEnrollmentBusy] = useState(false);
  const [editingEnrollmentError, setEditingEnrollmentError] = useState("");
  const [editingEnrollmentMessage, setEditingEnrollmentMessage] = useState("");
  const [removeEnrollmentMessage, setRemoveEnrollmentMessage] = useState("");
  const [removeEnrollmentError, setRemoveEnrollmentError] = useState("");
  const [selectedEnrollment, setSelectedEnrollment] = useState<any | null>(null);
  const [admissionStatusMessage, setAdmissionStatusMessage] = useState("");
  const [admissionStatusError, setAdmissionStatusError] = useState("");
  const [editingEnrollmentForm, setEditingEnrollmentForm] = useState({
    studentFullName: "",
    studentBirthDate: "",
    studentBirthPlaceDept: "",
    studentBirthPlaceCity: "",
    studentGender: "",
    studentDocType: "",
    studentDocNumber: "",
    studentGradeLevel: "PRE_JARDIN",
    classId: "",
    year: "2026",
    status: "ACTIVE",
    studentAddress: "",
    guardianFullName: "",
    guardianDocType: "",
    guardianDocNumber: "",
    guardianRelation: "",
    contactPhone: "",
    contactEmail: "",
    documents: {
      civilRegistry: false,
      guardianId: false,
      residenceProof: false,
      healthCertificate: false,
      vaccinationCard: false,
      previousReport: false
    },
    documentsNotes: ""
  });
  const editPanelRef = useRef<HTMLFormElement | null>(null);
  const editNameInputRef = useRef<HTMLInputElement | null>(null);
  const editEnrollmentPanelRef = useRef<HTMLFormElement | null>(null);
  const editEnrollmentNameInputRef = useRef<HTMLInputElement | null>(null);
  const admissionsSearchOptions = useSuggestions({
    endpoint: "/suggestions?type=admissions",
    query: search
  });

  const enrollmentsSearchOptions = useSuggestions({
    endpoint: "/suggestions?type=enrollments",
    query: enrollmentsSearch
  });
  const enrollmentFeedback = (() => {
    if (enrollmentMessage) {
      return {
        title: "Matricula satisfactoria",
        text: enrollmentMessage,
        tone: "success" as const
      };
    }
    if (!enrollmentError) return null;
    const errorText = enrollmentError.toLowerCase();
    if (errorText.includes("ya esta matriculado") || errorText.includes("ya tiene una matricula")) {
      return {
        title: "Estudiante ya registrado",
        text: enrollmentError,
        tone: "warning" as const
      };
    }
    if (
      errorText.includes("validation") ||
      errorText.includes("required") ||
      errorText.includes("invalid") ||
      errorText.includes("body.")
    ) {
      return {
        title: "Error de validacion de matricula",
        text: enrollmentError,
        tone: "info" as const
      };
    }
    return {
      title: "Error de matricula",
      text: enrollmentError,
      tone: "error" as const
    };
  })();
  const missingImportantEnrollmentFields = (() => {
    const required: Array<{ key: keyof typeof enrollmentForm; label: string }> = [
      { key: "admissionId", label: "Admision aprobada" },
      { key: "studentFullName", label: "Nombre del estudiante" },
      { key: "studentBirthDate", label: "Fecha de nacimiento" },
      { key: "studentDocType", label: "Tipo de documento del estudiante" },
      { key: "studentDocNumber", label: "Numero de documento del estudiante" },
      { key: "studentGradeLevel", label: "Nivel/Grado" },
      { key: "guardianFullName", label: "Nombre del acudiente" },
      { key: "guardianDocType", label: "Tipo de documento del acudiente" },
      { key: "guardianDocNumber", label: "Documento del acudiente" },
      { key: "guardianRelation", label: "Parentesco del acudiente" },
      { key: "contactPhone", label: "Telefono de contacto" }
    ];
    return required
      .filter((f) => !String(enrollmentForm[f.key] ?? "").trim())
      .map((f) => f.label);
  })();

  useEffect(() => {
    const next = new URLSearchParams();
    if (page > 1) next.set("page", String(page));
    if (statusFilter) next.set("status", statusFilter);
    if (gradeFilter) next.set("grade", gradeFilter);
    if (search) next.set("search", search);
    setSearchParams(next, { replace: true });
  }, [page, statusFilter, gradeFilter, search, setSearchParams]);

  useEffect(() => {
    const raw = localStorage.getItem("admin_admissions_filters");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedFilters(parsed);
      }
    } catch {
      setSavedFilters([]);
    }
  }, []);

  const persistFilters = (next: Array<{ id: string; name: string; statusFilter: string; gradeFilter: string; search: string }>) => {
    setSavedFilters(next);
    localStorage.setItem("admin_admissions_filters", JSON.stringify(next));
  };

  const saveCurrentFilter = () => {
    const trimmed = filterName.trim();
    const name = trimmed || `Filtro ${new Date().toLocaleDateString("es-CO")} ${new Date().toLocaleTimeString("es-CO")}`;
    const id = trimmed ? trimmed.toLowerCase().replace(/\s+/g, "-") : `f-${Date.now()}`;
    const next = savedFilters.filter((f) => f.id !== id);
    const updated = [
      { id, name, statusFilter, gradeFilter, search },
      ...next
    ];
    persistFilters(updated.slice(0, 10));
    setSelectedFilterId(id);
    setFilterName("");
  };

  const applySavedFilter = (id: string) => {
    setSelectedFilterId(id);
    const selected = savedFilters.find((f) => f.id === id);
    if (!selected) return;
    setStatusFilter(selected.statusFilter);
    setGradeFilter(selected.gradeFilter);
    setSearch(selected.search);
    setPage(1);
  };

  const deleteSavedFilter = () => {
    if (!selectedFilterId) return;
    const next = savedFilters.filter((f) => f.id !== selectedFilterId);
    persistFilters(next);
    setSelectedFilterId("");
  };

  const load = () =>
    apiGet(
      `/admissions?page=${page}&pageSize=10${statusFilter ? `&status=${statusFilter}` : ""}${gradeFilter ? `&gradeLevel=${gradeFilter}` : ""}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`
    )
      .then((res) => {
        setLoadError("");
        setAdmissions(res.data || []);
        setTotal(res.total || 0);
      })
      .catch((error: any) => {
        setLoadError(error?.message || "No se pudieron cargar las admisiones.");
      });

  const loadApprovedAdmissions = () =>
    apiGet("/admissions/approved")
      .then((res) => setApprovedAdmissions(res))
      .catch(() => undefined);

  const loadEnrollments = () =>
    apiGet(`/enrollments?page=${enrollmentsPage}&pageSize=10${debouncedEnrollmentsSearch ? `&search=${encodeURIComponent(debouncedEnrollmentsSearch)}` : ""}`)
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setEnrollmentsError("");
        setEnrollments(list);
        setSelectedEnrollment((current) => (current ? list.find((item: any) => item.id === current.id) || current : null));
        setEnrollmentsTotal(Array.isArray(res) ? list.length : Number(res?.total || 0));
      })
      .catch((error: any) => {
        setEnrollmentsError(error?.message || "No se pudieron cargar las matriculas.");
      });

  useEffect(() => {
    load();
  }, [page, statusFilter, gradeFilter, debouncedSearch]);

  useEffect(() => {
    apiGet("/classes/simple").then((res) => setClasses(res)).catch(() => undefined);
    loadApprovedAdmissions();
  }, []);

  useEffect(() => {
    loadEnrollments();
  }, [enrollmentsPage, debouncedEnrollmentsSearch]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!editingId) return;
    requestAnimationFrame(() => {
      editPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      editNameInputRef.current?.focus();
    });
  }, [editingId]);

  useEffect(() => {
    if (!editingEnrollmentId) return;
    requestAnimationFrame(() => {
      editEnrollmentPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      editEnrollmentNameInputRef.current?.focus();
    });
  }, [editingEnrollmentId]);

  const getRemainingDays = (dueAt?: string | null) => {
    if (!dueAt) return null;
    const dueDate = new Date(dueAt);
    const today = new Date(nowMs);
    today.setHours(0, 0, 0, 0);
    return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const addBusinessDays = (startDate: Date, days: number) => {
    const result = new Date(startDate);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) added += 1;
    }
    return result;
  };

  const getApprovalDueDate = (createdAt?: string) => {
    if (!createdAt) return null;
    return addBusinessDays(new Date(createdAt), 5);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdmissionMessage("");
    setAdmissionError("");
    try {
      const admission = await apiPost("/admissions", {
        studentName: form.studentName,
        gradeLevel: form.gradeLevel,
        notes: form.notes?.trim() || "",
        documents: form.documents
      });
      setAdmissions([admission, ...admissions]);
      setForm({
        studentName: "",
        gradeLevel: "PRE_JARDIN",
        notes: "",
        documents: {
          studentIdentity: false,
          parentsIds: false,
          recentReportCards: false,
          previousSchoolCertificates: false,
          addressProof: false,
          vaccinationCard: false
        }
      });
      setAdmissionMessage("Nueva admision creada satisfactoriamente.");
    } catch (error: any) {
      setAdmissionError(error?.message || "No fue posible crear la admision.");
    }
  };

  const admissionFeedback = (() => {
    if (admissionMessage) {
      return {
        title: "Admision creada",
        text: admissionMessage,
        tone: "success" as const
      };
    }
    if (!admissionError) return null;
    return {
      title: "Error al crear admision",
      text: admissionError,
      tone: "error" as const
    };
  })();

  const setStatus = async (id: string, status: string) => {
    try {
      setAdmissionStatusMessage("");
      setAdmissionStatusError("");
      setLoadError("");
      if (status === "REJECTED") {
        await apiDelete(`/admissions/${id}`);
        setAdmissions((prev) => prev.filter((a) => a.id !== id));
        setAdmissionStatusMessage("Admision rechazada satisfactoriamente.");
        return;
      }
      const updated = await apiPatch(`/admissions/${id}/status`, { status });
      if (status === "APPROVED") {
        setAdmissions((prev) => prev.filter((a) => a.id !== id));
        setApprovedAdmissions((prev) => {
          const without = prev.filter((a) => a.id !== updated.id);
          return [updated, ...without];
        });
      } else {
        setAdmissions((prev) => prev.map((a) => (a.id === id ? updated : a)));
      }
      setAdmissionStatusMessage(
        status === "APPROVED"
          ? "Admision aprobada satisfactoriamente."
          : "Estado de admision actualizado satisfactoriamente."
      );
      loadApprovedAdmissions();
    } catch (error: any) {
      const message = error?.message || "No se pudo actualizar el estado de la admision.";
      setAdmissionStatusError(message);
      setLoadError(message);
    }
  };

  const startEdit = (admission: {
    id: string;
    studentName: string;
    gradeLevel: string;
    notes?: string | null;
    documents?: {
      studentIdentity?: boolean;
      parentsIds?: boolean;
      recentReportCards?: boolean;
      previousSchoolCertificates?: boolean;
      addressProof?: boolean;
      vaccinationCard?: boolean;
    } | null;
  }) => {
    setEditingError("");
    setEditingMessage("");
    setEditingId(admission.id);
    setEditingForm({
      studentName: admission.studentName,
      gradeLevel: admission.gradeLevel,
      notes: admission.notes || "",
      documents: {
        studentIdentity: Boolean(admission.documents?.studentIdentity),
        parentsIds: Boolean(admission.documents?.parentsIds),
        recentReportCards: Boolean(admission.documents?.recentReportCards),
        previousSchoolCertificates: Boolean(admission.documents?.previousSchoolCertificates),
        addressProof: Boolean(admission.documents?.addressProof),
        vaccinationCard: Boolean(admission.documents?.vaccinationCard)
      }
    });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setEditingBusy(true);
    setEditingError("");
    setEditingMessage("");
    try {
      const updated = await apiPatch(`/admissions/${editingId}`, {
        studentName: editingForm.studentName,
        gradeLevel: editingForm.gradeLevel,
        notes: editingForm.notes,
        documents: editingForm.documents
      });
      setAdmissions((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
      setEditingMessage("Admision actualizada satisfactoriamente.");
    } catch (error: any) {
      setEditingError(error?.message || "No se pudo actualizar la admision");
    } finally {
      setEditingBusy(false);
    }
  };

  const createEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missingImportantEnrollmentFields.length > 0) {
      setEnrollmentError(`Completa los datos obligatorios para matricular: ${missingImportantEnrollmentFields.join(", ")}`);
      setEnrollmentMessage("");
      return;
    }
    setEnrollmentBusy(true);
    setEnrollmentError("");
    setEnrollmentMessage("");
    try {
      const classIdFromGrade = classes.find(
        (c) => getClassGradeLevel(c) === String(enrollmentForm.studentGradeLevel || "")
      )?.id;
      const classIdToUse = classIdFromGrade || enrollmentForm.classId;
      if (!classIdToUse) {
        setEnrollmentError("No hay una clase configurada para el grado seleccionado.");
        setEnrollmentBusy(false);
        return;
      }
      await apiPost("/enrollments", {
        classId: classIdToUse,
        year: Number(enrollmentForm.year),
        status: enrollmentForm.status,
        admissionId: enrollmentForm.admissionId || undefined,
        studentFullName: enrollmentForm.studentFullName,
        studentBirthDate: enrollmentForm.studentBirthDate,
        studentBirthPlaceDept: enrollmentForm.studentBirthPlaceDept,
        studentBirthPlaceCity: enrollmentForm.studentBirthPlaceCity,
        studentGender: enrollmentForm.studentGender,
        studentDocType: enrollmentForm.studentDocType,
        studentDocNumber: enrollmentForm.studentDocNumber,
        studentGradeLevel: enrollmentForm.studentGradeLevel,
        studentAddress: enrollmentForm.studentAddress,
        guardianFullName: enrollmentForm.guardianFullName,
        guardianDocType: enrollmentForm.guardianDocType,
        guardianDocNumber: enrollmentForm.guardianDocNumber,
        guardianRelation: enrollmentForm.guardianRelation,
        contactPhone: enrollmentForm.contactPhone,
        contactEmail: enrollmentForm.contactEmail || undefined,
        documents: enrollmentForm.documents,
        documentsNotes: enrollmentForm.documentsNotes
      });
      setEnrollmentMessage("Matricula registrada correctamente");
      if (enrollmentForm.admissionId) {
        setAdmissions((prev) => prev.filter((a) => a.id !== enrollmentForm.admissionId));
      }
      setEnrollmentForm({
        admissionId: "",
        classId: "",
        year: "2026",
        status: "ACTIVE",
        studentFullName: "",
        studentBirthDate: "",
        studentBirthPlaceDept: "",
        studentBirthPlaceCity: "",
        studentGender: "",
        studentDocType: "",
        studentDocNumber: "",
        studentGradeLevel: "PRE_JARDIN",
        studentAddress: "",
        guardianFullName: "",
        guardianDocType: "",
        guardianDocNumber: "",
        guardianRelation: "",
        contactPhone: "",
        contactEmail: "",
        documents: {
          civilRegistry: false,
          guardianId: false,
          residenceProof: false,
          healthCertificate: false,
          vaccinationCard: false,
          previousReport: false
        },
        documentsNotes: ""
      });
      load();
      loadApprovedAdmissions();
      loadEnrollments();
    } catch (error: any) {
      setEnrollmentError(error?.message || "No fue posible registrar la matricula");
    } finally {
      setEnrollmentBusy(false);
    }
  };

  const applyApprovedAdmission = (adm: any) => {
    if (!adm) return;
    setEnrollmentForm((prev) => ({
      ...prev,
      admissionId: adm.id || "",
      studentFullName: adm.studentFullName || adm.studentName || "",
      studentBirthDate: adm.studentBirthDate ? String(adm.studentBirthDate).slice(0, 10) : "",
      studentBirthPlaceDept: adm.studentBirthPlaceDept || "",
      studentBirthPlaceCity: adm.studentBirthPlaceCity || "",
      studentGender: adm.studentGender || "",
      studentDocType: adm.studentDocType || "",
      studentDocNumber: adm.studentDocNumber || "",
      studentGradeLevel: adm.gradeLevel || prev.studentGradeLevel,
      studentAddress: adm.studentAddress || "",
      guardianFullName: adm.guardianFullName || "",
      guardianDocType: normalizeGuardianDocType(adm.guardianDocType || ""),
      guardianDocNumber: adm.guardianDocNumber || "",
      guardianRelation: normalizeGuardianRelation(adm.guardianRelation || ""),
      contactPhone: adm.contactPhone || "",
      contactEmail: adm.contactEmail || "",
      documents: {
        civilRegistry: Boolean(adm.documents?.studentIdentity),
        guardianId: Boolean(adm.documents?.parentsIds),
        residenceProof: Boolean(adm.documents?.addressProof),
        healthCertificate: false,
        vaccinationCard: Boolean(adm.documents?.vaccinationCard),
        previousReport: Boolean(adm.documents?.recentReportCards || adm.documents?.previousSchoolCertificates)
      }
    }));
  };

  const startEditEnrollment = (enrollment: any) => {
    setEditingEnrollmentError("");
    setEditingEnrollmentMessage("");
    setSelectedEnrollment(enrollment);
    setEditingEnrollmentId(enrollment.id);
    setEditingEnrollmentForm({
      studentFullName: enrollment.studentFullName || "",
      studentBirthDate: enrollment.studentBirthDate ? String(enrollment.studentBirthDate).slice(0, 10) : "",
      studentBirthPlaceDept: enrollment.studentBirthPlaceDept || "",
      studentBirthPlaceCity: enrollment.studentBirthPlaceCity || "",
      studentGender: enrollment.studentGender || "",
      studentDocType: enrollment.studentDocType || "",
      studentDocNumber: enrollment.studentDocNumber || "",
      studentGradeLevel: enrollment.studentGradeLevel || "PRE_JARDIN",
      classId: enrollment.classId || "",
      year: String(enrollment.year || new Date().getFullYear()),
      status: enrollment.status || "ACTIVE",
      studentAddress: enrollment.studentAddress || "",
      guardianFullName: enrollment.guardianFullName || "",
      guardianDocType: normalizeGuardianDocType(enrollment.guardianDocType || ""),
      guardianDocNumber: enrollment.guardianDocNumber || "",
      guardianRelation: normalizeGuardianRelation(enrollment.guardianRelation || ""),
      contactPhone: enrollment.contactPhone || "",
      contactEmail: enrollment.contactEmail || "",
      documents: {
        civilRegistry: Boolean(enrollment.documents?.civilRegistry),
        guardianId: Boolean(enrollment.documents?.guardianId),
        residenceProof: Boolean(enrollment.documents?.residenceProof),
        healthCertificate: Boolean(enrollment.documents?.healthCertificate),
        vaccinationCard: Boolean(enrollment.documents?.vaccinationCard),
        previousReport: Boolean(enrollment.documents?.previousReport)
      },
      documentsNotes: enrollment.documentsNotes || ""
    });
  };

  const saveEnrollmentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEnrollmentId) return;
    setEditingEnrollmentBusy(true);
    setEditingEnrollmentError("");
    setEditingEnrollmentMessage("");
    try {
      const updated = await apiPatch(`/enrollments/${editingEnrollmentId}`, {
        studentFullName: editingEnrollmentForm.studentFullName,
        studentBirthDate: editingEnrollmentForm.studentBirthDate || undefined,
        studentBirthPlaceDept: editingEnrollmentForm.studentBirthPlaceDept,
        studentBirthPlaceCity: editingEnrollmentForm.studentBirthPlaceCity,
        studentGender: editingEnrollmentForm.studentGender,
        studentDocType: editingEnrollmentForm.studentDocType,
        studentDocNumber: editingEnrollmentForm.studentDocNumber,
        studentGradeLevel: editingEnrollmentForm.studentGradeLevel,
        classId: editingEnrollmentForm.classId,
        year: Number(editingEnrollmentForm.year),
        status: editingEnrollmentForm.status,
        studentAddress: editingEnrollmentForm.studentAddress,
        guardianFullName: editingEnrollmentForm.guardianFullName,
        guardianDocType: editingEnrollmentForm.guardianDocType,
        guardianDocNumber: editingEnrollmentForm.guardianDocNumber,
        guardianRelation: editingEnrollmentForm.guardianRelation,
        contactPhone: editingEnrollmentForm.contactPhone,
        contactEmail: editingEnrollmentForm.contactEmail || undefined,
        documents: editingEnrollmentForm.documents,
        documentsNotes: editingEnrollmentForm.documentsNotes
      });
      setEnrollments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedEnrollment(updated);
      loadEnrollments();
      setEditingEnrollmentMessage("Matricula actualizada satisfactoriamente.");
    } catch (error: any) {
      setEditingEnrollmentError(error?.message || "No fue posible actualizar la matricula");
    } finally {
      setEditingEnrollmentBusy(false);
    }
  };

  const removeEnrollment = async (id: string) => {
    if (!window.confirm("Seguro que deseas eliminar esta matricula?")) return;
    setRemoveEnrollmentMessage("");
    setRemoveEnrollmentError("");
    try {
      await apiDelete(`/enrollments/${id}`);
      if (editingEnrollmentId === id) {
        setEditingEnrollmentId("");
        setEditingEnrollmentMessage("");
        setEditingEnrollmentError("");
      }
      if (selectedEnrollment?.id === id) {
        setSelectedEnrollment(null);
      }
      setRemoveEnrollmentMessage("Matricula eliminada satisfactoriamente.");
      loadEnrollments();
      loadApprovedAdmissions();
    } catch (error: any) {
      setRemoveEnrollmentError(error?.message || "No fue posible eliminar la matricula");
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
    <Section title="Admisiones">
      <div className="help-card">
        Revisa y aprueba las admisiones pendientes.
        <div style={{ marginTop: 6 }}>
          Fecha y hora del equipo: <strong>{new Date(nowMs).toLocaleString("es-CO")}</strong>
        </div>
      </div>
      <ActionFeedback
        tone="success"
        title={feedbackTitles.admissions.statusSuccess}
        message={admissionStatusMessage}
        onDismiss={() => setAdmissionStatusMessage("")}
      />
      <ActionFeedback
        tone="error"
        title={feedbackTitles.admissions.statusError}
        message={admissionStatusError}
        onDismiss={() => setAdmissionStatusError("")}
      />
      <ActionFeedback
        tone="success"
        title={feedbackTitles.admissions.deleteEnrollmentSuccess}
        message={removeEnrollmentMessage}
        onDismiss={() => setRemoveEnrollmentMessage("")}
      />
      <ActionFeedback
        tone="error"
        title={feedbackTitles.admissions.deleteEnrollmentError}
        message={removeEnrollmentError}
        onDismiss={() => setRemoveEnrollmentError("")}
      />
      <ActionFeedback
        tone={admissionFeedback?.tone || "info"}
        title={admissionFeedback?.title}
        message={admissionFeedback?.text || ""}
        onDismiss={() => {
          setAdmissionMessage("");
          setAdmissionError("");
        }}
      />
      <form className="card" onSubmit={create}>
        <div className="section-title">Nueva admision</div>
        <label>
          Nombre del estudiante
          <input
            className="input"
            autoComplete="name"
            value={form.studentName}
            onChange={(e) => setForm({ ...form, studentName: e.target.value })}
          />
        </label>
        <label>
          Nivel
          <select className="input" value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}>
            {gradeOptions.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </label>
        <label>
          Notas
          <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <div style={{ fontWeight: 600, margin: "10px 0 6px" }}>Documentos de admision</div>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.documents.studentIdentity}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  documents: { ...prev.documents, studentIdentity: e.target.checked }
                }))
              }
            />
            Registro civil / Tarjeta de identidad del estudiante
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.documents.parentsIds}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  documents: { ...prev.documents, parentsIds: e.target.checked }
                }))
              }
            />
            Cedulas de los padres
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.documents.recentReportCards}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  documents: { ...prev.documents, recentReportCards: e.target.checked }
                }))
              }
            />
            Boletines de calificaciones recientes
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.documents.previousSchoolCertificates}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  documents: { ...prev.documents, previousSchoolCertificates: e.target.checked }
                }))
              }
            />
            Certificados escolares anteriores
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.documents.addressProof}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  documents: { ...prev.documents, addressProof: e.target.checked }
                }))
              }
            />
            Comprobante de domicilio (recibo de servicios publicos)
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.documents.vaccinationCard}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  documents: { ...prev.documents, vaccinationCard: e.target.checked }
                }))
              }
            />
            Carne de vacunacion
          </label>
        </div>
        <button className="button" style={{ marginTop: 10 }}>Crear</button>
      </form>
      <form className="card" onSubmit={createEnrollment}>
        <div className="section-title">Matricular estudiante</div>
        <ActionFeedback
          tone={enrollmentFeedback?.tone || "info"}
          title={enrollmentFeedback?.title}
          message={enrollmentFeedback?.text || ""}
          onDismiss={() => {
            setEnrollmentMessage("");
            setEnrollmentError("");
          }}
          style={{ marginBottom: 10 }}
        />
        <label>
          Admision aprobada (autocompletar)
          <select
            className="input"
            value={enrollmentForm.admissionId}
            onChange={(e) => {
              const selectedId = e.target.value;
              const adm = approvedAdmissions.find((a) => a.id === selectedId);
              if (!adm) {
                setEnrollmentForm({ ...enrollmentForm, admissionId: selectedId });
                return;
              }
              applyApprovedAdmission(adm);
            }}
          >
            <option value="">Selecciona una admision aprobada</option>
            {approvedAdmissions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.studentName} - {gradeLabel(a.gradeLevel)}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
            {approvedAdmissions.length} estudiante(s) aprobado(s) disponible(s) para matricula.
          </div>
        </label>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Datos del estudiante</div>
        <label>
          Nombre completo
          <input
            className="input"
            autoComplete="name"
            value={enrollmentForm.studentFullName}
            onChange={(e) => setEnrollmentForm({ ...enrollmentForm, studentFullName: e.target.value })}
          />
        </label>
        <label>
          Fecha de nacimiento
          <input className="input" type="date" value={enrollmentForm.studentBirthDate} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, studentBirthDate: e.target.value })} />
        </label>
        <label>
          Departamento de nacimiento
          <input className="input" value={enrollmentForm.studentBirthPlaceDept} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, studentBirthPlaceDept: e.target.value })} />
        </label>
        <label>
          Municipio de nacimiento
          <input className="input" value={enrollmentForm.studentBirthPlaceCity} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, studentBirthPlaceCity: e.target.value })} />
        </label>
        <label>
          Genero/sexo
          <select className="input" value={enrollmentForm.studentGender} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, studentGender: e.target.value })}>
            <option value="">Selecciona</option>
            <option value="MASCULINO">Masculino</option>
            <option value="FEMENINO">Femenino</option>
            <option value="OTRO">Otro</option>
          </select>
        </label>
        <label>
          Tipo de documento
          <select className="input" value={enrollmentForm.studentDocType} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, studentDocType: e.target.value })}>
            <option value="">Selecciona</option>
            <option value="REGISTRO_CIVIL">Registro civil</option>
            <option value="TARJETA_IDENTIDAD">Tarjeta de identidad</option>
            <option value="CEDULA">Cedula</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
        </label>
        <label>
          Numero de documento
          <input className="input" value={enrollmentForm.studentDocNumber} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, studentDocNumber: e.target.value })} />
        </label>
        <label>
          Nivel/Grado
          <select className="input" value={enrollmentForm.studentGradeLevel} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, studentGradeLevel: e.target.value })}>
            {gradeOptions.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </label>
        <label>
          Direccion de residencia
          <input
            className="input"
            autoComplete="street-address"
            value={enrollmentForm.studentAddress}
            onChange={(e) => setEnrollmentForm({ ...enrollmentForm, studentAddress: e.target.value })}
          />
        </label>
        <label>
          Ano
          <input className="input" value={enrollmentForm.year} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, year: e.target.value })} />
        </label>
        <label>
          Estado
          <input className="input" value={enrollmentForm.status} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, status: e.target.value })} />
        </label>
        <div style={{ fontWeight: 600, margin: "10px 0 6px" }}>Datos del acudiente</div>
        <label>
          Nombre completo
          <input
            className="input"
            autoComplete="name"
            value={enrollmentForm.guardianFullName}
            onChange={(e) => setEnrollmentForm({ ...enrollmentForm, guardianFullName: e.target.value })}
          />
        </label>
        <label>
          Tipo de documento
          <select className="input" value={enrollmentForm.guardianDocType} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, guardianDocType: e.target.value })}>
            <option value="">Selecciona</option>
            {guardianDocTypeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Numero de documento
          <input
            className="input"
            autoComplete="off"
            value={enrollmentForm.guardianDocNumber}
            onChange={(e) => setEnrollmentForm({ ...enrollmentForm, guardianDocNumber: e.target.value })}
          />
        </label>
        <label>
          Parentesco o rol
          <select className="input" value={enrollmentForm.guardianRelation} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, guardianRelation: e.target.value })}>
            <option value="">Selecciona</option>
            {guardianRelationOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div style={{ fontWeight: 600, margin: "10px 0 6px" }}>Datos de contacto</div>
        <label>
          Telefono
          <input
            className="input"
            autoComplete="tel"
            value={enrollmentForm.contactPhone}
            onChange={(e) => setEnrollmentForm({ ...enrollmentForm, contactPhone: e.target.value })}
          />
        </label>
        <label>
          Correo electronico
          <input
            className="input"
            autoComplete="email"
            type="email"
            value={enrollmentForm.contactEmail}
            onChange={(e) => setEnrollmentForm({ ...enrollmentForm, contactEmail: e.target.value })}
          />
        </label>
        <div style={{ fontWeight: 600, margin: "10px 0 6px" }}>Documentos (opcionales)</div>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={enrollmentForm.documents.civilRegistry}
              onChange={(e) => setEnrollmentForm({
                ...enrollmentForm,
                documents: { ...enrollmentForm.documents, civilRegistry: e.target.checked }
              })}
            />
            Registro civil o tarjeta de identidad
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={enrollmentForm.documents.guardianId}
              onChange={(e) => setEnrollmentForm({
                ...enrollmentForm,
                documents: { ...enrollmentForm.documents, guardianId: e.target.checked }
              })}
            />
            Documento del acudiente
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={enrollmentForm.documents.residenceProof}
              onChange={(e) => setEnrollmentForm({
                ...enrollmentForm,
                documents: { ...enrollmentForm.documents, residenceProof: e.target.checked }
              })}
            />
            Soporte de residencia
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={enrollmentForm.documents.healthCertificate}
              onChange={(e) => setEnrollmentForm({
                ...enrollmentForm,
                documents: { ...enrollmentForm.documents, healthCertificate: e.target.checked }
              })}
            />
            Certificado de afiliacion a salud (EPS)
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={enrollmentForm.documents.vaccinationCard}
              onChange={(e) => setEnrollmentForm({
                ...enrollmentForm,
                documents: { ...enrollmentForm.documents, vaccinationCard: e.target.checked }
              })}
            />
            Carne de vacunacion
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={enrollmentForm.documents.previousReport}
              onChange={(e) => setEnrollmentForm({
                ...enrollmentForm,
                documents: { ...enrollmentForm.documents, previousReport: e.target.checked }
              })}
            />
            Boletin o constancia anterior
          </label>
        </div>
        <label>
          Observaciones sobre documentos
          <input className="input" value={enrollmentForm.documentsNotes} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, documentsNotes: e.target.value })} />
        </label>
        <button className="button" style={{ marginTop: 10 }} disabled={enrollmentBusy || missingImportantEnrollmentFields.length > 0}>
          {enrollmentBusy ? "Matriculando..." : "Matricular"}
        </button>
        {missingImportantEnrollmentFields.length > 0 && (
          <div style={{ marginTop: 8, color: "#b45309", fontWeight: 600 }}>
            Faltan datos obligatorios: {missingImportantEnrollmentFields.join(", ")}
          </div>
        )}
      </form>
      <div className="card" style={{ marginTop: 10 }}>
        <div className="section-title">Estudiantes aprobados para matricula</div>
        {approvedAdmissions.length === 0 ? (
          <div style={{ color: "#64748b" }}>No hay estudiantes con admision aprobada pendientes por matricular.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Nivel</th>
                  <th>Solicitud</th>
                  <th>Vence matricula</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {approvedAdmissions.map((adm) => (
                  <tr key={adm.id}>
                    <td>{adm.studentName}</td>
                    <td>{gradeLabel(adm.gradeLevel)}</td>
                    <td>{adm.createdAt ? String(adm.createdAt).slice(0, 10) : "-"}</td>
                    <td>{adm.enrollmentDueAt ? String(adm.enrollmentDueAt).slice(0, 10) : "-"}</td>
                    <td>
                      <button type="button" className="button secondary" onClick={() => applyApprovedAdmission(adm)}>
                        Usar en matricula
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        <div className="section-title">Consultar matriculas</div>
        <ActionFeedback
          tone="error"
          title={feedbackTitles.admissions.loadEnrollmentsError}
          message={enrollmentsError}
          onDismiss={() => setEnrollmentsError("")}
          style={{ marginBottom: 8 }}
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <Autocomplete
            className="input input-search"
            placeholder="Buscar matricula por estudiante, acudiente o grado"
            value={enrollmentsSearch}
            options={enrollmentsSearchOptions}
            onChange={(value) => {
              setEnrollmentsSearch(value);
              setEnrollmentsPage(1);
            }}
          />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Grado</th>
                <th>Grupo</th>
                <th>Ano</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty">No hay matriculas registradas</td>
                </tr>
              )}
              {enrollments.map((item) => (
                <tr key={item.id}>
                  <td>{item.studentFullName}</td>
                  <td><span className="tag">{gradeLabel(item.studentGradeLevel)}</span></td>
                  <td><span className="tag">{item.student?.studentGroup || "-"}</span></td>
                  <td>{item.year}</td>
                  <td><span className={`status-badge status-${String(item.status || "").toLowerCase()}`}>{item.status}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="button secondary" onClick={() => setSelectedEnrollment(item)}>Ver</button>
                      <button type="button" className="button secondary" onClick={() => startEditEnrollment(item)}>Editar</button>
                      <button type="button" className="button danger" onClick={() => removeEnrollment(item.id)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          <button className="button secondary" type="button" disabled={enrollmentsPage <= 1} onClick={() => setEnrollmentsPage(enrollmentsPage - 1)}>
            Anterior
          </button>
          <div style={{ alignSelf: "center", color: "#6b7280" }}>
            Pagina {enrollmentsPage} de {Math.max(1, Math.ceil(enrollmentsTotal / 10))}
          </div>
          <button
            className="button secondary"
            type="button"
            disabled={enrollmentsPage >= Math.max(1, Math.ceil(enrollmentsTotal / 10))}
            onClick={() => setEnrollmentsPage(enrollmentsPage + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
      {selectedEnrollment && (
        <div className="card" style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div className="section-title">Detalle de matricula</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="button secondary" onClick={() => startEditEnrollment(selectedEnrollment)}>
                Editar
              </button>
              <button type="button" className="button secondary" onClick={() => setSelectedEnrollment(null)}>
                Cerrar
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div>
              <strong>Estudiante</strong>
              <div>{selectedEnrollment.studentFullName || "-"}</div>
              <div style={{ color: "#64748b" }}>
                {selectedEnrollment.studentDocType || "Documento"}: {selectedEnrollment.studentDocNumber || "-"}
              </div>
            </div>
            <div>
              <strong>Grado y clase</strong>
              <div>{gradeLabel(selectedEnrollment.studentGradeLevel)}</div>
              <div style={{ color: "#64748b" }}>
                {selectedEnrollment.class?.teacher?.user?.fullName ? `Docente: ${selectedEnrollment.class.teacher.user.fullName}` : "Docente sin asignar"}
              </div>
            </div>
            <div>
              <strong>Matricula</strong>
              <div>Ano {selectedEnrollment.year || "-"}</div>
              <div><span className={`status-badge status-${String(selectedEnrollment.status || "").toLowerCase()}`}>{selectedEnrollment.status || "-"}</span></div>
            </div>
            <div>
              <strong>Acudiente</strong>
              <div>{selectedEnrollment.guardianFullName || "-"}</div>
              <div style={{ color: "#64748b" }}>
                {selectedEnrollment.guardianRelation || "Acudiente"} · {selectedEnrollment.contactPhone || "Sin telefono"}
              </div>
            </div>
            <div>
              <strong>Contacto</strong>
              <div>{selectedEnrollment.contactEmail || "Sin correo"}</div>
              <div style={{ color: "#64748b" }}>{selectedEnrollment.studentAddress || "Sin direccion"}</div>
            </div>
            <div>
              <strong>Documentos</strong>
              <div style={{ color: "#64748b" }}>
                {Object.values(selectedEnrollment.documents || {}).filter(Boolean).length} documento(s) marcado(s)
              </div>
              <div>{selectedEnrollment.documentsNotes || "Sin observaciones"}</div>
            </div>
          </div>
        </div>
      )}
      {editingEnrollmentId && (
        <form ref={editEnrollmentPanelRef} className="card" onSubmit={saveEnrollmentEdit} style={{ marginTop: 10 }}>
          <div className="section-title">Editar matricula</div>
          <ActionFeedback
            tone="success"
            title={feedbackTitles.admissions.updateEnrollmentSuccess}
            message={editingEnrollmentMessage}
            onDismiss={() => setEditingEnrollmentMessage("")}
          />
          <ActionFeedback
            tone="error"
            title={feedbackTitles.admissions.updateEnrollmentError}
            message={editingEnrollmentError}
            onDismiss={() => setEditingEnrollmentError("")}
          />
          <label>
            Nombre del estudiante
            <input
              ref={editEnrollmentNameInputRef}
              className="input"
              autoComplete="name"
              value={editingEnrollmentForm.studentFullName}
              onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentFullName: e.target.value })}
            />
          </label>
          <label>
            Fecha de nacimiento
            <input
              className="input"
              type="date"
              value={editingEnrollmentForm.studentBirthDate}
              onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentBirthDate: e.target.value })}
            />
          </label>
          <label>
            Departamento de nacimiento
            <input
              className="input"
              value={editingEnrollmentForm.studentBirthPlaceDept}
              onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentBirthPlaceDept: e.target.value })}
            />
          </label>
          <label>
            Municipio de nacimiento
            <input
              className="input"
              value={editingEnrollmentForm.studentBirthPlaceCity}
              onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentBirthPlaceCity: e.target.value })}
            />
          </label>
          <label>
            Genero/sexo
            <select className="input" value={editingEnrollmentForm.studentGender} onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentGender: e.target.value })}>
              <option value="">Selecciona</option>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMENINO">Femenino</option>
              <option value="OTRO">Otro</option>
            </select>
          </label>
          <label>
            Tipo documento estudiante
            <select className="input" value={editingEnrollmentForm.studentDocType} onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentDocType: e.target.value })}>
              <option value="">Selecciona</option>
              <option value="RC">Registro Civil</option>
              <option value="TI">Tarjeta de Identidad</option>
              <option value="CC">Cedula</option>
              <option value="PASAPORTE">Pasaporte</option>
              <option value="OTRO">Otro</option>
            </select>
          </label>
          <label>
            Numero documento estudiante
            <input className="input" value={editingEnrollmentForm.studentDocNumber} onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentDocNumber: e.target.value })} />
          </label>
          <label>
            Grado
            <select className="input" value={editingEnrollmentForm.studentGradeLevel} onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentGradeLevel: e.target.value })}>
              {gradeOptions.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </label>
          <label>
            Clase
            <select
              className="input"
              value={editingEnrollmentForm.classId}
              onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, classId: e.target.value })}
            >
              <option value="">Selecciona una clase</option>
              {classes
                .filter((cls) => !editingEnrollmentForm.studentGradeLevel || getClassGradeLevel(cls) === editingEnrollmentForm.studentGradeLevel)
                .map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {gradeLabel(cls.gradeLevel)}{cls.teacher?.user?.fullName ? ` - ${cls.teacher.user.fullName}` : ""}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Ano
            <input className="input" value={editingEnrollmentForm.year} onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, year: e.target.value })} />
          </label>
          <label>
            Estado
            <input className="input" value={editingEnrollmentForm.status} onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, status: e.target.value })} />
          </label>
          <label>
            Direccion
            <input
              className="input"
              autoComplete="street-address"
              value={editingEnrollmentForm.studentAddress}
              onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentAddress: e.target.value })}
            />
          </label>
          <label>
            Acudiente
            <input
              className="input"
              autoComplete="name"
              value={editingEnrollmentForm.guardianFullName}
              onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, guardianFullName: e.target.value })}
            />
          </label>
          <label>
            Tipo documento acudiente
            <select className="input" value={editingEnrollmentForm.guardianDocType} onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, guardianDocType: e.target.value })}>
              <option value="">Selecciona</option>
              {guardianDocTypeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Documento acudiente
            <input className="input" value={editingEnrollmentForm.guardianDocNumber} onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, guardianDocNumber: e.target.value })} />
          </label>
          <label>
            Parentesco
            <select className="input" value={editingEnrollmentForm.guardianRelation} onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, guardianRelation: e.target.value })}>
              <option value="">Selecciona</option>
              {guardianRelationOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Telefono
            <input
              className="input"
              autoComplete="tel"
              value={editingEnrollmentForm.contactPhone}
              onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, contactPhone: e.target.value })}
            />
          </label>
          <label>
            Correo
            <input
              className="input"
              autoComplete="email"
              type="email"
              value={editingEnrollmentForm.contactEmail}
              onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, contactEmail: e.target.value })}
            />
          </label>
          <div style={{ fontWeight: 600, margin: "10px 0 6px" }}>Documentos (opcionales)</div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={editingEnrollmentForm.documents.civilRegistry}
                onChange={(e) => setEditingEnrollmentForm({
                  ...editingEnrollmentForm,
                  documents: { ...editingEnrollmentForm.documents, civilRegistry: e.target.checked }
                })}
              />
              Registro civil o tarjeta de identidad
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={editingEnrollmentForm.documents.guardianId}
                onChange={(e) => setEditingEnrollmentForm({
                  ...editingEnrollmentForm,
                  documents: { ...editingEnrollmentForm.documents, guardianId: e.target.checked }
                })}
              />
              Documento del acudiente
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={editingEnrollmentForm.documents.residenceProof}
                onChange={(e) => setEditingEnrollmentForm({
                  ...editingEnrollmentForm,
                  documents: { ...editingEnrollmentForm.documents, residenceProof: e.target.checked }
                })}
              />
              Soporte de residencia
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={editingEnrollmentForm.documents.healthCertificate}
                onChange={(e) => setEditingEnrollmentForm({
                  ...editingEnrollmentForm,
                  documents: { ...editingEnrollmentForm.documents, healthCertificate: e.target.checked }
                })}
              />
              Certificado de afiliacion a salud (EPS)
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={editingEnrollmentForm.documents.vaccinationCard}
                onChange={(e) => setEditingEnrollmentForm({
                  ...editingEnrollmentForm,
                  documents: { ...editingEnrollmentForm.documents, vaccinationCard: e.target.checked }
                })}
              />
              Carne de vacunacion
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={editingEnrollmentForm.documents.previousReport}
                onChange={(e) => setEditingEnrollmentForm({
                  ...editingEnrollmentForm,
                  documents: { ...editingEnrollmentForm.documents, previousReport: e.target.checked }
                })}
              />
              Boletin o constancia anterior
            </label>
          </div>
          <label>
            Observaciones sobre documentos
            <input
              className="input"
              value={editingEnrollmentForm.documentsNotes}
              onChange={(e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, documentsNotes: e.target.value })}
            />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="button" disabled={editingEnrollmentBusy}>
              {editingEnrollmentBusy ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setEditingEnrollmentId("");
                setEditingEnrollmentMessage("");
                setEditingEnrollmentError("");
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <Autocomplete
          className="input input-search"
          placeholder="Buscar por estudiante"
          value={search}
          options={admissionsSearchOptions}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <select className="input" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
          <option value="">Todos los niveles</option>
          {gradeOptions.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="APPROVED">Aprobado</option>
          <option value="REJECTED">Rechazado</option>
        </select>
        <button className="button secondary" type="button" onClick={() => downloadFile("/admissions/export/excel", "admissions-report.xlsx")}>
          Exportar Excel
        </button>
        <button className="button secondary" type="button" onClick={() => downloadFile("/admissions/export/pdf", "admissions.pdf")}>
          Exportar PDF
        </button>
        <button className="button secondary" type="button" onClick={() => downloadFile("/enrollments/export/pdf", "matriculas-estudiantes.pdf")}>
          Exportar matriculas PDF
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Nombre del filtro"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
        />
        <button className="button secondary" type="button" onClick={saveCurrentFilter}>
          Guardar filtro
        </button>
        <select className="input" value={selectedFilterId} onChange={(e) => applySavedFilter(e.target.value)}>
          <option value="">Filtros guardados</option>
          {savedFilters.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <button className="button secondary" type="button" disabled={!selectedFilterId} onClick={deleteSavedFilter}>
          Eliminar filtro
        </button>
      </div>
      <ActionFeedback
        tone="error"
        title={feedbackTitles.admissions.loadAdmissionsError}
        message={loadError}
        onDismiss={() => setLoadError("")}
        style={{ marginBottom: 8 }}
      />
      <DataTable
        columns={[
          { key: "student", label: "Estudiante" },
          { key: "grade", label: "Nivel" },
          { key: "status", label: "Estado" },
          { key: "due", label: "Vence aprobacion" },
          { key: "days", label: "Dias para aprobar" }
        ]}
        rows={[...admissions]
          .sort((a, b) => {
            const aDue = a.status === "PENDING" ? (getApprovalDueDate(a.createdAt)?.getTime() ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
            const bDue = b.status === "PENDING" ? (getApprovalDueDate(b.createdAt)?.getTime() ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
            return aDue - bDue;
          })
          .map((a) => ({
          student: a.studentName,
          grade: gradeLabel(a.gradeLevel),
          status: a.status,
          due: (() => {
            if (a.status !== "PENDING") return "-";
            const dueDate = getApprovalDueDate(a.createdAt);
            if (!dueDate) return "-";
            const diffDays = getRemainingDays(dueDate.toISOString()) ?? 0;
            const className = diffDays < 0 ? "due-overdue" : diffDays <= 2 ? "due-soon" : "due-ok";
            return (
              <span className={className}>
                {diffDays < 0 ? <span className="due-alert">!</span> : null}
                {dueDate.toISOString().slice(0, 10)}
              </span>
            );
          })(),
          days: (() => {
            if (a.status !== "PENDING") return "-";
            const dueDate = getApprovalDueDate(a.createdAt);
            if (!dueDate) return "-";
            const diffDays = getRemainingDays(dueDate.toISOString()) ?? 0;
            if (diffDays < 0) return <span className="due-overdue">Vencida</span>;
            const className = diffDays <= 2 ? "due-soon" : "due-ok";
            return <span className={className}>{diffDays}</span>;
          })()
        }))}
      />
      {editingId && (
        <form ref={editPanelRef} className="card" onSubmit={saveEdit} style={{ marginTop: 10 }}>
          <div className="section-title">Editar admision</div>
          <ActionFeedback
            tone="success"
            title={feedbackTitles.admissions.updateAdmissionSuccess}
            message={editingMessage}
            onDismiss={() => setEditingMessage("")}
          />
          <ActionFeedback
            tone="error"
            title={feedbackTitles.admissions.updateAdmissionError}
            message={editingError}
            onDismiss={() => setEditingError("")}
          />
          <label>
            Nombre del estudiante
            <input
              ref={editNameInputRef}
              className="input"
              value={editingForm.studentName}
              onChange={(e) => setEditingForm({ ...editingForm, studentName: e.target.value })}
            />
          </label>
          <label>
            Nivel
            <select className="input" value={editingForm.gradeLevel} onChange={(e) => setEditingForm({ ...editingForm, gradeLevel: e.target.value })}>
              {gradeOptions.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </label>
          <label>
            Notas
            <input className="input" value={editingForm.notes} onChange={(e) => setEditingForm({ ...editingForm, notes: e.target.value })} />
          </label>
          <div style={{ fontWeight: 600, margin: "10px 0 6px" }}>Documentos de admision</div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={editingForm.documents.studentIdentity}
                onChange={(e) =>
                  setEditingForm((prev) => ({
                    ...prev,
                    documents: { ...prev.documents, studentIdentity: e.target.checked }
                  }))
                }
              />
              Registro civil / Tarjeta de identidad del estudiante
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={editingForm.documents.parentsIds}
                onChange={(e) =>
                  setEditingForm((prev) => ({
                    ...prev,
                    documents: { ...prev.documents, parentsIds: e.target.checked }
                  }))
                }
              />
              Cedulas de los padres
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={editingForm.documents.recentReportCards}
                onChange={(e) =>
                  setEditingForm((prev) => ({
                    ...prev,
                    documents: { ...prev.documents, recentReportCards: e.target.checked }
                  }))
                }
              />
              Boletines de calificaciones recientes
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={editingForm.documents.previousSchoolCertificates}
                onChange={(e) =>
                  setEditingForm((prev) => ({
                    ...prev,
                    documents: { ...prev.documents, previousSchoolCertificates: e.target.checked }
                  }))
                }
              />
              Certificados escolares anteriores
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={editingForm.documents.addressProof}
                onChange={(e) =>
                  setEditingForm((prev) => ({
                    ...prev,
                    documents: { ...prev.documents, addressProof: e.target.checked }
                  }))
                }
              />
              Comprobante de domicilio (recibo de servicios publicos)
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={editingForm.documents.vaccinationCard}
                onChange={(e) =>
                  setEditingForm((prev) => ({
                    ...prev,
                    documents: { ...prev.documents, vaccinationCard: e.target.checked }
                  }))
                }
              />
              Carne de vacunacion
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="button" disabled={editingBusy}>{editingBusy ? "Guardando..." : "Guardar cambios"}</button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setEditingId("");
                setEditingMessage("");
                setEditingError("");
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {admissions.map((a) => (
          <div key={a.id} className="card" style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", padding: 12 }}>
            <div style={{ color: "#6b7280" }}>{a.studentName}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
              <button className="button secondary" onClick={() => startEdit(a)}>Editar</button>
              <button className="button secondary" onClick={() => setStatus(a.id, "APPROVED")}>Aprobar</button>
              <button className="button danger" onClick={() => setStatus(a.id, "REJECTED")}>Rechazar</button>
            </div>
          </div>
        ))}
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

