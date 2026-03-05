export type GradeLevel =
  | "PRE_JARDIN"
  | "JARDIN"
  | "TRANSICION"
  | "PRIMERO"
  | "SEGUNDO"
  | "TERCERO"
  | "CUARTO"
  | "QUINTO"
  | "SEXTO"
  | "SEPTIMO"
  | "OCTAVO"
  | "NOVENO"
  | "DECIMO"
  | "ONCE";

export const gradeOptions: Array<{ value: GradeLevel; label: string }> = [
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

export function gradeLabel(value?: string) {
  const found = gradeOptions.find((o) => o.value === value);
  return found ? found.label : value || "";
}
