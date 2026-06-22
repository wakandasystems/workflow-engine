import { ApplicationStatus, Role } from "@prisma/client";

/**
 * Defines which status transitions are legal, and which role can perform them.
 * Transitions requiring a comment are also marked.
 */
interface TransitionRule {
  from: ApplicationStatus;
  to: ApplicationStatus;
  allowedRole: Role;
  requiresComment: boolean;
  action: string;
}

const TRANSITIONS: TransitionRule[] = [
  {
    from: "DRAFT",
    to: "SUBMITTED",
    allowedRole: "APPLICANT",
    requiresComment: false,
    action: "submit",
  },
  {
    from: "SUBMITTED",
    to: "UNDER_REVIEW",
    allowedRole: "REVIEWER",
    requiresComment: false,
    action: "start_review",
  },
  {
    from: "UNDER_REVIEW",
    to: "APPROVED",
    allowedRole: "REVIEWER",
    requiresComment: false,
    action: "approve",
  },
  {
    from: "UNDER_REVIEW",
    to: "REJECTED",
    allowedRole: "REVIEWER",
    requiresComment: true,
    action: "reject",
  },
  {
    from: "UNDER_REVIEW",
    to: "DRAFT",
    allowedRole: "REVIEWER",
    requiresComment: true,
    action: "return_for_changes",
  },
];

export type TransitionAction =
  | "submit"
  | "start_review"
  | "approve"
  | "reject"
  | "return_for_changes";

export interface TransitionResult {
  valid: boolean;
  error?: string;
  statusCode?: number;
  rule?: TransitionRule;
}

/**
 * Look up a transition rule by action name.
 */
export function getTransitionByAction(
  action: TransitionAction
): TransitionRule | undefined {
  return TRANSITIONS.find((t) => t.action === action);
}

/**
 * Validate whether a transition is allowed given current state, user role,
 * ownership, and provided comment.
 */
export function validateTransition(
  currentStatus: ApplicationStatus,
  action: TransitionAction,
  userRole: Role,
  isOwner: boolean,
  comment?: string
): TransitionResult {
  const rule = getTransitionByAction(action);

  if (!rule) {
    return {
      valid: false,
      error: `Unknown action: ${action}`,
      statusCode: 400,
    };
  }

  // Check the current status matches the expected "from" status
  if (currentStatus !== rule.from) {
    return {
      valid: false,
      error: `Cannot ${action} an application in ${currentStatus} status. Expected: ${rule.from}.`,
      statusCode: 409,
    };
  }

  // Check role authorization
  if (userRole !== rule.allowedRole) {
    return {
      valid: false,
      error: `Role ${userRole} is not authorized to perform ${action}. Required: ${rule.allowedRole}.`,
      statusCode: 403,
    };
  }

  // For applicant actions, only the owner can act
  if (rule.allowedRole === "APPLICANT" && !isOwner) {
    return {
      valid: false,
      error: "Only the application owner can perform this action.",
      statusCode: 403,
    };
  }

  // Check comment requirement
  if (rule.requiresComment && (!comment || comment.trim().length === 0)) {
    return {
      valid: false,
      error: `A comment is required when performing ${action}.`,
      statusCode: 400,
    };
  }

  return { valid: true, rule };
}

/**
 * Get all available actions for a given status and role.
 */
export function getAvailableActions(
  currentStatus: ApplicationStatus,
  userRole: Role,
  isOwner: boolean
): TransitionAction[] {
  return TRANSITIONS.filter((t) => {
    if (t.from !== currentStatus) return false;
    if (t.allowedRole !== userRole) return false;
    if (t.allowedRole === "APPLICANT" && !isOwner) return false;
    return true;
  }).map((t) => t.action as TransitionAction);
}
