import { Router } from "express";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import { createFeedbackSchema, reviewFeedbackSchema } from "../schemas/feedback.js";

const router = Router();

router.use(requireAuth);

router.post("/", validate(createFeedbackSchema), async (req, res) => {
  const auth = (req as any).auth;
  const { body } = (req as any).validated;

  const created = await prisma.feedback.create({
    data: {
      userId: auth.userId,
      category: body.category,
      title: body.title.trim(),
      message: body.message.trim()
    },
    select: {
      id: true,
      category: true,
      title: true,
      message: true,
      status: true,
      response: true,
      respondedAt: true,
      createdAt: true,
      updatedAt: true
    }
  });

  res.json(created);
});

router.get("/mine", async (req, res) => {
  const auth = (req as any).auth;
  const data = await prisma.feedback.findMany({
    where: { userId: auth.userId },
    select: {
      id: true,
      category: true,
      title: true,
      message: true,
      status: true,
      response: true,
      respondedAt: true,
      createdAt: true,
      updatedAt: true,
      respondedBy: {
        select: {
          fullName: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  res.json({ data });
});

router.get("/", requireRole(["DEVELOPER"]), async (req, res) => {
  const status = String(req.query.status || "").trim().toUpperCase();
  const category = String(req.query.category || "").trim().toUpperCase();

  const data = await prisma.feedback.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(category ? { category: category as any } : {})
    },
    select: {
      id: true,
      category: true,
      title: true,
      message: true,
      status: true,
      response: true,
      respondedAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true
        }
      },
      respondedBy: {
        select: {
          id: true,
          fullName: true,
          role: true
        }
      }
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300
  });

  res.json({ data });
});

router.patch("/:id/respond", requireRole(["DEVELOPER"]), validate(reviewFeedbackSchema), async (req, res) => {
  const auth = (req as any).auth;
  const { params, body } = (req as any).validated;

  const updated = await prisma.feedback.update({
    where: { id: params.id },
    data: {
      status: body.status,
      response: body.response.trim(),
      respondedById: auth.userId,
      respondedAt: new Date()
    },
    select: {
      id: true,
      category: true,
      title: true,
      message: true,
      status: true,
      response: true,
      respondedAt: true,
      createdAt: true,
      updatedAt: true
    }
  });

  res.json(updated);
});

export default router;
