import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import app from "../src/app.js";
import type { JwtPayload } from "../src/types/index.js";

const prisma = new PrismaClient();
const JWT_SECRET =
  process.env.JWT_SECRET || "assessment-jwt-secret-key-change-in-production";

function makeToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

let applicantId: string;
let applicant2Id: string;
let reviewerId: string;
let applicantToken: string;
let applicant2Token: string;
let reviewerToken: string;

beforeAll(async () => {
  const hash = await bcrypt.hash("test123", 10);

  // Clean up test data only (leave seed data intact)
  await prisma.auditLog.deleteMany({
    where: { actor: { email: { contains: "@test.com" } } },
  });
  await prisma.application.deleteMany({
    where: { applicant: { email: { contains: "@test.com" } } },
  });
  await prisma.user.deleteMany({
    where: { email: { contains: "@test.com" } },
  });

  const applicant = await prisma.user.create({
    data: {
      email: "test-applicant@test.com",
      name: "Test Applicant",
      passwordHash: hash,
      role: "APPLICANT",
    },
  });
  applicantId = applicant.id;
  applicantToken = makeToken({
    userId: applicant.id,
    email: applicant.email,
    role: "APPLICANT",
  });

  const applicant2 = await prisma.user.create({
    data: {
      email: "test-applicant2@test.com",
      name: "Test Applicant 2",
      passwordHash: hash,
      role: "APPLICANT",
    },
  });
  applicant2Id = applicant2.id;
  applicant2Token = makeToken({
    userId: applicant2.id,
    email: applicant2.email,
    role: "APPLICANT",
  });

  const reviewer = await prisma.user.create({
    data: {
      email: "test-reviewer@test.com",
      name: "Test Reviewer",
      passwordHash: hash,
      role: "REVIEWER",
    },
  });
  reviewerId = reviewer.id;
  reviewerToken = makeToken({
    userId: reviewer.id,
    email: reviewer.email,
    role: "REVIEWER",
  });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { actor: { email: { contains: "@test.com" } } },
  });
  await prisma.application.deleteMany({
    where: { applicant: { email: { contains: "@test.com" } } },
  });
  await prisma.user.deleteMany({
    where: { email: { contains: "@test.com" } },
  });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.application.deleteMany();
});

describe("Auth API", () => {
  it("rejects requests without a token", async () => {
    const res = await request(app).get("/api/applications");
    expect(res.status).toBe(401);
  });

  it("rejects requests with invalid token", async () => {
    const res = await request(app)
      .get("/api/applications")
      .set("Authorization", "Bearer invalid-token");
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/login returns token for valid credentials", async () => {
    const hash = await bcrypt.hash("logintest", 10);
    await prisma.user.upsert({
      where: { email: "login-test@test.com" },
      update: { passwordHash: hash },
      create: {
        email: "login-test@test.com",
        name: "Login Test",
        passwordHash: hash,
        role: "APPLICANT",
      },
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login-test@test.com", password: "logintest" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe("APPLICANT");
  });

  it("POST /api/auth/login rejects wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test-applicant@test.com", password: "wrong" });

    expect(res.status).toBe(401);
  });
});

describe("Application CRUD", () => {
  it("creates a draft application", async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({
        title: "Test Application",
        category: "Finance",
        description: "A test",
        amount: 1000,
      });

    expect(res.status).toBe(201);
    expect(res.body.application.status).toBe("DRAFT");
    expect(res.body.application.title).toBe("Test Application");
  });

  it("rejects creating application with missing title", async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ category: "Finance" });

    expect(res.status).toBe(400);
  });

  it("rejects creating application with invalid category", async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ title: "Test", category: "InvalidCategory" });

    expect(res.status).toBe(400);
  });

  it("prevents reviewer from creating applications", async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ title: "Test", category: "Finance" });

    expect(res.status).toBe(403);
  });

  it("allows owner to edit their DRAFT", async () => {
    const create = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ title: "Original", category: "Finance" });

    const res = await request(app)
      .patch(`/api/applications/${create.body.application.id}`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ title: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.application.title).toBe("Updated");
  });

  it("prevents editing another user's application", async () => {
    const create = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ title: "Mine", category: "Finance" });

    const res = await request(app)
      .patch(`/api/applications/${create.body.application.id}`)
      .set("Authorization", `Bearer ${applicant2Token}`)
      .send({ title: "Hacked" });

    expect(res.status).toBe(403);
  });
});

describe("Workflow transitions", () => {
  async function createAndSubmit() {
    const create = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ title: "Workflow Test", category: "Finance", amount: 500 });

    const id = create.body.application.id;

    await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ action: "submit" });

    return id;
  }

  it("full happy path: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED", async () => {
    const id = await createAndSubmit();

    // Start review
    let res = await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ action: "start_review" });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe("UNDER_REVIEW");

    // Approve
    res = await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ action: "approve", comment: "Looks good" });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe("APPROVED");
  });

  it("reject path with required comment", async () => {
    const id = await createAndSubmit();

    await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ action: "start_review" });

    const res = await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ action: "reject", comment: "Insufficient detail" });

    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe("REJECTED");
  });

  it("return for changes cycle", async () => {
    const id = await createAndSubmit();

    await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ action: "start_review" });

    // Return for changes
    let res = await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ action: "return_for_changes", comment: "Need more info" });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe("DRAFT");

    // Applicant can now edit and resubmit
    res = await request(app)
      .patch(`/api/applications/${id}`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ description: "Added more info" });
    expect(res.status).toBe(200);

    res = await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ action: "submit" });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe("SUBMITTED");
  });

  it("creates audit log entries for transitions", async () => {
    const id = await createAndSubmit();

    const res = await request(app)
      .get(`/api/applications/${id}`)
      .set("Authorization", `Bearer ${applicantToken}`);

    expect(res.body.application.auditLogs).toHaveLength(1);
    expect(res.body.application.auditLogs[0].oldStatus).toBe("DRAFT");
    expect(res.body.application.auditLogs[0].newStatus).toBe("SUBMITTED");
  });
});

describe("Authorization enforcement", () => {
  it("returns 403 when applicant tries to approve their own application", async () => {
    const create = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ title: "Self Approve", category: "Finance" });

    const id = create.body.application.id;

    await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ action: "submit" });

    await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ action: "start_review" });

    // Applicant tries to approve — should be 403
    const res = await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ action: "approve" });

    expect(res.status).toBe(403);
  });

  it("returns 403 when applicant tries to start review", async () => {
    const create = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ title: "Self Review", category: "HR" });

    const id = create.body.application.id;

    await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ action: "submit" });

    const res = await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ action: "start_review" });

    expect(res.status).toBe(403);
  });

  it("returns 403 when another applicant tries to submit someone else's draft", async () => {
    const create = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ title: "Other's Draft", category: "IT" });

    const id = create.body.application.id;

    const res = await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${applicant2Token}`)
      .send({ action: "submit" });

    expect(res.status).toBe(403);
  });

  it("returns 409 when editing a non-DRAFT application", async () => {
    const create = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ title: "Edit After Submit", category: "Finance" });

    const id = create.body.application.id;

    await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ action: "submit" });

    const res = await request(app)
      .patch(`/api/applications/${id}`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ title: "Sneaky Edit" });

    expect(res.status).toBe(409);
  });

  it("returns 400 when rejecting without comment", async () => {
    const create = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ title: "No Comment Reject", category: "Legal" });

    const id = create.body.application.id;

    await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ action: "submit" });

    await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ action: "start_review" });

    const res = await request(app)
      .post(`/api/applications/${id}/transition`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ action: "reject" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("comment is required");
  });
});
