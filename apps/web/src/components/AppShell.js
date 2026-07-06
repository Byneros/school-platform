import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Outlet, Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../services/api";
export default function AppShell() {
    const { user, logout, initializing, inactivityWarning, extendSession } = useAuth();
    const isDeveloper = user?.role === "DEVELOPER";
    const isAdminLike = user?.role === "ADMIN" || isDeveloper;
    const [branding, setBranding] = useState({
        schoolName: "School Platform",
        logoDataUrl: null,
        primaryColor: "#2563eb",
        secondaryColor: "#0ea5e9",
        accentColor: "#f59e0b"
    });
    const [canEditBranding, setCanEditBranding] = useState(false);
    const [pendingCertificateRequests, setPendingCertificateRequests] = useState(0);
    const [pendingNotifications, setPendingNotifications] = useState(0);
    const [teacherHasObserverAccess, setTeacherHasObserverAccess] = useState(true);
    const loadBranding = () => apiGet("/branding")
        .then((res) => {
        setBranding({
            schoolName: res.schoolName || "School Platform",
            logoDataUrl: res.logoDataUrl || null,
            primaryColor: res.primaryColor || "#2563eb",
            secondaryColor: res.secondaryColor || "#0ea5e9",
            accentColor: res.accentColor || "#f59e0b"
        });
    })
        .catch(() => undefined);
    useEffect(() => {
        loadBranding();
        const onBrandingUpdated = () => loadBranding();
        window.addEventListener("branding-updated", onBrandingUpdated);
        return () => window.removeEventListener("branding-updated", onBrandingUpdated);
    }, []);
    useEffect(() => {
        if (!user || !isAdminLike) {
            setCanEditBranding(false);
            setPendingCertificateRequests(0);
            setPendingNotifications(0);
            return;
        }
        apiGet("/branding/access")
            .then((res) => setCanEditBranding(Boolean(res?.canEdit)))
            .catch(() => setCanEditBranding(false));
    }, [user, isAdminLike]);
    useEffect(() => {
        if (!user || !isAdminLike)
            return;
        const loadPendingRequests = () => {
            apiGet("/reports/certificate/requests?page=1&pageSize=1&status=PENDING")
                .then((res) => setPendingCertificateRequests(Number(res?.total || 0)))
                .catch(() => setPendingCertificateRequests(0));
        };
        const safeLoad = () => {
            if (document.visibilityState !== "visible")
                return;
            loadPendingRequests();
        };
        loadPendingRequests();
        const handler = () => loadPendingRequests();
        const intervalId = window.setInterval(safeLoad, 30000);
        const visibilityHandler = () => safeLoad();
        window.addEventListener("certificate-requests-updated", handler);
        document.addEventListener("visibilitychange", visibilityHandler);
        return () => {
            window.removeEventListener("certificate-requests-updated", handler);
            document.removeEventListener("visibilitychange", visibilityHandler);
            window.clearInterval(intervalId);
        };
    }, [user, isAdminLike]);
    useEffect(() => {
        if (!user || (user.role !== "TEACHER" && !isDeveloper)) {
            setTeacherHasObserverAccess(true);
            return;
        }
        apiGet("/student-observations/allowed-students")
            .then((res) => {
            const list = Array.isArray(res) ? res : [];
            setTeacherHasObserverAccess(list.length > 0);
        })
            .catch(() => setTeacherHasObserverAccess(true));
    }, [user, isDeveloper]);
    useEffect(() => {
        if (!user || !isAdminLike)
            return;
        const loadPending = () => {
            apiGet("/notifications?page=1&pageSize=1&status=PENDING")
                .then((res) => setPendingNotifications(Number(res?.total || 0)))
                .catch(() => setPendingNotifications(0));
        };
        const safeLoad = () => {
            if (document.visibilityState !== "visible")
                return;
            loadPending();
        };
        loadPending();
        const handler = () => loadPending();
        const intervalId = window.setInterval(safeLoad, 30000);
        const visibilityHandler = () => safeLoad();
        window.addEventListener("notifications-updated", handler);
        document.addEventListener("visibilitychange", visibilityHandler);
        return () => {
            window.removeEventListener("notifications-updated", handler);
            document.removeEventListener("visibilitychange", visibilityHandler);
            window.clearInterval(intervalId);
        };
    }, [user, isAdminLike]);
    useEffect(() => {
        document.documentElement.style.setProperty("--brand", branding.primaryColor);
        document.documentElement.style.setProperty("--brand-2", branding.secondaryColor);
        document.documentElement.style.setProperty("--warning", branding.accentColor);
    }, [branding]);
    return (_jsxs("div", { children: [_jsx("div", { className: "navbar", children: _jsxs("div", { className: "navbar-inner container", children: [_jsxs("div", { className: "brand brand-wrap", children: [branding.logoDataUrl && (_jsx("img", { src: branding.logoDataUrl, alt: "Logo del colegio", className: "brand-logo" })), _jsx("span", { children: branding.schoolName })] }), !initializing && user && (_jsxs("div", { className: "nav-links", children: [isAdminLike && _jsx(Link, { to: "/admin", children: "Admin" }), user.role === "TEACHER" && _jsx(Link, { to: "/teacher", children: "Docente" }), user.role === "PARENT" && _jsx(Link, { to: "/parent", children: "Padre" }), isDeveloper && _jsx(Link, { to: "/dev", children: "Developer" }), _jsx(Link, { to: "/feedback", children: "Feedback" }), _jsx("button", { className: "button warning", onClick: logout, children: "Salir" })] }))] }) }), _jsxs("main", { className: "container", style: { paddingTop: 24 }, children: [!initializing && user && inactivityWarning && (_jsxs("div", { className: "card", style: {
                            marginBottom: 12,
                            borderColor: "#fed7aa",
                            background: "#fff7ed",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10
                        }, children: [_jsx("div", { style: { color: "#9a3412", fontWeight: 600 }, children: "Tu sesion se cerrara en 1 minuto por inactividad." }), _jsx("button", { className: "button secondary", onClick: extendSession, children: "Continuar sesion" })] })), !initializing && user && (_jsxs("div", { style: { marginBottom: 12, color: "#6b7280" }, children: ["Sesion activa: ", _jsx("strong", { children: user.fullName }), " (", user.role, ")"] })), !initializing && user ? (_jsxs("div", { className: "app-shell", children: [_jsxs("aside", { className: "sidebar", children: [_jsx("div", { className: "sidebar-title", children: "Navegacion" }), isAdminLike && (_jsxs(_Fragment, { children: [_jsx(NavLink, { to: "/admin", children: "Dashboard" }), _jsx(NavLink, { to: "/admin/alertas", children: "Alertas" }), _jsx(NavLink, { to: "/admin/usuarios", children: "Usuarios" }), _jsx(NavLink, { to: "/admin/admisiones", children: "Admisiones" }), _jsx(NavLink, { to: "/admin/asistencia", children: "Asistencia por grado" }), _jsx(NavLink, { to: "/admin/observador", children: "Observador" }), _jsx(NavLink, { to: "/admin/certificados", children: _jsxs("span", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }, children: [_jsx("span", { children: "Libro de certificados" }), pendingCertificateRequests > 0 && (_jsx("span", { className: "badge badge-warning", children: pendingCertificateRequests }))] }) }), _jsx(NavLink, { to: "/admin/cierre-academico", children: "Cierre academico" }), _jsx(NavLink, { to: "/admin/horas-docentes", children: "Horas docentes" }), _jsx(NavLink, { to: "/admin/finanzas", children: "Finanzas" }), _jsx(NavLink, { to: "/admin/notificaciones", children: _jsxs("span", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }, children: [_jsx("span", { children: "Notificaciones" }), pendingNotifications > 0 && (_jsx("span", { className: "badge badge-warning", children: pendingNotifications }))] }) }), _jsx(NavLink, { to: "/admin/sesiones", children: "Sesiones" }), isDeveloper && _jsx(NavLink, { to: "/admin/cache", children: "Cache" }), canEditBranding && _jsx(NavLink, { to: "/admin/personalizacion", children: "Personalizacion" })] })), user.role === "TEACHER" && !isDeveloper && (_jsxs(_Fragment, { children: [_jsx(NavLink, { to: "/teacher", children: "Dashboard" }), _jsx(NavLink, { to: "/teacher/asistencia", children: "Asistencia por grado" }), _jsx(NavLink, { to: "/teacher/tareas-calificaciones", children: "Tareas y Calificaciones" }), _jsx(NavLink, { to: "/teacher/observador", children: "Observador" }), _jsx(NavLink, { to: "/teacher/comunicaciones", children: "Comunicaciones" }), _jsx(NavLink, { to: "/teacher/sesiones", children: "Sesiones" })] })), user.role === "PARENT" && !isDeveloper && (_jsxs(_Fragment, { children: [_jsx(NavLink, { to: "/parent", children: "Dashboard" }), _jsx(NavLink, { to: "/parent/boletines", children: "Boletines" }), _jsx(NavLink, { to: "/parent/observador", children: "Observador" }), _jsx(NavLink, { to: "/parent/pagos", children: "Pagos" }), _jsx(NavLink, { to: "/parent/comunicados", children: "Comunicados" }), _jsx(NavLink, { to: "/parent/sesiones", children: "Sesiones" })] })), user.role === "DEVELOPER" && (_jsxs(_Fragment, { children: [_jsx(NavLink, { to: "/dev", children: "Zona developer" }), _jsx(NavLink, { to: "/feedback", children: "Feedback" })] })), _jsx("div", { className: "sidebar-title", style: { marginTop: 16 }, children: "Acciones rapidas" }), isAdminLike && (_jsxs("div", { style: { display: "grid", gap: 6 }, children: [_jsx(Link, { className: "button secondary", to: "/admin/alertas", children: "Ver alertas" }), _jsx(Link, { className: "button secondary", to: "/admin/admisiones", children: "Nueva admision" }), _jsx(Link, { className: "button secondary", to: "/admin/usuarios", children: "Crear usuario" }), _jsx(Link, { className: "button secondary", to: "/admin/notificaciones", children: "Crear notificacion" }), _jsx(Link, { className: "button secondary", to: "/admin/observador", children: "Registrar observacion" }), isDeveloper && _jsx(Link, { className: "button secondary", to: "/dev", children: "Abrir consola developer" }), _jsx(Link, { className: "button secondary", to: "/feedback", children: "Ver feedback" })] })), user.role === "TEACHER" && !isDeveloper && (_jsxs("div", { style: { display: "grid", gap: 6 }, children: [_jsx(Link, { className: "button secondary", to: "/teacher/asistencia", children: "Registrar asistencia" }), _jsx(Link, { className: "button secondary", to: "/teacher/tareas-calificaciones", children: "Tareas y calificaciones" }), teacherHasObserverAccess && (_jsx(Link, { className: "button secondary", to: "/teacher/observador", children: "Registrar observacion" })), _jsx(Link, { className: "button secondary", to: "/feedback", children: "Enviar feedback" })] })), user.role === "PARENT" && !isDeveloper && (_jsxs("div", { style: { display: "grid", gap: 6 }, children: [_jsx(Link, { className: "button secondary", to: "/parent/boletines", children: "Ver boletines" }), _jsx(Link, { className: "button secondary", to: "/parent/pagos", children: "Ver pagos" }), _jsx(Link, { className: "button secondary", to: "/parent/comunicados", children: "Ver comunicados" }), _jsx(Link, { className: "button secondary", to: "/feedback", children: "Enviar feedback" })] }))] }), _jsx("div", { children: _jsx(Outlet, {}) })] })) : initializing ? null : (_jsx(Outlet, {}))] })] }));
}
