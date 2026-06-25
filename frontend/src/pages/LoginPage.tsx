import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { AxiosError } from "axios";

const TEST_ACCOUNTS = [
  { label: "Applicant", email: "applicant@example.com", password: "password123" },
  { label: "Applicant 2", email: "applicant2@example.com", password: "password123" },
  { label: "Reviewer", email: "reviewer@example.com", password: "password123" },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autofilled, setAutofilled] = useState<string | null>(null);

  const handleQuickFill = (account: (typeof TEST_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    setError("");
    setAutofilled(account.label);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error || "Login failed.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Approval Workflow
          </h1>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white shadow rounded-lg p-8 space-y-6"
        >
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setAutofilled(null);
              }}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="applicant@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setAutofilled(null);
              }}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="password123"
            />
          </div>
          {autofilled && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded text-sm flex items-center gap-2">
              <span>✓ Auto-filled as {autofilled} — click Sign in to continue</span>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <div className="text-xs text-gray-500 border-t pt-4 space-y-1">
            <p className="font-medium">Test Credentials (click to autofill):</p>
            {TEST_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => handleQuickFill(account)}
                className="w-full flex items-center justify-between rounded px-2 py-1.5 text-left hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <span>
                  {account.label}: <code>{account.email}</code> / <code>{account.password}</code>
                </span>
                {autofilled === account.label && (
                  <span className="text-green-600 font-medium">✓</span>
                )}
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
