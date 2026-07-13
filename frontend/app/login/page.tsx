"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Recycle, Sprout, Globe2 } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-primary text-white shadow-eco mb-3">
            <Recycle className="w-8 h-8" />
          </span>
          <h1 className="text-2xl font-bold text-forest">Bank Sampah Digital</h1>
          <p className="text-sm text-green-700/70 mt-1">
            Setor sampah, kumpulkan poin, jaga lingkungan
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="eco-card p-7 sm:p-8"
        >
          <h2 className="text-lg font-semibold text-forest mb-1">Masuk ke akun Anda</h2>
          <p className="text-sm text-gray-500 mb-6 flex items-center gap-1.5">
            Selamat datang kembali <Sprout className="w-4 h-4 text-primary" />
          </p>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
          <input
            className="eco-input mb-4"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
          <input
            type="password"
            className="eco-input mb-6"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading} className="eco-btn-primary w-full py-2.5">
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <p className="text-center text-xs text-green-700/60 mt-5 flex items-center justify-center gap-1.5">
          <Globe2 className="w-3.5 h-3.5" />
          Bersama menjaga bumi untuk generasi mendatang
        </p>
      </div>
    </div>
  );
}
