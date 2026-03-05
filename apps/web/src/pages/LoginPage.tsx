import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === "ADMIN") navigate("/admin");
      if (user.role === "TEACHER") navigate("/teacher");
      if (user.role === "PARENT") navigate("/parent");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.message} (status: ${err.status}${err.path ? `, path: ${err.path}` : ""}${err.requestId ? `, requestId: ${err.requestId}` : ""})`
          : err instanceof Error
            ? err.message
            : "No se pudo iniciar sesion";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="card hero">
        <div>
          <h1 className="hero-title">Gestion escolar clara y rapida</h1>
          <p className="hero-subtitle">
            Centraliza admisiones, notas, comunicaciones y finanzas en un solo lugar.
            Pensado para usuarios no tecnicos.
          </p>
          <div className="stat-row">
            <div className="stat">
              <div className="badge">Administrador</div>
              <div style={{ marginTop: 6, color: "#6b7280" }}>Control total y aprobaciones.</div>
            </div>
            <div className="stat">
              <div className="badge">Docente</div>
              <div style={{ marginTop: 6, color: "#6b7280" }}>Asistencia y calificaciones.</div>
            </div>
            <div className="stat">
              <div className="badge">Padre</div>
              <div style={{ marginTop: 6, color: "#6b7280" }}>Boletines y pagos.</div>
            </div>
          </div>
        </div>
        <form onSubmit={onSubmit}>
          <div className="card" style={{ boxShadow: "none" }}>
            <h2 className="section-title">Ingreso al sistema</h2>
            <label>
              Correo
              <input
                className="input"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@colegio.edu"
              />
            </label>
            <label>
              Contrasena
              <input
                className="input"
                name="password"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
              />
            </label>
            {error && <div style={{ color: "#ef4444", marginTop: 8 }}>{error}</div>}
            <button className="button" style={{ marginTop: 12 }} disabled={loading}>
              {loading ? "Ingresando..." : "Iniciar sesion"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="section-title">Accesos demo</h2>
        <div className="role-cards">
          <div className="role-card">
            <div className="badge">Admin</div>
            <div style={{ marginTop: 6 }}>admin@colegio.edu</div>
            <div style={{ color: "#6b7280" }}>Admin123!</div>
          </div>
          <div className="role-card">
            <div className="badge">Docente</div>
            <div style={{ marginTop: 6 }}>docente@colegio.edu</div>
            <div style={{ color: "#6b7280" }}>Teacher123!</div>
          </div>
          <div className="role-card">
            <div className="badge">Padre</div>
            <div style={{ marginTop: 6 }}>padre@colegio.edu</div>
            <div style={{ color: "#6b7280" }}>Parent123!</div>
          </div>
        </div>
      </div>
    </div>
  );
}
