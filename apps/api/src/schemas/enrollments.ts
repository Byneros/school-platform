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
  "ACUDIENTE_LEGAL"
]);

export const createEnrollmentSchema = z.object({
  body: z.object({
    studentId: z.string().min(1).optional(),
    classId: z.string().min(1),
    year: z.number().int(),
    status: z.string().min(1),
    admissionId: z.string().optional(),
    studentFullName: z.string().min(1),
    studentBirthDate: z.string().optional(),
    studentBirthPlaceDept: z.string().optional(),
    studentBirthPlaceCity: z.string().optional(),
    studentGender: z.string().optional(),
    studentDocType: z.string().optional(),
    studentDocNumber: z.string().optional(),
    studentGradeLevel: z.string().min(1),
    studentAddress: z.string().optional(),
    guardianFullName: z.string().optional(),
    guardianDocType: guardianDocTypeSchema,
    guardianDocNumber: z.string().optional(),
    guardianRelation: guardianRelationSchema,
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional(),
    documents: z
      .object({
        civilRegistry: z.boolean().optional(),
        guardianId: z.boolean().optional(),
        residenceProof: z.boolean().optional(),
        healthCertificate: z.boolean().optional(),
        vaccinationCard: z.boolean().optional(),
        previousReport: z.boolean().optional()
      })
      .optional(),
    documentsNotes: z.string().optional()
  })
});

export const updateEnrollmentSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  }),
  body: z.object({
    classId: z.string().min(1).optional(),
    year: z.number().int().optional(),
    status: z.string().min(1).optional(),
    studentFullName: z.string().min(1).optional(),
    studentBirthDate: z.string().optional(),
    studentBirthPlaceDept: z.string().min(1).optional(),
    studentBirthPlaceCity: z.string().min(1).optional(),
    studentGender: z.string().min(1).optional(),
    studentDocType: z.string().min(1).optional(),
    studentDocNumber: z.string().min(1).optional(),
    studentGradeLevel: z.string().min(1).optional(),
    studentAddress: z.string().min(1).optional(),
    guardianFullName: z.string().min(1).optional(),
    guardianDocType: guardianDocTypeSchema.optional(),
    guardianDocNumber: z.string().min(1).optional(),
    guardianRelation: guardianRelationSchema.optional(),
    contactPhone: z.string().min(1).optional(),
    contactEmail: z.string().email().optional(),
    documents: z
      .object({
        civilRegistry: z.boolean().optional(),
        guardianId: z.boolean().optional(),
        residenceProof: z.boolean().optional(),
        healthCertificate: z.boolean().optional(),
        vaccinationCard: z.boolean().optional(),
        previousReport: z.boolean().optional()
      })
      .optional(),
    documentsNotes: z.string().optional()
  })
});
