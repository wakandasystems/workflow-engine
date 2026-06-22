import type { AuditLog } from "../types";
import { StatusBadge } from "./StatusBadge";

export function AuditTrail({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-gray-500">No activity yet.</p>;
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {logs.map((log, idx) => (
          <li key={log.id}>
            <div className="relative pb-8">
              {idx < logs.length - 1 && (
                <span
                  className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                    {log.actor.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{log.actor.name}</span>{" "}
                    <span className="text-gray-500">({log.actor.role})</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <StatusBadge status={log.oldStatus} />
                    <span className="text-gray-400">&rarr;</span>
                    <StatusBadge status={log.newStatus} />
                  </div>
                  {log.comment && (
                    <p className="mt-1 text-sm text-gray-600 bg-gray-50 rounded p-2 border border-gray-100">
                      {log.comment}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
