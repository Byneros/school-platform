import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ActionFeedback from "../components/ActionFeedback";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api";
import { feedbackTitles } from "../utils/feedback";
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
    const [step, setStep] = useState("credentials");
    const onSubmit = async (e) => {
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
            if (user.role === "ADMIN")
                navigate("/admin");
            if (user.role === "DEVELOPER")
                navigate("/dev");
            if (user.role === "TEACHER")
                navigate("/teacher");
            if (user.role === "PARENT")
                navigate("/parent");
        }
        catch (err) {
            const message = err instanceof ApiError
                ? `${err.message} (status: ${err.status}${err.path ? `, path: ${err.path}` : ""}${err.requestId ? `, requestId: ${err.requestId}` : ""})`
                : err instanceof Error
                    ? err.message
                    : "No se pudo iniciar sesion";
            setError(message);
        }
        finally {
            setLoading(false);
        }
    };
    const verifyCode = async (e) => {
        e.preventDefault();
        if (!twoFactorToken)
            return;
        setError("");
        setLoading(true);
        try {
            const user = await verifyTwoFactor(twoFactorToken, twoFactorCode);
            if (user.role === "ADMIN")
                navigate("/admin");
            if (user.role === "DEVELOPER")
                navigate("/dev");
            if (user.role === "TEACHER")
                navigate("/teacher");
            if (user.role === "PARENT")
                navigate("/parent");
        }
        catch (err) {
            const message = err instanceof ApiError
                ? `${err.message} (status: ${err.status}${err.path ? `, path: ${err.path}` : ""}${err.requestId ? `, requestId: ${err.requestId}` : ""})`
                : err instanceof Error
                    ? err.message
                    : "No se pudo validar el codigo";
            setError(message);
        }
        finally {
            setLoading(false);
        }
    };
    const resendCode = async () => {
        if (!twoFactorToken)
            return;
        setError("");
        setLoading(true);
        try {
            const res = await resendTwoFactor(twoFactorToken);
            if (res?.devCode) {
                setTwoFactorDevCode(res.devCode);
            }
            setTwoFactorInfo("Codigo reenviado.");
        }
        catch (err) {
            const message = err instanceof ApiError
                ? `${err.message} (status: ${err.status}${err.path ? `, path: ${err.path}` : ""}${err.requestId ? `, requestId: ${err.requestId}` : ""})`
                : err instanceof Error
                    ? err.message
                    : "No se pudo reenviar el codigo";
            setError(message);
        }
        finally {
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
    const roleLabel = (role) => {
        if (role === "ADMIN")
            return "Administrador";
        if (role === "DEVELOPER")
            return "Desarrollador";
        if (role === "TEACHER")
            return "Docente";
        if (role === "PARENT")
            return "Padre";
        return "Usuario";
    };
    return (_jsxs("div", { className: "grid", style: { gap: 24 }, children: [_jsxs("div", { className: "card hero", children: [_jsxs("div", { children: [_jsx("h1", { className: "hero-title", children: "Gestion escolar clara y rapida" }), _jsx("p", { className: "hero-subtitle", children: "Centraliza admisiones, notas, comunicaciones y finanzas en un solo lugar. Pensado para usuarios no tecnicos." }), _jsxs("div", { className: "stat-row", children: [_jsxs("div", { className: "stat", children: [_jsx("div", { className: "badge", children: "Administrador" }), _jsx("div", { style: { marginTop: 6, color: "#6b7280" }, children: "Control total y aprobaciones." })] }), _jsxs("div", { className: "stat", children: [_jsx("div", { className: "badge", children: "Docente" }), _jsx("div", { style: { marginTop: 6, color: "#6b7280" }, children: "Asistencia y calificaciones." })] }), _jsxs("div", { className: "stat", children: [_jsx("div", { className: "badge", children: "Padre" }), _jsx("div", { style: { marginTop: 6, color: "#6b7280" }, children: "Boletines y pagos." })] })] })] }), step === "credentials" ? (_jsx("form", { onSubmit: onSubmit, children: _jsxs("div", { className: "card", style: { boxShadow: "none" }, children: [_jsx("h2", { className: "section-title", children: "Ingreso al sistema" }), _jsxs("label", { children: ["Correo", _jsx("input", { className: "input", name: "email", type: "email", inputMode: "email", autoComplete: "email", autoCapitalize: "none", autoCorrect: "off", spellCheck: false, value: email, onChange: (e) => setEmail(e.target.value), placeholder: "correo@colegio.edu" })] }), _jsxs("label", { children: ["Contrasena", _jsx("input", { className: "input", name: "password", autoComplete: "current-password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "********" })] }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.login.accessError, message: error, onDismiss: () => setError(""), style: { marginTop: 8 } }), _jsx("button", { className: "button", style: { marginTop: 12 }, disabled: loading, children: loading ? "Ingresando..." : "Iniciar sesion" })] }) })) : (_jsx("form", { onSubmit: verifyCode, children: _jsxs("div", { className: "card", style: { boxShadow: "none" }, children: [_jsxs("h2", { className: "section-title", children: ["Verificacion de acceso", twoFactorRole ? ` (${roleLabel(twoFactorRole)})` : ""] }), _jsx("div", { style: { color: "#64748b", marginBottom: 8 }, children: twoFactorInfo || "Ingresa el codigo enviado a tu correo." }), twoFactorEmail && (_jsxs("div", { style: { color: "#64748b", marginBottom: 8 }, children: ["Correo: ", _jsx("strong", { children: twoFactorEmail })] })), twoFactorDevCode && (_jsxs("div", { style: { color: "#0f172a", marginBottom: 8 }, children: ["Codigo (modo dev): ", _jsx("strong", { children: twoFactorDevCode })] })), _jsxs("label", { children: ["Codigo de verificacion", _jsx("input", { className: "input", name: "twoFactorCode", value: twoFactorCode, onChange: (e) => setTwoFactorCode(e.target.value), placeholder: "000000" })] }), _jsx(ActionFeedback, { tone: "error", title: feedbackTitles.login.verificationError, message: error, onDismiss: () => setError(""), style: { marginTop: 8 } }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }, children: [_jsx("button", { className: "button", type: "submit", disabled: loading, children: loading ? "Validando..." : "Validar codigo" }), _jsx("button", { className: "button secondary", type: "button", onClick: resendCode, disabled: loading, children: "Reenviar codigo" }), _jsx("button", { className: "button secondary", type: "button", onClick: resetTwoFactor, disabled: loading, children: "Cambiar correo" })] })] }) }))] }), _jsxs("div", { className: "card", children: [_jsx("h2", { className: "section-title", children: "Accesos demo" }), _jsxs("div", { className: "role-cards", children: [_jsxs("div", { className: "role-card", children: [_jsx("div", { className: "badge", children: "Admin" }), _jsx("div", { style: { marginTop: 6 }, children: "admin@colegio.edu" }), _jsx("div", { style: { color: "#6b7280" }, children: "Admin123!" })] }), _jsxs("div", { className: "role-card", children: [_jsx("div", { className: "badge", children: "Docente" }), _jsx("div", { style: { marginTop: 6 }, children: "docente@colegio.edu" }), _jsx("div", { style: { color: "#6b7280" }, children: "Teacher123!" })] }), _jsxs("div", { className: "role-card", children: [_jsx("div", { className: "badge", children: "Padre" }), _jsx("div", { style: { marginTop: 6 }, children: "padre@colegio.edu" }), _jsx("div", { style: { color: "#6b7280" }, children: "Parent123!" })] })] })] })] }));
}
