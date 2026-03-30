import React from "react";
import { useNavigate } from "react-router-dom";
import Section from "../components/Section";

export default function TeacherGrades() {
  const navigate = useNavigate();
  return (
    <Section title="Calificaciones">
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "#64748b" }}>
          La pantalla de Calificaciones fue integrada en <strong>Tareas y Calificaciones</strong>.
        </div>
        <button className="button" onClick={() => navigate("/teacher/tareas-calificaciones")}>
          Ir a Tareas y Calificaciones
        </button>
      </div>
    </Section>
  );
}
