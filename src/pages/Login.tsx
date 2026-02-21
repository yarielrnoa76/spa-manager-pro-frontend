import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

type LoginProps = {
  onLoginSuccess?: () => void | Promise<void>;
};

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("admin@local.test");
  const [password, setPassword] = useState("Admin12345!");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await api.login({ email, password });

      const me = await api.me();
      if (!me) {
        api.clearToken();
        throw new Error("Login OK, but user data could not be retrieved.");
      }

      await onLoginSuccess?.();
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const e = err as Error & { code?: string; message?: string };
      if (e?.code === "DB_CONNECTION_ERROR") {
        setError("Connection to DB Server Error");
      } else if (e?.code === "VALIDATION_ERROR") {
        setError("Please check your email and password.");
      } else {
        setError(e?.message || "Invalid credentials. Please try again.");
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      {/* 👉 ESTA es la ventanita centrada */}
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">SPA Manager Pro</h1>
          <p className="text-gray-500">Sign in to continue.</p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* 🔴 Error centrado DENTRO de la tarjeta */}
            {error && (
              <div className="text-center text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg py-2 px-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition disabled:bg-indigo-400"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4 text-xs text-gray-400">
          <p>Dev user: admin@local.test</p>
          <p>Password: Admin12345!</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
