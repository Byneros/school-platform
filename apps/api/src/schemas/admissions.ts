import { z } from "zod";

const guardianDocTypeSchema = z.enum(["CEDULA", "CEDULA_EXTRANJERIA", "PASAPORTE"]);
const guardianRelationSchema = z.enum([
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

export const createAdmissionSchema = z.object({
  body: z.object({
    studentName: z.string().min(1),
    gradeLevel: z.enum([
      "PRE_JARDIN",
      "JARDIN",
      "TRANSICION",
      "PRIMERO",
      "SEGUNDO",
      "TERCERO",
      "CUARTO",
      "QUINTO",
      "SEXTO",
      "SEPTIMO",
      "OCTAVO",
      "NOVENO",
      "DECIMO",
      "ONCE",
    ]),
    notes: z.string().optional(),
    documents: z
      .object({
        studentIdentity: z.boolean().optional(),
        parentsIds: z.boolean().optional(),
        recentReportCards: z.boolean().optional(),
        previousSchoolCertificates: z.boolean().optional(),
        addressProof: z.boolean().optional(),
        vaccinationCard: z.boolean().optional(),
      })
      .optional(),
    studentFullName: z.string().optional(),
    studentBirthDate: z.string().optional(),
    studentBirthPlaceDept: z.string().optional(),
    studentBirthPlaceCity: z.string().optional(),
    studentGender: z.string().optional(),
    studentDocType: z.string().optional(),
    studentDocNumber: z.string().optional(),
    studentAddress: z.string().optional(),
    guardianFullName: z.string().optional(),
    guardianDocType: guardianDocTypeSchema.optional(),
    guardianDocNumber: z.string().optional(),
    guardianRelation: guardianRelationSchema.optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional(),
  }),
});

export const updateAdmissionStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  }),
});

export const updateAdmissionSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    studentName: z.string().min(1).optional(),
    gradeLevel: z
      .enum([
        "PRE_JARDIN",
        "JARDIN",
        "TRANSICION",
        "PRIMERO",
        "SEGUNDO",
        "TERCERO",
        "CUARTO",
        "QUINTO",
        "SEXTO",
        "SEPTIMO",
        "OCTAVO",
        "NOVENO",
        "DECIMO",
        "ONCE",
      ])
      .optional(),
    notes: z.string().optional(),
    documents: z
      .object({
        studentIdentity: z.boolean().optional(),
        parentsIds: z.boolean().optional(),
        recentReportCards: z.boolean().optional(),
        previousSchoolCertificates: z.boolean().optional(),
        addressProof: z.boolean().optional(),
        vaccinationCard: z.boolean().optional(),
      })
      .optional(),
    guardianDocType: guardianDocTypeSchema.optional(),
    guardianDocNumber: z.string().optional(),
    guardianRelation: guardianRelationSchema.optional(),
  }),
});
