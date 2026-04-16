import { useEffect, useState } from "react";
import { Outlet, Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../services/api";

type BrandingSettings = {
  schoolName: string;
  logoDataUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export default function AppShell() {
  const { user, logout, initializing, inactivityWarning, extendSession } = useAuth();
  const isDeveloper = user?.role === "DEVELOPER";
  const isAdminLike = user?.role === "ADMIN" || isDeveloper;
  const [branding, setBranding] = useState<BrandingSettings>({
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

  const loadBranding = () =>
    apiGet("/branding")
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
    if (!user || !isAdminLike) return;
    const loadPendingRequests = () => {
      apiGet("/reports/certificate/requests?page=1&pageSize=1&status=PENDING")
        .then((res) => setPendingCertificateRequests(Number(res?.total || 0)))
        .catch(() => setPendingCertificateRequests(0));
    };
    const safeLoad = () => {
      if (document.visibilityState !== "visible") return;
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
    if (!user || !isAdminLike) return;
    const loadPending = () => {
      apiGet("/notifications?page=1&pageSize=1&status=PENDING")
        .then((res) => setPendingNotifications(Number(res?.total || 0)))
        .catch(() => setPendingNotifications(0));
    };
    const safeLoad = () => {
      if (document.visibilityState !== "visible") return;
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

  return (
    <div>
      <div className="navbar">
        <div className="navbar-inner container">
          <div className="brand brand-wrap">
            {branding.logoDataUrl && (
              <img src={branding.logoDataUrl} alt="Logo del colegio" className="brand-logo" />
            )}
            <span>{branding.schoolName}</span>
          </div>
          {!initializing && user && (
            <div className="nav-links">
              {isAdminLike && <Link to="/admin">Admin</Link>}
              {user.role === "TEACHER" && <Link to="/teacher">Docente</Link>}
              {user.role === "PARENT" && <Link to="/parent">Padre</Link>}
              {isDeveloper && <Link to="/dev">Developer</Link>}
              <Link to="/feedback">Feedback</Link>
              <button className="button warning" onClick={logout}>Salir</button>
            </div>
          )}
        </div>
      </div>
      <main className="container" style={{ paddingTop: 24 }}>
        {!initializing && user && inactivityWarning && (
          <div
            className="card"
            style={{
              marginBottom: 12,
              borderColor: "#fed7aa",
              background: "#fff7ed",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10
            }}
          >
            <div style={{ color: "#9a3412", fontWeight: 600 }}>
              Tu sesion se cerrara en 1 minuto por inactividad.
            </div>
            <button className="button secondary" onClick={extendSession}>
              Continuar sesion
            </button>
          </div>
        )}
        {!initializing && user && (
          <div style={{ marginBottom: 12, color: "#6b7280" }}>
            Sesion activa: <strong>{user.fullName}</strong> ({user.role})
          </div>
        )}
        {!initializing && user ? (
          <div className="app-shell">
            <aside className="sidebar">
              <div className="sidebar-title">Navegacion</div>
              {isAdminLike && (
                <>
                  <NavLink to="/admin">Dashboard</NavLink>
                  <NavLink to="/admin/alertas">Alertas</NavLink>
                  <NavLink to="/admin/usuarios">Usuarios</NavLink>
                  <NavLink to="/admin/admisiones">Admisiones</NavLink>
                  <NavLink to="/admin/asistencia">Asistencia por grado</NavLink>
                  <NavLink to="/admin/observador">Observador</NavLink>
                  <NavLink to="/admin/certificados">
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span>Libro de certificados</span>
                      {pendingCertificateRequests > 0 && (
                        <span className="badge badge-warning">{pendingCertificateRequests}</span>
                      )}
                    </span>
                  </NavLink>
                  <NavLink to="/admin/cierre-academico">Cierre academico</NavLink>
                  <NavLink to="/admin/horas-docentes">Horas docentes</NavLink>
                  <NavLink to="/admin/finanzas">Finanzas</NavLink>
                  <NavLink to="/admin/notificaciones">
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span>Notificaciones</span>
                      {pendingNotifications > 0 && (
                        <span className="badge badge-warning">{pendingNotifications}</span>
                      )}
                    </span>
                  </NavLink>
                  <NavLink to="/admin/sesiones">Sesiones</NavLink>
                  <NavLink to="/admin/cache">Cache</NavLink>
                  {canEditBranding && <NavLink to="/admin/personalizacion">Personalizacion</NavLink>}
                </>
              )}
              {user.role === "TEACHER" && !isDeveloper && (
                <>
                  <NavLink to="/teacher">Dashboard</NavLink>
                  <NavLink to="/teacher/asistencia">Asistencia por grado</NavLink>
                  <NavLink to="/teacher/tareas-calificaciones">Tareas y Calificaciones</NavLink>
                  <NavLink to="/teacher/observador">Observador</NavLink>
                  <NavLink to="/teacher/comunicaciones">Comunicaciones</NavLink>
                  <NavLink to="/teacher/sesiones">Sesiones</NavLink>
                </>
              )}
              {user.role === "PARENT" && !isDeveloper && (
                <>
                  <NavLink to="/parent">Dashboard</NavLink>
                  <NavLink to="/parent/boletines">Boletines</NavLink>
                  <NavLink to="/parent/observador">Observador</NavLink>
                  <NavLink to="/parent/pagos">Pagos</NavLink>
                  <NavLink to="/parent/comunicados">Comunicados</NavLink>
                  <NavLink to="/parent/sesiones">Sesiones</NavLink>
                </>
              )}
              {user.role === "DEVELOPER" && (
                <>
                  <NavLink to="/dev">Zona developer</NavLink>
                  <NavLink to="/feedback">Feedback</NavLink>
                </>
              )}
              <div className="sidebar-title" style={{ marginTop: 16 }}>Acciones rapidas</div>
              {isAdminLike && (
                <div style={{ display: "grid", gap: 6 }}>
                  <Link className="button secondary" to="/admin/alertas">Ver alertas</Link>
                  <Link className="button secondary" to="/admin/admisiones">Nueva admision</Link>
                  <Link className="button secondary" to="/admin/usuarios">Crear usuario</Link>
                  <Link className="button secondary" to="/admin/notificaciones">Crear notificacion</Link>
                  <Link className="button secondary" to="/admin/observador">Registrar observacion</Link>
                  {isDeveloper && <Link className="button secondary" to="/dev">Abrir consola developer</Link>}
                  <Link className="button secondary" to="/feedback">Ver feedback</Link>
                </div>
              )}
              {user.role === "TEACHER" && !isDeveloper && (
                <div style={{ display: "grid", gap: 6 }}>
                  <Link className="button secondary" to="/teacher/asistencia">Registrar asistencia</Link>
                  <Link className="button secondary" to="/teacher/tareas-calificaciones">Tareas y calificaciones</Link>
                  {teacherHasObserverAccess && (
                    <Link className="button secondary" to="/teacher/observador">Registrar observacion</Link>
                  )}
                  <Link className="button secondary" to="/feedback">Enviar feedback</Link>
                </div>
              )}
              {user.role === "PARENT" && !isDeveloper && (
                <div style={{ display: "grid", gap: 6 }}>
                  <Link className="button secondary" to="/parent/boletines">Ver boletines</Link>
                  <Link className="button secondary" to="/parent/pagos">Ver pagos</Link>
                  <Link className="button secondary" to="/parent/comunicados">Ver comunicados</Link>
                  <Link className="button secondary" to="/feedback">Enviar feedback</Link>
                </div>
              )}
            </aside>
            <div>
              <Outlet />
            </div>
          </div>
        ) : initializing ? null : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
