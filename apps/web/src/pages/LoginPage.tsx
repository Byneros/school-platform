import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ActionFeedback from "../components/ActionFeedback";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiPost } from "../services/api";
import { feedbackTitles } from "../utils/feedback";

type LoginStep = "credentials" | "2fa" | "register" | "forgot" | "reset";

const initialRegisterForm = {
  schoolCode: "",
  schoolName: "",
  schoolNit: "",
  schoolEmail: "",
  schoolPhone: "",
  schoolAddress: "",
  schoolWebsite: "",
  adminFullName: "",
  adminDocType: "CC",
  adminDocNumber: "",
  adminEmail: "",
  adminPhone: "",
  adminPassword: "",
  adminConfirmPassword: "",
};

function apiMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    return `${err.message} (status: ${err.status}${err.path ? `, path: ${err.path}` : ""}${err.requestId ? `, requestId: ${err.requestId}` : ""})`;
  }
  return err instanceof Error ? err.message : fallback;
}

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
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<LoginStep>("credentials");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("resetToken");
    if (token) {
      setResetToken(token);
      setStep("reset");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const goTo = (nextStep: LoginStep) => {
    setStep(nextStep);
    setError("");
    setSuccess("");
  };

  const navigateByRole = (role: string) => {
    if (role === "SUPER_ADMIN") navigate("/super/colegios");
    if (role === "ADMIN") navigate("/admin");
    if (role === "DEVELOPER") navigate("/dev");
    if (role === "TEACHER") navigate("/teacher");
    if (role === "PARENT") navigate("/parent");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
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
      navigateByRole(result.user.role);
    } catch (err) {
      setError(apiMessage(err, "No se pudo iniciar sesion"));
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
      navigateByRole(user.role);
    } catch (err) {
      setError(apiMessage(err, "No se pudo validar el codigo"));
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
      if (res?.devCode) setTwoFactorDevCode(res.devCode);
      setTwoFactorInfo("Codigo reenviado.");
    } catch (err) {
      setError(apiMessage(err, "No se pudo reenviar el codigo"));
    } finally {
      setLoading(false);
    }
  };

  const submitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await apiPost("/auth/register-school", {
        school: {
          code: registerForm.schoolCode,
          name: registerForm.schoolName,
          nit: registerForm.schoolNit,
          email: registerForm.schoolEmail,
          phone: registerForm.schoolPhone,
          address: registerForm.schoolAddress,
          website: registerForm.schoolWebsite,
        },
        admin: {
          fullName: registerForm.adminFullName,
          docType: registerForm.adminDocType,
          docNumber: registerForm.adminDocNumber,
          email: registerForm.adminEmail,
          phone: registerForm.adminPhone,
          password: registerForm.adminPassword,
          confirmPassword: registerForm.adminConfirmPassword,
        },
      });
      setEmail(registerForm.adminEmail);
      setPassword("");
      setRegisterForm(initialRegisterForm);
      setSuccess("Colegio y administrador creados correctamente. Ya puedes iniciar sesion.");
      setStep("credentials");
    } catch (err) {
      setError(apiMessage(err, "No se pudo completar el registro"));
    } finally {
      setLoading(false);
    }
  };

  const submitForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await apiPost<{ message: string; devToken?: string }>("/auth/forgot-password", {
        email: forgotEmail,
      });
      setSuccess(res.message || "Revisa tu correo para continuar.");
      if (res.devToken) {
        setResetToken(res.devToken);
        setStep("reset");
      }
    } catch (err) {
      setError(apiMessage(err, "No se pudo solicitar la recuperacion"));
    } finally {
      setLoading(false);
    }
  };

  const submitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await apiPost("/auth/reset-password", {
        token: resetToken,
        password: resetPassword,
        confirmPassword: resetConfirmPassword,
      });
      setResetToken("");
      setResetPassword("");
      setResetConfirmPassword("");
      setSuccess("Contrasena actualizada correctamente. Ingresa con tu nueva contrasena.");
      setStep("credentials");
    } catch (err) {
      setError(apiMessage(err, "No se pudo restablecer la contrasena"));
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
    if (role === "SUPER_ADMIN") return "Super administrador";
    if (role === "ADMIN") return "Administrador";
    if (role === "DEVELOPER") return "Desarrollador";
    if (role === "TEACHER") return "Docente";
    if (role === "PARENT") return "Padre";
    return "Usuario";
  };

  const setRegisterValue = (key: keyof typeof initialRegisterForm, value: string) => {
    setRegisterForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="card hero">
        <div>
          <h1 className="hero-title">Gestion escolar clara y rapida</h1>
          <p className="hero-subtitle">
            Centraliza admisiones, notas, comunicaciones y finanzas en un solo lugar. Pensado para
            usuarios no tecnicos.
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

        {step === "credentials" && (
          <form onSubmit={onSubmit}>
            <div className="card" style={{ boxShadow: "none" }}>
              <h2 className="section-title">Ingreso al sistema</h2>
              <label>
                Correo
                <input
                  className="input"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
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
              <ActionFeedback
                tone="success"
                title="Operacion completada"
                message={success}
                onDismiss={() => setSuccess("")}
                style={{ marginTop: 8 }}
              />
              <ActionFeedback
                tone="error"
                title={feedbackTitles.login.accessError}
                message={error}
                onDismiss={() => setError("")}
                style={{ marginTop: 8 }}
              />
              <button className="button" style={{ marginTop: 12 }} disabled={loading}>
                {loading ? "Ingresando..." : "Iniciar sesion"}
              </button>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="button secondary" type="button" onClick={() => goTo("forgot")}>
                  Olvide mi contrasena
                </button>
                <button className="button secondary" type="button" onClick={() => goTo("register")}>
                  Registrar colegio
                </button>
              </div>
            </div>
          </form>
        )}

        {step === "2fa" && (
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
              <ActionFeedback
                tone="error"
                title={feedbackTitles.login.verificationError}
                message={error}
                onDismiss={() => setError("")}
                style={{ marginTop: 8 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="button" type="submit" disabled={loading}>
                  {loading ? "Validando..." : "Validar codigo"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={resendCode}
                  disabled={loading}
                >
                  Reenviar codigo
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={resetTwoFactor}
                  disabled={loading}
                >
                  Cambiar correo
                </button>
              </div>
            </div>
          </form>
        )}

        {step === "register" && (
          <form onSubmit={submitRegistration}>
            <div className="card" style={{ boxShadow: "none" }}>
              <h2 className="section-title">Registrar colegio</h2>
              <label>
                Nombre del colegio
                <input
                  className="input"
                  value={registerForm.schoolName}
                  onChange={(e) => setRegisterValue("schoolName", e.target.value)}
                  placeholder="Colegio Demo"
                />
              </label>
              <div className="grid two">
                <label>
                  Codigo
                  <input
                    className="input"
                    value={registerForm.schoolCode}
                    onChange={(e) => setRegisterValue("schoolCode", e.target.value)}
                    placeholder="COL001"
                  />
                </label>
                <label>
                  NIT
                  <input
                    className="input"
                    value={registerForm.schoolNit}
                    onChange={(e) => setRegisterValue("schoolNit", e.target.value)}
                    placeholder="900000000-1"
                  />
                </label>
              </div>
              <div className="grid two">
                <label>
                  Correo colegio
                  <input
                    className="input"
                    type="email"
                    value={registerForm.schoolEmail}
                    onChange={(e) => setRegisterValue("schoolEmail", e.target.value)}
                    placeholder="contacto@colegio.edu"
                  />
                </label>
                <label>
                  Telefono colegio
                  <input
                    className="input"
                    value={registerForm.schoolPhone}
                    onChange={(e) => setRegisterValue("schoolPhone", e.target.value)}
                    placeholder="3000000000"
                  />
                </label>
              </div>
              <label>
                Direccion
                <input
                  className="input"
                  value={registerForm.schoolAddress}
                  onChange={(e) => setRegisterValue("schoolAddress", e.target.value)}
                  placeholder="Direccion institucional"
                />
              </label>
              <label>
                Sitio web
                <input
                  className="input"
                  value={registerForm.schoolWebsite}
                  onChange={(e) => setRegisterValue("schoolWebsite", e.target.value)}
                  placeholder="https://colegio.edu"
                />
              </label>
              <h3 className="section-title" style={{ marginTop: 16 }}>
                Administrador
              </h3>
              <label>
                Nombre completo
                <input
                  className="input"
                  value={registerForm.adminFullName}
                  onChange={(e) => setRegisterValue("adminFullName", e.target.value)}
                  placeholder="Nombre del administrador"
                />
              </label>
              <div className="grid two">
                <label>
                  Tipo de documento
                  <select
                    className="input"
                    value={registerForm.adminDocType}
                    onChange={(e) => setRegisterValue("adminDocType", e.target.value)}
                  >
                    <option value="CC">CC</option>
                    <option value="TI">TI</option>
                    <option value="CE">CE</option>
                    <option value="PASSPORT">Pasaporte</option>
                    <option value="NIT">NIT</option>
                  </select>
                </label>
                <label>
                  Documento
                  <input
                    className="input"
                    value={registerForm.adminDocNumber}
                    onChange={(e) => setRegisterValue("adminDocNumber", e.target.value)}
                    placeholder="Numero de documento"
                  />
                </label>
              </div>
              <div className="grid two">
                <label>
                  Correo administrador
                  <input
                    className="input"
                    type="email"
                    value={registerForm.adminEmail}
                    onChange={(e) => setRegisterValue("adminEmail", e.target.value)}
                    placeholder="admin@colegio.edu"
                  />
                </label>
                <label>
                  Telefono
                  <input
                    className="input"
                    value={registerForm.adminPhone}
                    onChange={(e) => setRegisterValue("adminPhone", e.target.value)}
                    placeholder="3000000000"
                  />
                </label>
              </div>
              <div className="grid two">
                <label>
                  Contrasena
                  <input
                    className="input"
                    type="password"
                    value={registerForm.adminPassword}
                    onChange={(e) => setRegisterValue("adminPassword", e.target.value)}
                    placeholder="Minimo 8 caracteres"
                  />
                </label>
                <label>
                  Confirmar contrasena
                  <input
                    className="input"
                    type="password"
                    value={registerForm.adminConfirmPassword}
                    onChange={(e) => setRegisterValue("adminConfirmPassword", e.target.value)}
                    placeholder="Repite la contrasena"
                  />
                </label>
              </div>
              <ActionFeedback
                tone="error"
                title="Error de registro"
                message={error}
                onDismiss={() => setError("")}
                style={{ marginTop: 8 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="button" disabled={loading}>
                  {loading ? "Registrando..." : "Crear colegio"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => goTo("credentials")}
                >
                  Volver
                </button>
              </div>
            </div>
          </form>
        )}

        {step === "forgot" && (
          <form onSubmit={submitForgotPassword}>
            <div className="card" style={{ boxShadow: "none" }}>
              <h2 className="section-title">Recuperar contrasena</h2>
              <label>
                Correo
                <input
                  className="input"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="correo@colegio.edu"
                />
              </label>
              <ActionFeedback
                tone="success"
                title="Solicitud enviada"
                message={success}
                onDismiss={() => setSuccess("")}
                style={{ marginTop: 8 }}
              />
              <ActionFeedback
                tone="error"
                title="Error de recuperacion"
                message={error}
                onDismiss={() => setError("")}
                style={{ marginTop: 8 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="button" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar enlace"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => goTo("credentials")}
                >
                  Volver
                </button>
              </div>
            </div>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={submitResetPassword}>
            <div className="card" style={{ boxShadow: "none" }}>
              <h2 className="section-title">Nueva contrasena</h2>
              <label>
                Token
                <input
                  className="input"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Token de recuperacion"
                />
              </label>
              <label>
                Nueva contrasena
                <input
                  className="input"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Minimo 8 caracteres"
                />
              </label>
              <label>
                Confirmar contrasena
                <input
                  className="input"
                  type="password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="Repite la contrasena"
                />
              </label>
              <ActionFeedback
                tone="error"
                title="Error de restablecimiento"
                message={error}
                onDismiss={() => setError("")}
                style={{ marginTop: 8 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="button" disabled={loading}>
                  {loading ? "Guardando..." : "Actualizar contrasena"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => goTo("credentials")}
                >
                  Volver
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
