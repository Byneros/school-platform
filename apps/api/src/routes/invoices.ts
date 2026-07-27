import { Router } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import { createInvoiceSchema, updateInvoiceSchema } from "../schemas/invoices.js";

const router = Router();

router.get("/", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const status = String(req.query.status || "").trim();
  const search = String(req.query.search || "").trim();
  const where: Prisma.InvoiceWhereInput = {
    ...(status ? { status: status as any } : {}),
    ...(search ? { student: { is: { fullName: { contains: search, mode: "insensitive" } } } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { student: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);
  res.json({ data, total, page, pageSize });
});

router.post(
  "/",
  requireAuth,
  requireRole(["ADMIN"]),
  validate(createInvoiceSchema),
  async (req, res) => {
    const { body } = (req as any).validated;
    const invoice = await prisma.invoice.create({
      data: {
        studentId: body.studentId,
        amount: body.amount,
        dueDate: new Date(body.dueDate),
        status: body.status || "PENDING",
      },
    });
    res.json(invoice);
  }
);

router.patch(
  "/:id",
  requireAuth,
  requireRole(["ADMIN"]),
  validate(updateInvoiceSchema),
  async (req, res) => {
    const { params, body } = (req as any).validated;
    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        ...(body.amount !== undefined ? { amount: body.amount } : {}),
        ...(body.dueDate ? { dueDate: new Date(body.dueDate) } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
    });
    res.json(invoice);
  }
);

export default router;
