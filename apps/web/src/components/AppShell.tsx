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
  const [branding, setBranding] = useState<BrandingSettings>({
    schoolName: "School Platform",
    logoDataUrl: null,
    primaryColor: "#2563eb",
    secondaryColor: "#0ea5e9",
    accentColor: "#f59e0b"
  });
  const [canEditBranding, setCanEditBranding] = useState(false);

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
    if (!user || user.role !== "ADMIN") {
      setCanEditBranding(false);
      return;
    }
    apiGet("/branding/access")
      .then((res) => setCanEditBranding(Boolean(res?.canEdit)))
      .catch(() => setCanEditBranding(false));
  }, [user]);

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
              <Link to="/admin">Admin</Link>
              <Link to="/teacher">Docente</Link>
              <Link to="/parent">Padre</Link>
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
              {user.role === "ADMIN" && (
                <>
                  <NavLink to="/admin">Dashboard</NavLink>
                  <NavLink to="/admin/usuarios">Usuarios</NavLink>
                  <NavLink to="/admin/admisiones">Admisiones</NavLink>
                  <NavLink to="/admin/asistencia">Asistencia por grado</NavLink>
                  <NavLink to="/admin/observador">Observador</NavLink>
                  <NavLink to="/admin/certificados">Libro de certificados</NavLink>
                  <NavLink to="/admin/cierre-academico">Cierre academico</NavLink>
                  <NavLink to="/admin/horas-docentes">Horas docentes</NavLink>
                  <NavLink to="/admin/finanzas">Finanzas</NavLink>
                  <NavLink to="/admin/notificaciones">Notificaciones</NavLink>
                  {canEditBranding && <NavLink to="/admin/personalizacion">Personalizacion</NavLink>}
                </>
              )}
              {user.role === "TEACHER" && (
                <>
                  <NavLink to="/teacher">Dashboard</NavLink>
                  <NavLink to="/teacher/asistencia">Asistencia por grado</NavLink>
                  <NavLink to="/teacher/calificaciones">Calificaciones</NavLink>
                  <NavLink to="/teacher/observador">Observador</NavLink>
                  <NavLink to="/teacher/comunicaciones">Comunicaciones</NavLink>
                </>
              )}
              {user.role === "PARENT" && (
                <>
                  <NavLink to="/parent">Dashboard</NavLink>
                  <NavLink to="/parent/boletines">Boletines</NavLink>
                  <NavLink to="/parent/observador">Observador</NavLink>
                  <NavLink to="/parent/pagos">Pagos</NavLink>
                  <NavLink to="/parent/comunicados">Comunicados</NavLink>
                </>
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
