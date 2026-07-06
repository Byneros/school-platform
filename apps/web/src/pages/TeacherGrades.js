import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
import Section from "../components/Section";
export default function TeacherGrades() {
    const navigate = useNavigate();
    return (_jsx(Section, { title: "Calificaciones", children: _jsxs("div", { className: "card", style: { display: "grid", gap: 12 }, children: [_jsxs("div", { style: { color: "#64748b" }, children: ["La pantalla de Calificaciones fue integrada en ", _jsx("strong", { children: "Tareas y Calificaciones" }), "."] }), _jsx("button", { className: "button", onClick: () => navigate("/teacher/tareas-calificaciones"), children: "Ir a Tareas y Calificaciones" })] }) }));
}
