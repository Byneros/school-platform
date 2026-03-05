import { z } from "zod";

export const createAttendanceSchema = z.object({
  body: z.object({
    enrollmentId: z.string().min(1),
    date: z.string().datetime(),
    status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
    notes: z.string().optional()
  })
});

export const createAttendanceBulkSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          enrollmentId: z.string().min(1),
          date: z.string().datetime(),
          status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
          notes: z.string().optional()
        })
      )
      .min(1)
      .max(300)
  })
});
