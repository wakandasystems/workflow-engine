import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-lg font-semibold text-gray-900">
                Approval Workflow
              </Link>
              {user && (
                <Link
                  to="/"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {user.role === "APPLICANT"
                    ? "My Applications"
                    : "Review Queue"}
                </Link>
              )}
            </div>
            {user && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">
                  {user.name}{" "}
                  <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5">
                    {user.role}
                  </span>
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
