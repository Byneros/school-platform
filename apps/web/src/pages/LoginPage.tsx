import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api";

export default function LoginPage() {
  const { login, verifyTwoFactor, resendTwoFactor } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorEmail, setTwoFactorEmail] = useState("");
  const [twoFactorRole, setTwoFactorRole] = useState("");
  const [twoFactorDevCode, setTwoFactorDevCode] = useState("");
  const [twoFactorInfo, setTwoFactorInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.status === "2fa") {
        setTwoFactorToken(result.token);
        setTwoFactorEmail(result.email);
        setTwoFactorRole(result.role || "");
        setTwoFactorDevCode(result.devCode || "");
        setTwoFactorInfo("Se envio un codigo de verificacion al correo registrado.");
        setStep("2fa");
        return;
      }
      const user = result.user;
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

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorToken) return;
    setError("");
    setLoading(true);
    try {
      const user = await verifyTwoFactor(twoFactorToken, twoFactorCode);
      if (user.role === "ADMIN") navigate("/admin");
      if (user.role === "TEACHER") navigate("/teacher");
      if (user.role === "PARENT") navigate("/parent");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.message} (status: ${err.status}${err.path ? `, path: ${err.path}` : ""}${err.requestId ? `, requestId: ${err.requestId}` : ""})`
          : err instanceof Error
            ? err.message
            : "No se pudo validar el codigo";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!twoFactorToken) return;
    setError("");
    setLoading(true);
    try {
      const res = await resendTwoFactor(twoFactorToken);
      if (res?.devCode) {
        setTwoFactorDevCode(res.devCode);
      }
      setTwoFactorInfo("Codigo reenviado.");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.message} (status: ${err.status}${err.path ? `, path: ${err.path}` : ""}${err.requestId ? `, requestId: ${err.requestId}` : ""})`
          : err instanceof Error
            ? err.message
            : "No se pudo reenviar el codigo";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resetTwoFactor = () => {
    setStep("credentials");
    setTwoFactorToken("");
    setTwoFactorCode("");
    setTwoFactorEmail("");
    setTwoFactorRole("");
    setTwoFactorDevCode("");
    setTwoFactorInfo("");
    setError("");
  };

  const roleLabel = (role: string) => {
    if (role === "ADMIN") return "Administrador";
    if (role === "TEACHER") return "Docente";
    if (role === "PARENT") return "Padre";
    return "Usuario";
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
        {step === "credentials" ? (
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
        ) : (
          <form onSubmit={verifyCode}>
            <div className="card" style={{ boxShadow: "none" }}>
              <h2 className="section-title">
                Verificacion de acceso{twoFactorRole ? ` (${roleLabel(twoFactorRole)})` : ""}
              </h2>
              <div style={{ color: "#64748b", marginBottom: 8 }}>
                {twoFactorInfo || "Ingresa el codigo enviado a tu correo."}
              </div>
              {twoFactorEmail && (
                <div style={{ color: "#64748b", marginBottom: 8 }}>
                  Correo: <strong>{twoFactorEmail}</strong>
                </div>
              )}
              {twoFactorDevCode && (
                <div style={{ color: "#0f172a", marginBottom: 8 }}>
                  Codigo (modo dev): <strong>{twoFactorDevCode}</strong>
                </div>
              )}
              <label>
                Codigo de verificacion
                <input
                  className="input"
                  name="twoFactorCode"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="000000"
                />
              </label>
              {error && <div style={{ color: "#ef4444", marginTop: 8 }}>{error}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="button" type="submit" disabled={loading}>
                  {loading ? "Validando..." : "Validar codigo"}
                </button>
                <button className="button secondary" type="button" onClick={resendCode} disabled={loading}>
                  Reenviar codigo
                </button>
                <button className="button secondary" type="button" onClick={resetTwoFactor} disabled={loading}>
                  Cambiar correo
                </button>
              </div>
            </div>
          </form>
        )}
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
