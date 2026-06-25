import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { applicationsApi } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { StatusBadge } from "../components/StatusBadge";
import type { ApplicationStatus } from "../types";

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Under Review", value: "UNDER_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

export function ApplicationListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");

  const { data: applications, isLoading, error } = useQuery({
    queryKey: ["applications", statusFilter],
    queryFn: () => applicationsApi.list(statusFilter || undefined),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded">
        Failed to load applications. Please try again.
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {user?.role === "APPLICANT" ? "My Applications" : "Review Queue"}
        </h1>
        {user?.role === "APPLICANT" && (
          <button
            onClick={() => navigate("/applications/new")}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            New Application
          </button>
        )}
      </div>

      {/* Status filter */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {STATUS_OPTIONS.filter((opt) => {
          if (user?.role === "REVIEWER" && opt.value === "DRAFT") return false;
          return true;
        }).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium border ${
              statusFilter === opt.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {applications && applications.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No applications found.</p>
          {user?.role === "APPLICANT" && (
            <button
              onClick={() => navigate("/applications/new")}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              Create your first application
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                {user?.role === "REVIEWER" && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applicant
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {applications?.map((app) => (
                <tr
                  key={app.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/applications/${app.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {app.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {app.category}
                  </td>
                  {user?.role === "REVIEWER" && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {app.applicant.name}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={app.status as ApplicationStatus} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(app.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
