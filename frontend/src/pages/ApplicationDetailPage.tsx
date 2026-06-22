import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { applicationsApi } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { StatusBadge } from "../components/StatusBadge";
import { AuditTrail } from "../components/AuditTrail";
import type { TransitionAction } from "../types";

const ACTION_LABELS: Record<TransitionAction, string> = {
  submit: "Submit for Review",
  start_review: "Start Review",
  approve: "Approve",
  reject: "Reject",
  return_for_changes: "Return for Changes",
};

const ACTION_STYLES: Record<TransitionAction, string> = {
  submit: "bg-blue-600 hover:bg-blue-700 text-white",
  start_review: "bg-yellow-500 hover:bg-yellow-600 text-white",
  approve: "bg-green-600 hover:bg-green-700 text-white",
  reject: "bg-red-600 hover:bg-red-700 text-white",
  return_for_changes: "bg-orange-500 hover:bg-orange-600 text-white",
};

const COMMENT_REQUIRED: TransitionAction[] = ["reject", "return_for_changes"];

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState<TransitionAction | null>(
    null
  );

  const {
    data,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ["application", id],
    queryFn: () => applicationsApi.get(id!),
    enabled: !!id,
  });

  const transitionMutation = useMutation({
    mutationFn: ({
      action,
      comment,
    }: {
      action: TransitionAction;
      comment?: string;
    }) => applicationsApi.transition(id!, action, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application", id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setComment("");
      setActiveAction(null);
      setError("");
    },
    onError: (err) => {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error || "Action failed.");
      } else {
        setError("An unexpected error occurred.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => applicationsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      navigate("/");
    },
  });

  const handleTransition = (action: TransitionAction) => {
    if (COMMENT_REQUIRED.includes(action) && !comment.trim()) {
      setError("A comment is required for this action.");
      return;
    }
    setError("");
    transitionMutation.mutate({
      action,
      comment: comment.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (fetchError || !data) {
    return (
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded">
        {fetchError instanceof AxiosError
          ? fetchError.response?.data?.error || "Failed to load application."
          : "Failed to load application."}
      </div>
    );
  }

  const { application: app, availableActions } = data;
  const isOwner = app.applicantId === user?.id;
  const canEdit = isOwner && app.status === "DRAFT";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            to="/"
            className="text-sm text-blue-600 hover:text-blue-700 mb-2 inline-block"
          >
            &larr; Back to list
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">{app.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            by {app.applicant.name} &middot;{" "}
            {new Date(app.createdAt).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      {/* Details */}
      <div className="bg-white shadow rounded-lg p-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Category</dt>
            <dd className="mt-1 text-sm text-gray-900">{app.category}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Amount</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {app.amount != null ? `$${app.amount.toFixed(2)}` : "N/A"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Description</dt>
            <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
              {app.description || "No description provided."}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(app.updatedAt).toLocaleString()}
            </dd>
          </div>
        </dl>

        {/* Edit / Delete buttons for draft owner */}
        {canEdit && (
          <div className="mt-4 pt-4 border-t flex gap-3">
            <button
              onClick={() => navigate(`/applications/${app.id}/edit`)}
              className="bg-white text-gray-700 px-4 py-2 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this draft application?")) {
                  deleteMutation.mutate();
                }
              }}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Delete Draft
            </button>
          </div>
        )}
      </div>

      {/* Actions panel */}
      {availableActions.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Actions</h2>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded text-sm mb-3">
              {error}
            </div>
          )}

          {/* Comment field for actions that need it */}
          {availableActions.some((a) => COMMENT_REQUIRED.includes(a)) && (
            <div className="mb-3">
              <label
                htmlFor="comment"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Comment{" "}
                {activeAction && COMMENT_REQUIRED.includes(activeAction) && (
                  <span className="text-red-500">* required</span>
                )}
              </label>
              <textarea
                id="comment"
                rows={3}
                maxLength={1000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Add a comment..."
              />
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {availableActions.map((action) => (
              <button
                key={action}
                onClick={() => {
                  setActiveAction(action);
                  handleTransition(action);
                }}
                disabled={transitionMutation.isPending}
                className={`px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 ${ACTION_STYLES[action]}`}
              >
                {transitionMutation.isPending && activeAction === action
                  ? "Processing..."
                  : ACTION_LABELS[action]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Audit Trail */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Activity Log
        </h2>
        <AuditTrail logs={app.auditLogs || []} />
      </div>
    </div>
  );
}
