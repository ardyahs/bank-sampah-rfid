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
      <main className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-lg">Leaderboard RT — Paling Sering Menyetor</h1>
          <input
            className="border rounded px-2 py-1 text-sm ml-auto"
            placeholder="Filter RT (mis. 03) atau 'semua'"
            value={rt}
            onChange={(e) => setRt(e.target.value || "semua")}
          />
        </div>

        {pesan && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{pesan}</div>}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="py-2 px-4">#</th>
                <th className="px-4">Kepala Keluarga</th>
                <th className="px-4">RT</th>
                <th className="px-4">Jumlah Setor</th>
                <th className="px-4">Total Berat (kg)</th>
                <th className="px-4">Total Poin</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.rumah_tangga_id} className="border-b last:border-0">
                  <td className="py-2 px-4">{i + 1}</td>
                  <td className="px-4">{row.nama_kepala_keluarga}</td>
                  <td className="px-4">{row.rt}</td>
                  <td className="px-4 font-medium">{row.jumlah_setor}x</td>
                  <td className="px-4">{row.total_berat_kg}</td>
                  <td className="px-4 font-medium">{row.total_poin.toLocaleString("id-ID")}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
