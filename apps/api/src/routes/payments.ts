import { Router } from "express";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import { createPaymentSchema } from "../schemas/payments.js";

const router = Router();

router.get("/", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const page = Number(_req.query.page || 1);
  const pageSize = Number(_req.query.pageSize || 10);
  const search = String(_req.query.search || "").trim();
  const status = String(_req.query.status || "").trim();

  const where = search
    ? {
        invoice: {
          OR: [
            { id: { contains: search, mode: "insensitive" } },
            { student: { fullName: { contains: search, mode: "insensitive" } } },
          ],
        },
      }
    : {};

  const finalWhere = status
    ? { ...where, invoice: { ...(where as any).invoice, status: status as any } }
    : where;

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where: finalWhere,
      include: { invoice: { include: { student: true } } },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.count({ where: finalWhere }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.post(
  "/",
  requireAuth,
  requireRole(["ADMIN"]),
  validate(createPaymentSchema),
  async (req, res) => {
    const { body } = (req as any).validated;
    const payment = await prisma.payment.create({
      data: {
        invoiceId: body.invoiceId,
        amount: body.amount,
        paidAt: new Date(body.paidAt),
        method: body.method,
        reference: body.reference,
      },
    });
    res.json(payment);
  }
);

export default router;
