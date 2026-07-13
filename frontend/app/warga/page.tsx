"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getUser, SessionUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

type Riwayat = {
  id: string;
  jenis_sampah_nama: string;
  berat_kg: number;
  poin_didapat: number;
  created_at: string;
};

type Produk = {
  id: string;
  nama: string;
  poin_dibutuhkan: number;
  stok: number;
};

type LeaderboardRow = {
  rumah_tangga_id: string;
  nama_kepala_keluarga: string;
  rt: string;
  jumlah_setor: number;
  total_berat_kg: number;
  total_poin: number;
};

type Kontak = {
  nama_kontak: string;
  whatsapp: string;
  telepon: string;
  email: string;
  alamat: string;
  jam_operasional: string;
};

export default function WargaPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [poin, setPoin] = useState<number>(0);
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);
  const [produk, setProduk] = useState<Produk[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardRt, setLeaderboardRt] = useState("semua");
  const [kontak, setKontak] = useState<Kontak | null>(null);
  const [pesan, setPesan] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    loadData(u.rumah_tangga_id);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    api
      .leaderboard(leaderboardRt)
      .then(setLeaderboard)
      .catch(() => {
        // leaderboard cuma pelengkap, tidak perlu tampilkan error besar kalau gagal
      });
  }, [user, leaderboardRt]);

  useEffect(() => {
    if (!user) return;
    api.getKontak().then(setKontak).catch(() => {
      // kontak cuma info tambahan, tidak perlu tampilkan error kalau gagal
    });
  }, [user]);

  async function loadData(rumahTanggaId: string) {
    setLoading(true);
    try {
      const [saldo, riwayatData, produkData] = await Promise.all([
        api.saldoPoin(rumahTanggaId),
        api.riwayat(rumahTanggaId),
        api.produkTukar(),
      ]);
      setPoin(saldo.total_poin);
      setRiwayat(riwayatData);
      setProduk(produkData);
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  async function tukar(produkId: string) {
    if (!user) return;
    setPesan("");
    try {
      await api.tukarPoin(user.rumah_tangga_id, produkId);
      setPesan("Penukaran berhasil!");
      loadData(user.rumah_tangga_id);
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal menukar poin");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <span className="text-4xl animate-pulse" aria-hidden>♻️</span>
        <p className="text-green-700/80 text-sm">Memuat...</p>
      </div>
    );
  }

  return (
    <div>
      <Navbar user={user} />
      <main className="max-w-4xl mx-auto p-5 sm:p-6 space-y-6">
        {/* Kartu saldo poin */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white p-7 shadow-eco">
          <div className="absolute -right-6 -top-8 text-[120px] opacity-15 select-none" aria-hidden>
            🌿
          </div>
          <p className="text-green-50/90 text-sm">Saldo Poin Anda</p>
          <p className="text-5xl font-extrabold tracking-tight mt-1">
            {poin.toLocaleString("id-ID")}
          </p>
          <p className="text-green-50/80 text-xs mt-2">
            Terus setor sampahmu untuk menambah poin 🌱
          </p>
        </div>

        {pesan && (
          <div className="bg-green-50 border border-green-100 text-green-800 text-sm p-3 rounded-lg flex items-center gap-2">
            <span aria-hidden>✅</span> {pesan}
          </div>
        )}

        {kontak && (kontak.whatsapp || kontak.telepon || kontak.email || kontak.alamat) && (
          <section className="eco-card overflow-hidden">
            {/* Header dengan aksen hijau */}
            <div className="relative bg-gradient-to-r from-primary to-primary-dark text-white px-6 py-5">
              <div className="absolute -right-3 -bottom-4 text-7xl opacity-15 select-none" aria-hidden>
                💬
              </div>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                Butuh Bantuan?
              </h2>
              <p className="text-green-50/90 text-sm mt-0.5">
                Tim bank sampah siap membantu Anda 🌱
              </p>
              {kontak.nama_kontak && (
                <div className="mt-3 inline-flex items-center gap-2 bg-white/15 rounded-full pl-1 pr-3 py-1">
                  <span className="grid place-items-center w-6 h-6 rounded-full bg-white/25 text-xs" aria-hidden>
                    👤
                  </span>
                  <span className="text-sm font-medium">{kontak.nama_kontak}</span>
                </div>
              )}
            </div>

            <div className="p-5 space-y-4">
              {/* Tombol WhatsApp utama */}
              {kontak.whatsapp && (
                <a
                  href={`https://wa.me/${kontak.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-3.5 transition hover:bg-green-100 hover:shadow-eco-sm active:scale-[0.99]"
                >
                  <span className="grid place-items-center w-11 h-11 rounded-xl bg-primary text-white text-xl shadow-eco-sm" aria-hidden>
                    💬
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-gray-500">Chat via WhatsApp</span>
                    <span className="block font-semibold text-primary-dark truncate">{kontak.whatsapp}</span>
                  </span>
                  <span className="ml-auto text-primary-dark" aria-hidden>›</span>
                </a>
              )}

              {/* Detail kontak lain */}
              <div className="grid sm:grid-cols-2 gap-2.5 text-sm">
                {kontak.telepon && (
                  <div className="flex items-center gap-3 rounded-lg bg-green-50/50 border border-green-100 px-3 py-2.5">
                    <span className="text-lg" aria-hidden>📱</span>
                    <span className="min-w-0">
                      <span className="block text-xs text-gray-500">Telepon</span>
                      <a href={`tel:${kontak.telepon}`} className="font-medium text-gray-800 hover:text-primary-dark truncate block">
                        {kontak.telepon}
                      </a>
                    </span>
                  </div>
                )}
                {kontak.email && (
                  <div className="flex items-center gap-3 rounded-lg bg-green-50/50 border border-green-100 px-3 py-2.5">
                    <span className="text-lg" aria-hidden>✉️</span>
                    <span className="min-w-0">
                      <span className="block text-xs text-gray-500">Email</span>
                      <a href={`mailto:${kontak.email}`} className="font-medium text-gray-800 hover:text-primary-dark truncate block">
                        {kontak.email}
                      </a>
                    </span>
                  </div>
                )}
                {kontak.alamat && (
                  <div className="flex items-center gap-3 rounded-lg bg-green-50/50 border border-green-100 px-3 py-2.5">
                    <span className="text-lg" aria-hidden>📍</span>
                    <span className="min-w-0">
                      <span className="block text-xs text-gray-500">Alamat</span>
                      <span className="font-medium text-gray-800">{kontak.alamat}</span>
                    </span>
                  </div>
                )}
                {kontak.jam_operasional && (
                  <div className="flex items-center gap-3 rounded-lg bg-green-50/50 border border-green-100 px-3 py-2.5">
                    <span className="text-lg" aria-hidden>🕐</span>
                    <span className="min-w-0">
                      <span className="block text-xs text-gray-500">Jam Operasional</span>
                      <span className="font-medium text-gray-800">{kontak.jam_operasional}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="eco-card p-6">
          <h2 className="eco-title mb-4 flex items-center gap-2">🎁 Tukar Poin</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {produk.map((p) => {
              const kurang = poin < p.poin_dibutuhkan;
              const habis = p.stok <= 0;
              return (
                <div
                  key={p.id}
                  className="border border-green-100 rounded-xl p-4 flex flex-col gap-2 bg-green-50/30 hover:shadow-eco-sm transition"
                >
                  <p className="font-semibold text-gray-800">{p.nama}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="eco-badge">{p.poin_dibutuhkan.toLocaleString("id-ID")} poin</span>
                    <span className={`text-xs ${habis ? "text-red-500" : "text-gray-500"}`}>
                      stok {p.stok}
                    </span>
                  </div>
                  <button
                    onClick={() => tukar(p.id)}
                    disabled={kurang || habis}
                    className="eco-btn-primary mt-auto text-sm py-2"
                  >
                    {habis ? "Stok Habis" : kurang ? "Poin Belum Cukup" : "Tukar Sekarang"}
                  </button>
                </div>
              );
            })}
            {produk.length === 0 && (
              <p className="text-gray-400 text-sm">Belum ada produk tukar tersedia.</p>
            )}
          </div>
        </section>

        <section className="eco-card p-6">
          <h2 className="eco-title mb-4 flex items-center gap-2">📋 Riwayat Setor Sampah</h2>
          <div className="overflow-x-auto">
            <table className="eco-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Jenis</th>
                  <th>Berat (kg)</th>
                  <th>Poin</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.created_at).toLocaleString("id-ID")}</td>
                    <td>{r.jenis_sampah_nama}</td>
                    <td>{r.berat_kg}</td>
                    <td className="font-medium text-primary-dark">+{r.poin_didapat}</td>
                  </tr>
                ))}
                {riwayat.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-400">
                      Belum ada riwayat setor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="eco-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <h2 className="eco-title flex items-center gap-2">🏆 Leaderboard — Paling Sering Menyetor</h2>
            <input
              className="eco-input text-xs sm:ml-auto sm:w-44"
              placeholder="Filter RT atau 'semua'"
              value={leaderboardRt}
              onChange={(e) => setLeaderboardRt(e.target.value || "semua")}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="eco-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Kepala Keluarga</th>
                  <th>RT</th>
                  <th>Jumlah Setor</th>
                  <th>Total Poin</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 10).map((row, i) => {
                  const isSaya = row.rumah_tangga_id === user?.rumah_tangga_id;
                  return (
                    <tr key={row.rumah_tangga_id} className={isSaya ? "bg-green-100/70 font-medium" : ""}>
                      <td>
                        <span className="font-semibold text-gray-700">
                          {["🥇", "🥈", "🥉"][i] ?? i + 1}
                        </span>
                      </td>
                      <td>
                        {row.nama_kepala_keluarga}
                        {isSaya && <span className="eco-badge ml-2">Anda</span>}
                      </td>
                      <td>{row.rt}</td>
                      <td>{row.jumlah_setor}x</td>
                      <td className="font-semibold text-primary-dark">
                        {row.total_poin.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  );
                })}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400">
                      Belum ada data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
