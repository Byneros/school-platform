import { z } from "zod";

export const createNotificationSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    studentId: z.string().min(1).optional(),
    legalReference: z.enum(["LEY_1620_2013", "DECRETO_1965_2013", "LEY_115_1994", "LEY_1098_2006"]).optional()
  })
});

export const createAdminNotificationSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    audience: z.enum(["PARENTS", "TEACHERS", "BOTH"]),
    legalReference: z.enum(["LEY_1620_2013", "DECRETO_1965_2013", "LEY_115_1994", "LEY_1098_2006"]).optional(),
    studentId: z.string().min(1).optional(),
    targetUserId: z.string().min(1).optional()
  })
});

export const approveNotificationSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  })
});

export const updateNotificationSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  }),
  body: z.object({
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional()
  })
});
