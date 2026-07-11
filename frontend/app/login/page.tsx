"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(username, password);
      saveSession(res.token, res.user as any);
      if (res.user.role === "admin" || res.user.role === "petugas") {
        router.push("/admin");
      } else {
        router.push("/warga");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm"
      >
        <h1 className="text-xl font-semibold mb-1 text-center">Bank Sampah Digital</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">Masuk ke akun Anda</p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-2 rounded mb-4">{error}</div>
        )}

        <label className="block text-sm font-medium mb-1">Username</label>
        <input
          className="w-full border rounded px-3 py-2 mb-4"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label className="block text-sm font-medium mb-1">Password</label>
        <input
          type="password"
          className="w-full border rounded px-3 py-2 mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white rounded py-2 font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
