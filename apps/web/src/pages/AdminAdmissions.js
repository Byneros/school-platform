import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
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
function getClassGradeLevel(classData) {
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
function normalizeGuardianRelation(value) {
    const normalized = String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    if (normalized === "ACUDIENTE")
        return "ACUDIENTE_LEGAL";
    return guardianRelationOptions.some((item) => item.value === normalized) ? normalized : "";
}
function normalizeGuardianDocType(value) {
    const normalized = String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    return guardianDocTypeOptions.some((item) => item.value === normalized) ? normalized : "";
}
export default function AdminAdmissions() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [admissions, setAdmissions] = useState([]);
    const [classes, setClasses] = useState([]);
    const [approvedAdmissions, setApprovedAdmissions] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [enrollmentsPage, setEnrollmentsPage] = useState(1);
    const [enrollmentsTotal, setEnrollmentsTotal] = useState(0);
    const [enrollmentsSearch, setEnrollmentsSearch] = useState("");
    const debouncedEnrollmentsSearch = useDebounce(enrollmentsSearch, 350);
    const [savedFilters, setSavedFilters] = useState([]);
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
    const [selectedEnrollment, setSelectedEnrollment] = useState(null);
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
    const editPanelRef = useRef(null);
    const editNameInputRef = useRef(null);
    const editEnrollmentPanelRef = useRef(null);
    const editEnrollmentNameInputRef = useRef(null);
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
                tone: "success"
            };
        }
        if (!enrollmentError)
            return null;
        const errorText = enrollmentError.toLowerCase();
        if (errorText.includes("ya esta matriculado") || errorText.includes("ya tiene una matricula")) {
            return {
                title: "Estudiante ya registrado",
                text: enrollmentError,
                tone: "warning"
            };
        }
        if (errorText.includes("validation") ||
            errorText.includes("required") ||
            errorText.includes("invalid") ||
            errorText.includes("body.")) {
            return {
                title: "Error de validacion de matricula",
                text: enrollmentError,
                tone: "info"
            };
        }
        return {
            title: "Error de matricula",
            text: enrollmentError,
            tone: "error"
        };
    })();
    const missingImportantEnrollmentFields = (() => {
        const required = [
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
        if (page > 1)
            next.set("page", String(page));
        if (statusFilter)
            next.set("status", statusFilter);
        if (gradeFilter)
            next.set("grade", gradeFilter);
        if (search)
            next.set("search", search);
        setSearchParams(next, { replace: true });
    }, [page, statusFilter, gradeFilter, search, setSearchParams]);
    useEffect(() => {
        const raw = localStorage.getItem("admin_admissions_filters");
        if (!raw)
            return;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                setSavedFilters(parsed);
            }
        }
        catch {
            setSavedFilters([]);
        }
    }, []);
    const persistFilters = (next) => {
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
    const applySavedFilter = (id) => {
        setSelectedFilterId(id);
        const selected = savedFilters.find((f) => f.id === id);
        if (!selected)
            return;
        setStatusFilter(selected.statusFilter);
        setGradeFilter(selected.gradeFilter);
        setSearch(selected.search);
        setPage(1);
    };
    const deleteSavedFilter = () => {
        if (!selectedFilterId)
            return;
        const next = savedFilters.filter((f) => f.id !== selectedFilterId);
        persistFilters(next);
        setSelectedFilterId("");
    };
    const load = () => apiGet(`/admissions?page=${page}&pageSize=10${statusFilter ? `&status=${statusFilter}` : ""}${gradeFilter ? `&gradeLevel=${gradeFilter}` : ""}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`)
        .then((res) => {
        setLoadError("");
        setAdmissions(res.data || []);
        setTotal(res.total || 0);
    })
        .catch((error) => {
        setLoadError(error?.message || "No se pudieron cargar las admisiones.");
    });
    const loadApprovedAdmissions = () => apiGet("/admissions/approved")
        .then((res) => setApprovedAdmissions(res))
        .catch(() => undefined);
    const loadEnrollments = () => apiGet(`/enrollments?page=${enrollmentsPage}&pageSize=10${debouncedEnrollmentsSearch ? `&search=${encodeURIComponent(debouncedEnrollmentsSearch)}` : ""}`)
        .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setEnrollmentsError("");
        setEnrollments(list);
        setSelectedEnrollment((current) => (current ? list.find((item) => item.id === current.id) || current : null));
        setEnrollmentsTotal(Array.isArray(res) ? list.length : Number(res?.total || 0));
    })
        .catch((error) => {
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
        const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
        return () => window.clearInterval(timer);
    }, []);
    useEffect(() => {
        if (!editingId)
            return;
        requestAnimationFrame(() => {
            editPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            editNameInputRef.current?.focus();
        });
    }, [editingId]);
    useEffect(() => {
        if (!editingEnrollmentId)
            return;
        requestAnimationFrame(() => {
            editEnrollmentPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            editEnrollmentNameInputRef.current?.focus();
        });
    }, [editingEnrollmentId]);
    const getRemainingDays = (dueAt) => {
        if (!dueAt)
            return null;
        const dueDate = new Date(dueAt);
        const today = new Date(nowMs);
        today.setHours(0, 0, 0, 0);
        return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };
    const addBusinessDays = (startDate, days) => {
        const result = new Date(startDate);
        let added = 0;
        while (added < days) {
            result.setDate(result.getDate() + 1);
            const day = result.getDay();
            if (day !== 0 && day !== 6)
                added += 1;
        }
        return result;
    };
    const getApprovalDueDate = (createdAt) => {
        if (!createdAt)
            return null;
        return addBusinessDays(new Date(createdAt), 5);
    };
    const create = async (e) => {
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
        }
        catch (error) {
            setAdmissionError(error?.message || "No fue posible crear la admision.");
        }
    };
    const admissionFeedback = (() => {
        if (admissionMessage) {
            return {
                title: "Admision creada",
                text: admissionMessage,
                tone: "success"
            };
        }
        if (!admissionError)
            return null;
        return {
            title: "Error al crear admision",
            text: admissionError,
            tone: "error"
        };
    })();
    const setStatus = async (id, status) => {
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
            }
            else {
                setAdmissions((prev) => prev.map((a) => (a.id === id ? updated : a)));
            }
            setAdmissionStatusMessage(status === "APPROVED"
                ? "Admision aprobada satisfactoriamente."
                : "Estado de admision actualizado satisfactoriamente.");
            loadApprovedAdmissions();
        }
        catch (error) {
            const message = error?.message || "No se pudo actualizar el estado de la admision.";
            setAdmissionStatusError(message);
            setLoadError(message);
        }
    };
    const startEdit = (admission) => {
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
    const saveEdit = async (e) => {
        e.preventDefault();
        if (!editingId)
            return;
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
        }
        catch (error) {
            setEditingError(error?.message || "No se pudo actualizar la admision");
        }
        finally {
            setEditingBusy(false);
        }
    };
    const createEnrollment = async (e) => {
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
            const classIdFromGrade = classes.find((c) => getClassGradeLevel(c) === String(enrollmentForm.studentGradeLevel || ""))?.id;
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
        }
        catch (error) {
            setEnrollmentError(error?.message || "No fue posible registrar la matricula");
        }
        finally {
            setEnrollmentBusy(false);
        }
    };
    const applyApprovedAdmission = (adm) => {
        if (!adm)
            return;
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
    const startEditEnrollment = (enrollment) => {
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
    const saveEnrollmentEdit = async (e) => {
        e.preventDefault();
        if (!editingEnrollmentId)
            return;
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
        }
        catch (error) {
            setEditingEnrollmentError(error?.message || "No fue posible actualizar la matricula");
        }
        finally {
            setEditingEnrollmentBusy(false);
        }
    };
    const removeEnrollment = async (id) => {
        if (!window.confirm("Seguro que deseas eliminar esta matricula?"))
            return;
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
        }
        catch (error) {
            setRemoveEnrollmentError(error?.message || "No fue posible eliminar la matricula");
        }
    };
    const downloadFile = async (path, filename) => {
        const blob = await apiDownload(path);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };
    return (_jsxs(Section, { title: "Admisiones", children: [_jsxs("div", { className: "help-card", children: ["Revisa y aprueba las admisiones pendientes.", _jsxs("div", { style: { marginTop: 6 }, children: ["Fecha y hora del equipo: ", _jsx("strong", { children: new Date(nowMs).toLocaleString("es-CO") })] })] }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.admissions.statusSuccess, message: admissionStatusMessage, onDismiss: () => setAdmissionStatusMessage("") }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.admissions.statusError, message: admissionStatusError, onDismiss: () => setAdmissionStatusError("") }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.admissions.deleteEnrollmentSuccess, message: removeEnrollmentMessage, onDismiss: () => setRemoveEnrollmentMessage("") }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.admissions.deleteEnrollmentError, message: removeEnrollmentError, onDismiss: () => setRemoveEnrollmentError("") }), _jsx(ActionFeedback, { tone: admissionFeedback?.tone || "info", title: admissionFeedback?.title, message: admissionFeedback?.text || "", onDismiss: () => {
                    setAdmissionMessage("");
                    setAdmissionError("");
                } }), _jsxs("form", { className: "card", onSubmit: create, children: [_jsx("div", { className: "section-title", children: "Nueva admision" }), _jsxs("label", { children: ["Nombre del estudiante", _jsx("input", { className: "input", autoComplete: "name", value: form.studentName, onChange: (e) => setForm({ ...form, studentName: e.target.value }) })] }), _jsxs("label", { children: ["Nivel", _jsx("select", { className: "input", value: form.gradeLevel, onChange: (e) => setForm({ ...form, gradeLevel: e.target.value }), children: gradeOptions.map((g) => (_jsx("option", { value: g.value, children: g.label }, g.value))) })] }), _jsxs("label", { children: ["Notas", _jsx("input", { className: "input", value: form.notes, onChange: (e) => setForm({ ...form, notes: e.target.value }) })] }), _jsx("div", { style: { fontWeight: 600, margin: "10px 0 6px" }, children: "Documentos de admision" }), _jsxs("div", { style: { display: "grid", gap: 6 }, children: [_jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: form.documents.studentIdentity, onChange: (e) => setForm((prev) => ({
                                            ...prev,
                                            documents: { ...prev.documents, studentIdentity: e.target.checked }
                                        })) }), "Registro civil / Tarjeta de identidad del estudiante"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: form.documents.parentsIds, onChange: (e) => setForm((prev) => ({
                                            ...prev,
                                            documents: { ...prev.documents, parentsIds: e.target.checked }
                                        })) }), "Cedulas de los padres"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: form.documents.recentReportCards, onChange: (e) => setForm((prev) => ({
                                            ...prev,
                                            documents: { ...prev.documents, recentReportCards: e.target.checked }
                                        })) }), "Boletines de calificaciones recientes"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: form.documents.previousSchoolCertificates, onChange: (e) => setForm((prev) => ({
                                            ...prev,
                                            documents: { ...prev.documents, previousSchoolCertificates: e.target.checked }
                                        })) }), "Certificados escolares anteriores"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: form.documents.addressProof, onChange: (e) => setForm((prev) => ({
                                            ...prev,
                                            documents: { ...prev.documents, addressProof: e.target.checked }
                                        })) }), "Comprobante de domicilio (recibo de servicios publicos)"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: form.documents.vaccinationCard, onChange: (e) => setForm((prev) => ({
                                            ...prev,
                                            documents: { ...prev.documents, vaccinationCard: e.target.checked }
                                        })) }), "Carne de vacunacion"] })] }), _jsx("button", { className: "button", style: { marginTop: 10 }, children: "Crear" })] }), _jsxs("form", { className: "card", onSubmit: createEnrollment, children: [_jsx("div", { className: "section-title", children: "Matricular estudiante" }), _jsx(ActionFeedback, { tone: enrollmentFeedback?.tone || "info", title: enrollmentFeedback?.title, message: enrollmentFeedback?.text || "", onDismiss: () => {
                            setEnrollmentMessage("");
                            setEnrollmentError("");
                        }, style: { marginBottom: 10 } }), _jsxs("label", { children: ["Admision aprobada (autocompletar)", _jsxs("select", { className: "input", value: enrollmentForm.admissionId, onChange: (e) => {
                                    const selectedId = e.target.value;
                                    const adm = approvedAdmissions.find((a) => a.id === selectedId);
                                    if (!adm) {
                                        setEnrollmentForm({ ...enrollmentForm, admissionId: selectedId });
                                        return;
                                    }
                                    applyApprovedAdmission(adm);
                                }, children: [_jsx("option", { value: "", children: "Selecciona una admision aprobada" }), approvedAdmissions.map((a) => (_jsxs("option", { value: a.id, children: [a.studentName, " - ", gradeLabel(a.gradeLevel)] }, a.id)))] }), _jsxs("div", { style: { marginTop: 6, color: "#64748b", fontSize: 12 }, children: [approvedAdmissions.length, " estudiante(s) aprobado(s) disponible(s) para matricula."] })] }), _jsx("div", { style: { fontWeight: 600, marginBottom: 6 }, children: "Datos del estudiante" }), _jsxs("label", { children: ["Nombre completo", _jsx("input", { className: "input", autoComplete: "name", value: enrollmentForm.studentFullName, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, studentFullName: e.target.value }) })] }), _jsxs("label", { children: ["Fecha de nacimiento", _jsx("input", { className: "input", type: "date", value: enrollmentForm.studentBirthDate, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, studentBirthDate: e.target.value }) })] }), _jsxs("label", { children: ["Departamento de nacimiento", _jsx("input", { className: "input", value: enrollmentForm.studentBirthPlaceDept, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, studentBirthPlaceDept: e.target.value }) })] }), _jsxs("label", { children: ["Municipio de nacimiento", _jsx("input", { className: "input", value: enrollmentForm.studentBirthPlaceCity, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, studentBirthPlaceCity: e.target.value }) })] }), _jsxs("label", { children: ["Genero/sexo", _jsxs("select", { className: "input", value: enrollmentForm.studentGender, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, studentGender: e.target.value }), children: [_jsx("option", { value: "", children: "Selecciona" }), _jsx("option", { value: "MASCULINO", children: "Masculino" }), _jsx("option", { value: "FEMENINO", children: "Femenino" }), _jsx("option", { value: "OTRO", children: "Otro" })] })] }), _jsxs("label", { children: ["Tipo de documento", _jsxs("select", { className: "input", value: enrollmentForm.studentDocType, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, studentDocType: e.target.value }), children: [_jsx("option", { value: "", children: "Selecciona" }), _jsx("option", { value: "REGISTRO_CIVIL", children: "Registro civil" }), _jsx("option", { value: "TARJETA_IDENTIDAD", children: "Tarjeta de identidad" }), _jsx("option", { value: "CEDULA", children: "Cedula" }), _jsx("option", { value: "PASAPORTE", children: "Pasaporte" })] })] }), _jsxs("label", { children: ["Numero de documento", _jsx("input", { className: "input", value: enrollmentForm.studentDocNumber, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, studentDocNumber: e.target.value }) })] }), _jsxs("label", { children: ["Nivel/Grado", _jsx("select", { className: "input", value: enrollmentForm.studentGradeLevel, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, studentGradeLevel: e.target.value }), children: gradeOptions.map((g) => (_jsx("option", { value: g.value, children: g.label }, g.value))) })] }), _jsxs("label", { children: ["Direccion de residencia", _jsx("input", { className: "input", autoComplete: "street-address", value: enrollmentForm.studentAddress, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, studentAddress: e.target.value }) })] }), _jsxs("label", { children: ["Ano", _jsx("input", { className: "input", value: enrollmentForm.year, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, year: e.target.value }) })] }), _jsxs("label", { children: ["Estado", _jsx("input", { className: "input", value: enrollmentForm.status, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, status: e.target.value }) })] }), _jsx("div", { style: { fontWeight: 600, margin: "10px 0 6px" }, children: "Datos del acudiente" }), _jsxs("label", { children: ["Nombre completo", _jsx("input", { className: "input", autoComplete: "name", value: enrollmentForm.guardianFullName, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, guardianFullName: e.target.value }) })] }), _jsxs("label", { children: ["Tipo de documento", _jsxs("select", { className: "input", value: enrollmentForm.guardianDocType, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, guardianDocType: e.target.value }), children: [_jsx("option", { value: "", children: "Selecciona" }), guardianDocTypeOptions.map((item) => (_jsx("option", { value: item.value, children: item.label }, item.value)))] })] }), _jsxs("label", { children: ["Numero de documento", _jsx("input", { className: "input", autoComplete: "off", value: enrollmentForm.guardianDocNumber, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, guardianDocNumber: e.target.value }) })] }), _jsxs("label", { children: ["Parentesco o rol", _jsxs("select", { className: "input", value: enrollmentForm.guardianRelation, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, guardianRelation: e.target.value }), children: [_jsx("option", { value: "", children: "Selecciona" }), guardianRelationOptions.map((item) => (_jsx("option", { value: item.value, children: item.label }, item.value)))] })] }), _jsx("div", { style: { fontWeight: 600, margin: "10px 0 6px" }, children: "Datos de contacto" }), _jsxs("label", { children: ["Telefono", _jsx("input", { className: "input", autoComplete: "tel", value: enrollmentForm.contactPhone, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, contactPhone: e.target.value }) })] }), _jsxs("label", { children: ["Correo electronico", _jsx("input", { className: "input", autoComplete: "email", type: "email", value: enrollmentForm.contactEmail, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, contactEmail: e.target.value }) })] }), _jsx("div", { style: { fontWeight: 600, margin: "10px 0 6px" }, children: "Documentos (opcionales)" }), _jsxs("div", { style: { display: "grid", gap: 6 }, children: [_jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: enrollmentForm.documents.civilRegistry, onChange: (e) => setEnrollmentForm({
                                            ...enrollmentForm,
                                            documents: { ...enrollmentForm.documents, civilRegistry: e.target.checked }
                                        }) }), "Registro civil o tarjeta de identidad"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: enrollmentForm.documents.guardianId, onChange: (e) => setEnrollmentForm({
                                            ...enrollmentForm,
                                            documents: { ...enrollmentForm.documents, guardianId: e.target.checked }
                                        }) }), "Documento del acudiente"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: enrollmentForm.documents.residenceProof, onChange: (e) => setEnrollmentForm({
                                            ...enrollmentForm,
                                            documents: { ...enrollmentForm.documents, residenceProof: e.target.checked }
                                        }) }), "Soporte de residencia"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: enrollmentForm.documents.healthCertificate, onChange: (e) => setEnrollmentForm({
                                            ...enrollmentForm,
                                            documents: { ...enrollmentForm.documents, healthCertificate: e.target.checked }
                                        }) }), "Certificado de afiliacion a salud (EPS)"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: enrollmentForm.documents.vaccinationCard, onChange: (e) => setEnrollmentForm({
                                            ...enrollmentForm,
                                            documents: { ...enrollmentForm.documents, vaccinationCard: e.target.checked }
                                        }) }), "Carne de vacunacion"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: enrollmentForm.documents.previousReport, onChange: (e) => setEnrollmentForm({
                                            ...enrollmentForm,
                                            documents: { ...enrollmentForm.documents, previousReport: e.target.checked }
                                        }) }), "Boletin o constancia anterior"] })] }), _jsxs("label", { children: ["Observaciones sobre documentos", _jsx("input", { className: "input", value: enrollmentForm.documentsNotes, onChange: (e) => setEnrollmentForm({ ...enrollmentForm, documentsNotes: e.target.value }) })] }), _jsx("button", { className: "button", style: { marginTop: 10 }, disabled: enrollmentBusy || missingImportantEnrollmentFields.length > 0, children: enrollmentBusy ? "Matriculando..." : "Matricular" }), missingImportantEnrollmentFields.length > 0 && (_jsxs("div", { style: { marginTop: 8, color: "#b45309", fontWeight: 600 }, children: ["Faltan datos obligatorios: ", missingImportantEnrollmentFields.join(", ")] }))] }), _jsxs("div", { className: "card", style: { marginTop: 10 }, children: [_jsx("div", { className: "section-title", children: "Estudiantes aprobados para matricula" }), approvedAdmissions.length === 0 ? (_jsx("div", { style: { color: "#64748b" }, children: "No hay estudiantes con admision aprobada pendientes por matricular." })) : (_jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Estudiante" }), _jsx("th", { children: "Nivel" }), _jsx("th", { children: "Solicitud" }), _jsx("th", { children: "Vence matricula" }), _jsx("th", { children: "Accion" })] }) }), _jsx("tbody", { children: approvedAdmissions.map((adm) => (_jsxs("tr", { children: [_jsx("td", { children: adm.studentName }), _jsx("td", { children: gradeLabel(adm.gradeLevel) }), _jsx("td", { children: adm.createdAt ? String(adm.createdAt).slice(0, 10) : "-" }), _jsx("td", { children: adm.enrollmentDueAt ? String(adm.enrollmentDueAt).slice(0, 10) : "-" }), _jsx("td", { children: _jsx("button", { type: "button", className: "button secondary", onClick: () => applyApprovedAdmission(adm), children: "Usar en matricula" }) })] }, adm.id))) })] }) }))] }), _jsxs("div", { className: "card", style: { marginTop: 10 }, children: [_jsx("div", { className: "section-title", children: "Consultar matriculas" }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.admissions.loadEnrollmentsError, message: enrollmentsError, onDismiss: () => setEnrollmentsError(""), style: { marginBottom: 8 } }), _jsx("div", { style: { display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }, children: _jsx(Autocomplete, { className: "input input-search", placeholder: "Buscar matricula por estudiante, acudiente o grado", value: enrollmentsSearch, options: enrollmentsSearchOptions, onChange: (value) => {
                                setEnrollmentsSearch(value);
                                setEnrollmentsPage(1);
                            } }) }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Estudiante" }), _jsx("th", { children: "Grado" }), _jsx("th", { children: "Grupo" }), _jsx("th", { children: "Ano" }), _jsx("th", { children: "Estado" }), _jsx("th", { children: "Acciones" })] }) }), _jsxs("tbody", { children: [enrollments.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "table-empty", children: "No hay matriculas registradas" }) })), enrollments.map((item) => (_jsxs("tr", { children: [_jsx("td", { children: item.studentFullName }), _jsx("td", { children: _jsx("span", { className: "tag", children: gradeLabel(item.studentGradeLevel) }) }), _jsx("td", { children: _jsx("span", { className: "tag", children: item.student?.studentGroup || "-" }) }), _jsx("td", { children: item.year }), _jsx("td", { children: _jsx("span", { className: `status-badge status-${String(item.status || "").toLowerCase()}`, children: item.status }) }), _jsx("td", { children: _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("button", { type: "button", className: "button secondary", onClick: () => setSelectedEnrollment(item), children: "Ver" }), _jsx("button", { type: "button", className: "button secondary", onClick: () => startEditEnrollment(item), children: "Editar" }), _jsx("button", { type: "button", className: "button danger", onClick: () => removeEnrollment(item.id), children: "Eliminar" })] }) })] }, item.id)))] })] }) }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", type: "button", disabled: enrollmentsPage <= 1, onClick: () => setEnrollmentsPage(enrollmentsPage - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", enrollmentsPage, " de ", Math.max(1, Math.ceil(enrollmentsTotal / 10))] }), _jsx("button", { className: "button secondary", type: "button", disabled: enrollmentsPage >= Math.max(1, Math.ceil(enrollmentsTotal / 10)), onClick: () => setEnrollmentsPage(enrollmentsPage + 1), children: "Siguiente" })] })] }), selectedEnrollment && (_jsxs("div", { className: "card", style: { marginTop: 10 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }, children: [_jsx("div", { className: "section-title", children: "Detalle de matricula" }), _jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [_jsx("button", { type: "button", className: "button secondary", onClick: () => startEditEnrollment(selectedEnrollment), children: "Editar" }), _jsx("button", { type: "button", className: "button secondary", onClick: () => setSelectedEnrollment(null), children: "Cerrar" })] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Estudiante" }), _jsx("div", { children: selectedEnrollment.studentFullName || "-" }), _jsxs("div", { style: { color: "#64748b" }, children: [selectedEnrollment.studentDocType || "Documento", ": ", selectedEnrollment.studentDocNumber || "-"] })] }), _jsxs("div", { children: [_jsx("strong", { children: "Grado y clase" }), _jsx("div", { children: gradeLabel(selectedEnrollment.studentGradeLevel) }), _jsx("div", { style: { color: "#64748b" }, children: selectedEnrollment.class?.teacher?.user?.fullName ? `Docente: ${selectedEnrollment.class.teacher.user.fullName}` : "Docente sin asignar" })] }), _jsxs("div", { children: [_jsx("strong", { children: "Matricula" }), _jsxs("div", { children: ["Ano ", selectedEnrollment.year || "-"] }), _jsx("div", { children: _jsx("span", { className: `status-badge status-${String(selectedEnrollment.status || "").toLowerCase()}`, children: selectedEnrollment.status || "-" }) })] }), _jsxs("div", { children: [_jsx("strong", { children: "Acudiente" }), _jsx("div", { children: selectedEnrollment.guardianFullName || "-" }), _jsxs("div", { style: { color: "#64748b" }, children: [selectedEnrollment.guardianRelation || "Acudiente", " \u00B7 ", selectedEnrollment.contactPhone || "Sin telefono"] })] }), _jsxs("div", { children: [_jsx("strong", { children: "Contacto" }), _jsx("div", { children: selectedEnrollment.contactEmail || "Sin correo" }), _jsx("div", { style: { color: "#64748b" }, children: selectedEnrollment.studentAddress || "Sin direccion" })] }), _jsxs("div", { children: [_jsx("strong", { children: "Documentos" }), _jsxs("div", { style: { color: "#64748b" }, children: [Object.values(selectedEnrollment.documents || {}).filter(Boolean).length, " documento(s) marcado(s)"] }), _jsx("div", { children: selectedEnrollment.documentsNotes || "Sin observaciones" })] })] })] })), editingEnrollmentId && (_jsxs("form", { ref: editEnrollmentPanelRef, className: "card", onSubmit: saveEnrollmentEdit, style: { marginTop: 10 }, children: [_jsx("div", { className: "section-title", children: "Editar matricula" }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.admissions.updateEnrollmentSuccess, message: editingEnrollmentMessage, onDismiss: () => setEditingEnrollmentMessage("") }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.admissions.updateEnrollmentError, message: editingEnrollmentError, onDismiss: () => setEditingEnrollmentError("") }), _jsxs("label", { children: ["Nombre del estudiante", _jsx("input", { ref: editEnrollmentNameInputRef, className: "input", autoComplete: "name", value: editingEnrollmentForm.studentFullName, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentFullName: e.target.value }) })] }), _jsxs("label", { children: ["Fecha de nacimiento", _jsx("input", { className: "input", type: "date", value: editingEnrollmentForm.studentBirthDate, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentBirthDate: e.target.value }) })] }), _jsxs("label", { children: ["Departamento de nacimiento", _jsx("input", { className: "input", value: editingEnrollmentForm.studentBirthPlaceDept, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentBirthPlaceDept: e.target.value }) })] }), _jsxs("label", { children: ["Municipio de nacimiento", _jsx("input", { className: "input", value: editingEnrollmentForm.studentBirthPlaceCity, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentBirthPlaceCity: e.target.value }) })] }), _jsxs("label", { children: ["Genero/sexo", _jsxs("select", { className: "input", value: editingEnrollmentForm.studentGender, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentGender: e.target.value }), children: [_jsx("option", { value: "", children: "Selecciona" }), _jsx("option", { value: "MASCULINO", children: "Masculino" }), _jsx("option", { value: "FEMENINO", children: "Femenino" }), _jsx("option", { value: "OTRO", children: "Otro" })] })] }), _jsxs("label", { children: ["Tipo documento estudiante", _jsxs("select", { className: "input", value: editingEnrollmentForm.studentDocType, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentDocType: e.target.value }), children: [_jsx("option", { value: "", children: "Selecciona" }), _jsx("option", { value: "RC", children: "Registro Civil" }), _jsx("option", { value: "TI", children: "Tarjeta de Identidad" }), _jsx("option", { value: "CC", children: "Cedula" }), _jsx("option", { value: "PASAPORTE", children: "Pasaporte" }), _jsx("option", { value: "OTRO", children: "Otro" })] })] }), _jsxs("label", { children: ["Numero documento estudiante", _jsx("input", { className: "input", value: editingEnrollmentForm.studentDocNumber, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentDocNumber: e.target.value }) })] }), _jsxs("label", { children: ["Grado", _jsx("select", { className: "input", value: editingEnrollmentForm.studentGradeLevel, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentGradeLevel: e.target.value }), children: gradeOptions.map((g) => (_jsx("option", { value: g.value, children: g.label }, g.value))) })] }), _jsxs("label", { children: ["Clase", _jsxs("select", { className: "input", value: editingEnrollmentForm.classId, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, classId: e.target.value }), children: [_jsx("option", { value: "", children: "Selecciona una clase" }), classes
                                        .filter((cls) => !editingEnrollmentForm.studentGradeLevel || getClassGradeLevel(cls) === editingEnrollmentForm.studentGradeLevel)
                                        .map((cls) => (_jsxs("option", { value: cls.id, children: [gradeLabel(cls.gradeLevel), cls.teacher?.user?.fullName ? ` - ${cls.teacher.user.fullName}` : ""] }, cls.id)))] })] }), _jsxs("label", { children: ["Ano", _jsx("input", { className: "input", value: editingEnrollmentForm.year, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, year: e.target.value }) })] }), _jsxs("label", { children: ["Estado", _jsx("input", { className: "input", value: editingEnrollmentForm.status, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, status: e.target.value }) })] }), _jsxs("label", { children: ["Direccion", _jsx("input", { className: "input", autoComplete: "street-address", value: editingEnrollmentForm.studentAddress, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, studentAddress: e.target.value }) })] }), _jsxs("label", { children: ["Acudiente", _jsx("input", { className: "input", autoComplete: "name", value: editingEnrollmentForm.guardianFullName, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, guardianFullName: e.target.value }) })] }), _jsxs("label", { children: ["Tipo documento acudiente", _jsxs("select", { className: "input", value: editingEnrollmentForm.guardianDocType, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, guardianDocType: e.target.value }), children: [_jsx("option", { value: "", children: "Selecciona" }), guardianDocTypeOptions.map((item) => (_jsx("option", { value: item.value, children: item.label }, item.value)))] })] }), _jsxs("label", { children: ["Documento acudiente", _jsx("input", { className: "input", value: editingEnrollmentForm.guardianDocNumber, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, guardianDocNumber: e.target.value }) })] }), _jsxs("label", { children: ["Parentesco", _jsxs("select", { className: "input", value: editingEnrollmentForm.guardianRelation, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, guardianRelation: e.target.value }), children: [_jsx("option", { value: "", children: "Selecciona" }), guardianRelationOptions.map((item) => (_jsx("option", { value: item.value, children: item.label }, item.value)))] })] }), _jsxs("label", { children: ["Telefono", _jsx("input", { className: "input", autoComplete: "tel", value: editingEnrollmentForm.contactPhone, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, contactPhone: e.target.value }) })] }), _jsxs("label", { children: ["Correo", _jsx("input", { className: "input", autoComplete: "email", type: "email", value: editingEnrollmentForm.contactEmail, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, contactEmail: e.target.value }) })] }), _jsx("div", { style: { fontWeight: 600, margin: "10px 0 6px" }, children: "Documentos (opcionales)" }), _jsxs("div", { style: { display: "grid", gap: 6 }, children: [_jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: editingEnrollmentForm.documents.civilRegistry, onChange: (e) => setEditingEnrollmentForm({
                                            ...editingEnrollmentForm,
                                            documents: { ...editingEnrollmentForm.documents, civilRegistry: e.target.checked }
                                        }) }), "Registro civil o tarjeta de identidad"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: editingEnrollmentForm.documents.guardianId, onChange: (e) => setEditingEnrollmentForm({
                                            ...editingEnrollmentForm,
                                            documents: { ...editingEnrollmentForm.documents, guardianId: e.target.checked }
                                        }) }), "Documento del acudiente"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: editingEnrollmentForm.documents.residenceProof, onChange: (e) => setEditingEnrollmentForm({
                                            ...editingEnrollmentForm,
                                            documents: { ...editingEnrollmentForm.documents, residenceProof: e.target.checked }
                                        }) }), "Soporte de residencia"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: editingEnrollmentForm.documents.healthCertificate, onChange: (e) => setEditingEnrollmentForm({
                                            ...editingEnrollmentForm,
                                            documents: { ...editingEnrollmentForm.documents, healthCertificate: e.target.checked }
                                        }) }), "Certificado de afiliacion a salud (EPS)"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: editingEnrollmentForm.documents.vaccinationCard, onChange: (e) => setEditingEnrollmentForm({
                                            ...editingEnrollmentForm,
                                            documents: { ...editingEnrollmentForm.documents, vaccinationCard: e.target.checked }
                                        }) }), "Carne de vacunacion"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: editingEnrollmentForm.documents.previousReport, onChange: (e) => setEditingEnrollmentForm({
                                            ...editingEnrollmentForm,
                                            documents: { ...editingEnrollmentForm.documents, previousReport: e.target.checked }
                                        }) }), "Boletin o constancia anterior"] })] }), _jsxs("label", { children: ["Observaciones sobre documentos", _jsx("input", { className: "input", value: editingEnrollmentForm.documentsNotes, onChange: (e) => setEditingEnrollmentForm({ ...editingEnrollmentForm, documentsNotes: e.target.value }) })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 10 }, children: [_jsx("button", { className: "button", disabled: editingEnrollmentBusy, children: editingEnrollmentBusy ? "Guardando..." : "Guardar cambios" }), _jsx("button", { type: "button", className: "button secondary", onClick: () => {
                                    setEditingEnrollmentId("");
                                    setEditingEnrollmentMessage("");
                                    setEditingEnrollmentError("");
                                }, children: "Cancelar" })] })] })), _jsxs("div", { style: { display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }, children: [_jsx(Autocomplete, { className: "input input-search", placeholder: "Buscar por estudiante", value: search, options: admissionsSearchOptions, onChange: (value) => {
                            setSearch(value);
                            setPage(1);
                        } }), _jsxs("select", { className: "input", value: gradeFilter, onChange: (e) => setGradeFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los niveles" }), gradeOptions.map((g) => (_jsx("option", { value: g.value, children: g.label }, g.value)))] }), _jsxs("select", { className: "input", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "", children: "Todos los estados" }), _jsx("option", { value: "PENDING", children: "Pendiente" }), _jsx("option", { value: "APPROVED", children: "Aprobado" }), _jsx("option", { value: "REJECTED", children: "Rechazado" })] }), _jsx("button", { className: "button secondary", type: "button", onClick: () => downloadFile("/admissions/export/excel", "admissions-report.xlsx"), children: "Exportar Excel" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => downloadFile("/admissions/export/pdf", "admissions.pdf"), children: "Exportar PDF" }), _jsx("button", { className: "button secondary", type: "button", onClick: () => downloadFile("/enrollments/export/pdf", "matriculas-estudiantes.pdf"), children: "Exportar matriculas PDF" })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }, children: [_jsx("input", { className: "input", placeholder: "Nombre del filtro", value: filterName, onChange: (e) => setFilterName(e.target.value) }), _jsx("button", { className: "button secondary", type: "button", onClick: saveCurrentFilter, children: "Guardar filtro" }), _jsxs("select", { className: "input", value: selectedFilterId, onChange: (e) => applySavedFilter(e.target.value), children: [_jsx("option", { value: "", children: "Filtros guardados" }), savedFilters.map((f) => (_jsx("option", { value: f.id, children: f.name }, f.id)))] }), _jsx("button", { className: "button secondary", type: "button", disabled: !selectedFilterId, onClick: deleteSavedFilter, children: "Eliminar filtro" })] }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.admissions.loadAdmissionsError, message: loadError, onDismiss: () => setLoadError(""), style: { marginBottom: 8 } }), _jsx(DataTable, { columns: [
                    { key: "student", label: "Estudiante" },
                    { key: "grade", label: "Nivel" },
                    { key: "status", label: "Estado" },
                    { key: "due", label: "Vence aprobacion" },
                    { key: "days", label: "Dias para aprobar" }
                ], rows: [...admissions]
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
                        if (a.status !== "PENDING")
                            return "-";
                        const dueDate = getApprovalDueDate(a.createdAt);
                        if (!dueDate)
                            return "-";
                        const diffDays = getRemainingDays(dueDate.toISOString()) ?? 0;
                        const className = diffDays < 0 ? "due-overdue" : diffDays <= 2 ? "due-soon" : "due-ok";
                        return (_jsxs("span", { className: className, children: [diffDays < 0 ? _jsx("span", { className: "due-alert", children: "!" }) : null, dueDate.toISOString().slice(0, 10)] }));
                    })(),
                    days: (() => {
                        if (a.status !== "PENDING")
                            return "-";
                        const dueDate = getApprovalDueDate(a.createdAt);
                        if (!dueDate)
                            return "-";
                        const diffDays = getRemainingDays(dueDate.toISOString()) ?? 0;
                        if (diffDays < 0)
                            return _jsx("span", { className: "due-overdue", children: "Vencida" });
                        const className = diffDays <= 2 ? "due-soon" : "due-ok";
                        return _jsx("span", { className: className, children: diffDays });
                    })()
                })) }), editingId && (_jsxs("form", { ref: editPanelRef, className: "card", onSubmit: saveEdit, style: { marginTop: 10 }, children: [_jsx("div", { className: "section-title", children: "Editar admision" }), _jsx(ActionFeedback, { tone: "success", title: feedbackTitles.admissions.updateAdmissionSuccess, message: editingMessage, onDismiss: () => setEditingMessage("") }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.admissions.updateAdmissionError, message: editingError, onDismiss: () => setEditingError("") }), _jsxs("label", { children: ["Nombre del estudiante", _jsx("input", { ref: editNameInputRef, className: "input", value: editingForm.studentName, onChange: (e) => setEditingForm({ ...editingForm, studentName: e.target.value }) })] }), _jsxs("label", { children: ["Nivel", _jsx("select", { className: "input", value: editingForm.gradeLevel, onChange: (e) => setEditingForm({ ...editingForm, gradeLevel: e.target.value }), children: gradeOptions.map((g) => (_jsx("option", { value: g.value, children: g.label }, g.value))) })] }), _jsxs("label", { children: ["Notas", _jsx("input", { className: "input", value: editingForm.notes, onChange: (e) => setEditingForm({ ...editingForm, notes: e.target.value }) })] }), _jsx("div", { style: { fontWeight: 600, margin: "10px 0 6px" }, children: "Documentos de admision" }), _jsxs("div", { style: { display: "grid", gap: 6 }, children: [_jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: editingForm.documents.studentIdentity, onChange: (e) => setEditingForm((prev) => ({
                                            ...prev,
                                            documents: { ...prev.documents, studentIdentity: e.target.checked }
                                        })) }), "Registro civil / Tarjeta de identidad del estudiante"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: editingForm.documents.parentsIds, onChange: (e) => setEditingForm((prev) => ({
                                            ...prev,
                                            documents: { ...prev.documents, parentsIds: e.target.checked }
                                        })) }), "Cedulas de los padres"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: editingForm.documents.recentReportCards, onChange: (e) => setEditingForm((prev) => ({
                                            ...prev,
                                            documents: { ...prev.documents, recentReportCards: e.target.checked }
                                        })) }), "Boletines de calificaciones recientes"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: editingForm.documents.previousSchoolCertificates, onChange: (e) => setEditingForm((prev) => ({
                                            ...prev,
                                            documents: { ...prev.documents, previousSchoolCertificates: e.target.checked }
                                        })) }), "Certificados escolares anteriores"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: editingForm.documents.addressProof, onChange: (e) => setEditingForm((prev) => ({
                                            ...prev,
                                            documents: { ...prev.documents, addressProof: e.target.checked }
                                        })) }), "Comprobante de domicilio (recibo de servicios publicos)"] }), _jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: editingForm.documents.vaccinationCard, onChange: (e) => setEditingForm((prev) => ({
                                            ...prev,
                                            documents: { ...prev.documents, vaccinationCard: e.target.checked }
                                        })) }), "Carne de vacunacion"] })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 10 }, children: [_jsx("button", { className: "button", disabled: editingBusy, children: editingBusy ? "Guardando..." : "Guardar cambios" }), _jsx("button", { type: "button", className: "button secondary", onClick: () => {
                                    setEditingId("");
                                    setEditingMessage("");
                                    setEditingError("");
                                }, children: "Cancelar" })] })] })), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }, children: admissions.map((a) => (_jsxs("div", { className: "card", style: { display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", padding: 12 }, children: [_jsx("div", { style: { color: "#6b7280" }, children: a.studentName }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }, children: [_jsx("button", { className: "button secondary", onClick: () => startEdit(a), children: "Editar" }), _jsx("button", { className: "button secondary", onClick: () => setStatus(a.id, "APPROVED"), children: "Aprobar" }), _jsx("button", { className: "button danger", onClick: () => setStatus(a.id, "REJECTED"), children: "Rechazar" })] })] }, a.id))) }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: page <= 1, onClick: () => setPage(page - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#6b7280" }, children: ["Pagina ", page, " de ", Math.max(1, Math.ceil(total / 10))] }), _jsx("button", { className: "button secondary", disabled: page >= Math.ceil(total / 10), onClick: () => setPage(page + 1), children: "Siguiente" })] })] }));
}
