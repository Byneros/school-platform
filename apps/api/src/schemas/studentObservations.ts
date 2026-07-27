import { z } from "zod";

const observationTypeSchema = z.enum(["ACADEMIC", "COEXISTENCE"]);
const coexistenceProtocolSchema = z.enum(["TIPO_I", "TIPO_II", "TIPO_III"]);

export const createStudentObservationSchema = z.object({
  body: z.object({
    studentId: z.string().min(1),
    date: z.string().optional(),
    type: observationTypeSchema,
    coexistenceProtocol: coexistenceProtocolSchema.optional(),
    coexistenceOffense: z.string().min(2).optional(),
    followUpDate: z.string().optional(),
    autoDetail: z.boolean().optional(),
    detail: z.string().min(5),
  }),
});

export const updateStudentObservationSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    date: z.string().optional(),
    type: observationTypeSchema.optional(),
    coexistenceProtocol: coexistenceProtocolSchema.optional(),
    coexistenceOffense: z.string().min(2).optional(),
    followUpDate: z.string().optional(),
    followUpCompleted: z.boolean().optional(),
    detail: z.string().min(5).optional(),
  }),
});
