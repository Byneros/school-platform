export const gradeOptions = [
    { value: "PRE_JARDIN", label: "Pre-jardin" },
    { value: "JARDIN", label: "Jardin" },
    { value: "TRANSICION", label: "Transicion" },
    { value: "PRIMERO", label: "Primero" },
    { value: "SEGUNDO", label: "Segundo" },
    { value: "TERCERO", label: "Tercero" },
    { value: "CUARTO", label: "Cuarto" },
    { value: "QUINTO", label: "Quinto" },
    { value: "SEXTO", label: "Sexto" },
    { value: "SEPTIMO", label: "Septimo" },
    { value: "OCTAVO", label: "Octavo" },
    { value: "NOVENO", label: "Noveno" },
    { value: "DECIMO", label: "Decimo" },
    { value: "ONCE", label: "Once" }
];
export function gradeLabel(value) {
    const found = gradeOptions.find((o) => o.value === value);
    return found ? found.label : value || "";
}
