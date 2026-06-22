import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  validateTransition,
  getAvailableActions,
  type TransitionAction,
} from "../services/state-machine.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

const CATEGORIES = [
  "General",
  "Finance",
  "HR",
  "IT",
  "Operations",
  "Legal",
] as const;

const createApplicationSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  category: z.enum(CATEGORIES, {
    errorMap: () => ({ message: `Category must be one of: ${CATEGORIES.join(", ")}` }),
  }),
  description: z.string().max(2000).default(""),
  amount: z.number().positive("Amount must be positive").nullable().optional(),
});

const updateApplicationSchema = createApplicationSchema.partial();

const transitionSchema = z.object({
  action: z.enum([
    "submit",
    "start_review",
    "approve",
    "reject",
    "return_for_changes",
  ]),
  comment: z.string().max(1000).optional(),
});

// GET /applications — list applications
// Applicants see their own; Reviewers see submitted/under_review (+ optional filter)
router.get("/", async (req, res) => {
  const user = req.user!;
  const statusFilter = req.query.status as string | undefined;

  if (user.role === "APPLICANT") {
    const applications = await prisma.application.findMany({
      where: {
        applicantId: user.userId,
        ...(statusFilter ? { status: statusFilter as any } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        applicant: { select: { id: true, name: true, email: true } },
      },
    });
    res.json({ applications });
    return;
  }

  // Reviewer: see all non-draft applications (or filter by status)
  const applications = await prisma.application.findMany({
    where: statusFilter
      ? { status: statusFilter as any }
      : { status: { not: "DRAFT" } },
    orderBy: { updatedAt: "desc" },
    include: {
      applicant: { select: { id: true, name: true, email: true } },
    },
  });
  res.json({ applications });
});

// GET /applications/:id — get single application with audit trail
router.get("/:id", async (req, res) => {
  const user = req.user!;
  const application = await prisma.application.findUnique({
    where: { id: req.params.id },
    include: {
      applicant: { select: { id: true, name: true, email: true } },
      auditLogs: {
        orderBy: { createdAt: "asc" },
        include: {
          actor: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  // Applicants can only see their own
  if (user.role === "APPLICANT" && application.applicantId !== user.userId) {
    res.status(403).json({ error: "You can only view your own applications." });
    return;
  }

  // Reviewers should not see drafts that aren't theirs
  if (user.role === "REVIEWER" && application.status === "DRAFT") {
    res.status(403).json({ error: "Reviewers cannot view draft applications." });
    return;
  }

  const isOwner = application.applicantId === user.userId;
  const availableActions = getAvailableActions(
    application.status,
    user.role,
    isOwner
  );

  res.json({ application, availableActions });
});

// POST /applications — create a new draft (applicants only)
router.post("/", authorize("APPLICANT"), async (req, res) => {
  const parsed = createApplicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed.",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const application = await prisma.application.create({
    data: {
      ...parsed.data,
      amount: parsed.data.amount ?? null,
      applicantId: req.user!.userId,
      status: "DRAFT",
    },
    include: {
      applicant: { select: { id: true, name: true, email: true } },
    },
  });

  res.status(201).json({ application });
});

// PATCH /applications/:id — update a draft (owner only)
router.patch("/:id", authorize("APPLICANT"), async (req, res) => {
  const application = await prisma.application.findUnique({
    where: { id: req.params.id },
  });

  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  if (application.applicantId !== req.user!.userId) {
    res.status(403).json({ error: "You can only edit your own applications." });
    return;
  }

  if (application.status !== "DRAFT") {
    res.status(409).json({
      error: "Only applications in DRAFT status can be edited.",
    });
    return;
  }

  const parsed = updateApplicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed.",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const updated = await prisma.application.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: {
      applicant: { select: { id: true, name: true, email: true } },
    },
  });

  res.json({ application: updated });
});

// POST /applications/:id/transition — perform a state transition
router.post("/:id/transition", async (req, res) => {
  const parsed = transitionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed.",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { action, comment } = parsed.data;
  const user = req.user!;

  const application = await prisma.application.findUnique({
    where: { id: req.params.id },
  });

  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  const isOwner = application.applicantId === user.userId;

  const result = validateTransition(
    application.status,
    action as TransitionAction,
    user.role,
    isOwner,
    comment
  );

  if (!result.valid) {
    res.status(result.statusCode!).json({ error: result.error });
    return;
  }

  // Perform the transition and create audit log in a transaction
  const updated = await prisma.$transaction(async (tx) => {
    const updatedApp = await tx.application.update({
      where: { id: application.id },
      data: { status: result.rule!.to },
      include: {
        applicant: { select: { id: true, name: true, email: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        applicationId: application.id,
        actorId: user.userId,
        oldStatus: application.status,
        newStatus: result.rule!.to,
        comment: comment?.trim() || null,
      },
    });

    return updatedApp;
  });

  const availableActions = getAvailableActions(
    updated.status,
    user.role,
    isOwner
  );

  res.json({ application: updated, availableActions });
});

// DELETE /applications/:id — delete a draft (owner only)
router.delete("/:id", authorize("APPLICANT"), async (req, res) => {
  const application = await prisma.application.findUnique({
    where: { id: req.params.id },
  });

  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  if (application.applicantId !== req.user!.userId) {
    res.status(403).json({ error: "You can only delete your own applications." });
    return;
  }

  if (application.status !== "DRAFT") {
    res.status(409).json({
      error: "Only applications in DRAFT status can be deleted.",
    });
    return;
  }

  await prisma.application.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
