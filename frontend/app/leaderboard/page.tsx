"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getUser, SessionUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

type Row = {
  rumah_tangga_id: string;
  nama_kepala_keluarga: string;
  rt: string;
  jumlah_setor: number;
  total_berat_kg: number;
  total_poin: number;
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rt, setRt] = useState("semua");
  const [data, setData] = useState<Row[]>([]);
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    api
      .leaderboard(rt)
      .then(setData)
      .catch((err) => setPesan(err instanceof ApiError ? err.message : "Gagal memuat leaderboard"));
  }, [user, rt]);

  return (
    <div>
      <Navbar user={user} />
      <main className="max-w-3xl mx-auto p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h1 className="eco-title text-xl flex items-center gap-2">
              🏆 Leaderboard RT
            </h1>
            <p className="text-sm text-gray-500">Rumah tangga paling rajin menyetor sampah</p>
          </div>
          <input
            className="eco-input text-sm sm:ml-auto sm:w-56"
            placeholder="Filter RT (mis. 03) atau 'semua'"
            value={rt}
            onChange={(e) => setRt(e.target.value || "semua")}
          />
        </div>

        {pesan && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-lg">{pesan}</div>
        )}

        <div className="eco-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="eco-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Kepala Keluarga</th>
                  <th>RT</th>
                  <th>Jumlah Setor</th>
                  <th>Total Berat (kg)</th>
                  <th>Total Poin</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={row.rumah_tangga_id}>
                    <td>
                      <span className="font-semibold text-gray-700">
                        {["🥇", "🥈", "🥉"][i] ?? i + 1}
                      </span>
                    </td>
                    <td className="font-medium text-gray-800">{row.nama_kepala_keluarga}</td>
                    <td>{row.rt}</td>
                    <td><span className="eco-badge">{row.jumlah_setor}x setor</span></td>
                    <td>{row.total_berat_kg}</td>
                    <td className="font-semibold text-primary-dark">
                      {row.total_poin.toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      Belum ada data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
