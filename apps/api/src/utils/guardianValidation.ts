const ALLOWED_GUARDIAN_RELATIONS = new Set([
  "PADRE",
  "MADRE",
  "ABUELO",
  "ABUELA",
  "TIO",
  "TIA",
  "HERMANO",
  "HERMANA",
  "ACUDIENTE_LEGAL",
]);

const ADULT_GUARDIAN_DOC_TYPES = new Set(["CEDULA", "CEDULA_EXTRANJERIA", "PASAPORTE"]);

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

export function getGuardianRules() {
  return {
    relations: Array.from(ALLOWED_GUARDIAN_RELATIONS),
    adultDocTypes: Array.from(ADULT_GUARDIAN_DOC_TYPES),
  };
}

export function validateGuardianRelationAndAdultDoc(input: {
  guardianRelation?: unknown;
  guardianDocType?: unknown;
}) {
  const relation = normalize(input.guardianRelation);
  const guardianDocType = normalize(input.guardianDocType);

  if (!relation) {
    return "El parentesco del acudiente es obligatorio";
  }
  if (!ALLOWED_GUARDIAN_RELATIONS.has(relation)) {
    return "El parentesco del acudiente no es valido. Usa una relacion familiar permitida";
  }

  if (!guardianDocType) {
    return "El tipo de documento del acudiente es obligatorio";
  }
  if (!ADULT_GUARDIAN_DOC_TYPES.has(guardianDocType)) {
    return "El acudiente debe ser mayor de edad y tener documento de adulto valido";
  }

  return null;
}
