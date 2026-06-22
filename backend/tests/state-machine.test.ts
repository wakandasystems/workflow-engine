import { describe, it, expect } from "vitest";
import {
  validateTransition,
  getAvailableActions,
} from "../src/services/state-machine.js";

describe("State Machine", () => {
  describe("Legal transitions", () => {
    it("allows applicant to submit a DRAFT they own", () => {
      const result = validateTransition("DRAFT", "submit", "APPLICANT", true);
      expect(result.valid).toBe(true);
      expect(result.rule?.to).toBe("SUBMITTED");
    });

    it("allows reviewer to start review on SUBMITTED", () => {
      const result = validateTransition(
        "SUBMITTED",
        "start_review",
        "REVIEWER",
        false
      );
      expect(result.valid).toBe(true);
      expect(result.rule?.to).toBe("UNDER_REVIEW");
    });

    it("allows reviewer to approve UNDER_REVIEW", () => {
      const result = validateTransition(
        "UNDER_REVIEW",
        "approve",
        "REVIEWER",
        false
      );
      expect(result.valid).toBe(true);
      expect(result.rule?.to).toBe("APPROVED");
    });

    it("allows reviewer to reject UNDER_REVIEW with comment", () => {
      const result = validateTransition(
        "UNDER_REVIEW",
        "reject",
        "REVIEWER",
        false,
        "Not enough detail"
      );
      expect(result.valid).toBe(true);
      expect(result.rule?.to).toBe("REJECTED");
    });

    it("allows reviewer to return for changes with comment", () => {
      const result = validateTransition(
        "UNDER_REVIEW",
        "return_for_changes",
        "REVIEWER",
        false,
        "Please add more information"
      );
      expect(result.valid).toBe(true);
      expect(result.rule?.to).toBe("DRAFT");
    });
  });

  describe("Illegal transitions", () => {
    it("rejects applicant submitting a non-DRAFT application", () => {
      const result = validateTransition(
        "SUBMITTED",
        "submit",
        "APPLICANT",
        true
      );
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(409);
    });

    it("rejects reviewer trying to submit (wrong role)", () => {
      const result = validateTransition("DRAFT", "submit", "REVIEWER", false);
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(403);
    });

    it("rejects applicant trying to approve (wrong role)", () => {
      const result = validateTransition(
        "UNDER_REVIEW",
        "approve",
        "APPLICANT",
        true
      );
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(403);
    });

    it("rejects applicant trying to reject (wrong role)", () => {
      const result = validateTransition(
        "UNDER_REVIEW",
        "reject",
        "APPLICANT",
        true,
        "some comment"
      );
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(403);
    });

    it("rejects non-owner applicant trying to submit", () => {
      const result = validateTransition("DRAFT", "submit", "APPLICANT", false);
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(403);
    });

    it("rejects reject without comment", () => {
      const result = validateTransition(
        "UNDER_REVIEW",
        "reject",
        "REVIEWER",
        false
      );
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain("comment is required");
    });

    it("rejects return_for_changes without comment", () => {
      const result = validateTransition(
        "UNDER_REVIEW",
        "return_for_changes",
        "REVIEWER",
        false
      );
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it("rejects reject with empty comment", () => {
      const result = validateTransition(
        "UNDER_REVIEW",
        "reject",
        "REVIEWER",
        false,
        "   "
      );
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it("rejects transitioning from a terminal state (APPROVED)", () => {
      const result = validateTransition(
        "APPROVED",
        "submit",
        "APPLICANT",
        true
      );
      expect(result.valid).toBe(false);
    });

    it("rejects transitioning from a terminal state (REJECTED)", () => {
      const result = validateTransition(
        "REJECTED",
        "approve",
        "REVIEWER",
        false
      );
      expect(result.valid).toBe(false);
    });

    it("rejects unknown actions", () => {
      const result = validateTransition(
        "DRAFT",
        "fly_to_moon" as any,
        "APPLICANT",
        true
      );
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(400);
    });
  });

  describe("getAvailableActions", () => {
    it("returns submit for applicant owner of DRAFT", () => {
      const actions = getAvailableActions("DRAFT", "APPLICANT", true);
      expect(actions).toEqual(["submit"]);
    });

    it("returns nothing for non-owner applicant of DRAFT", () => {
      const actions = getAvailableActions("DRAFT", "APPLICANT", false);
      expect(actions).toEqual([]);
    });

    it("returns start_review for reviewer on SUBMITTED", () => {
      const actions = getAvailableActions("SUBMITTED", "REVIEWER", false);
      expect(actions).toEqual(["start_review"]);
    });

    it("returns approve, reject, return for reviewer on UNDER_REVIEW", () => {
      const actions = getAvailableActions("UNDER_REVIEW", "REVIEWER", false);
      expect(actions).toEqual(["approve", "reject", "return_for_changes"]);
    });

    it("returns nothing for terminal states", () => {
      expect(getAvailableActions("APPROVED", "REVIEWER", false)).toEqual([]);
      expect(getAvailableActions("REJECTED", "REVIEWER", false)).toEqual([]);
    });
  });
});
