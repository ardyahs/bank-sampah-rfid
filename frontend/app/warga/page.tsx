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
    return <p className="p-6">Memuat...</p>;
  }

  return (
    <div>
      <Navbar user={user} />
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-500 text-sm">Saldo Poin Anda</p>
          <p className="text-4xl font-bold text-primary">{poin.toLocaleString("id-ID")}</p>
        </div>

        {pesan && (
          <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded">{pesan}</div>
        )}

        {kontak && (kontak.whatsapp || kontak.telepon || kontak.email || kontak.alamat) && (
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold mb-3">Butuh Bantuan? Hubungi Kami</h2>
            <div className="text-sm text-gray-700 space-y-1">
              {kontak.nama_kontak && <p className="font-medium">{kontak.nama_kontak}</p>}
              {kontak.whatsapp && (
                <p>
                  WhatsApp:{" "}
                  <a
                    href={`https://wa.me/${kontak.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {kontak.whatsapp}
                  </a>
                </p>
              )}
              {kontak.telepon && <p>Telepon: {kontak.telepon}</p>}
              {kontak.email && <p>Email: {kontak.email}</p>}
              {kontak.alamat && <p>Alamat: {kontak.alamat}</p>}
              {kontak.jam_operasional && (
                <p className="text-gray-500">Jam operasional: {kontak.jam_operasional}</p>
              )}
            </div>
          </section>
        )}

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold mb-4">Tukar Poin</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {produk.map((p) => (
              <div key={p.id} className="border rounded-lg p-4 flex flex-col gap-2">
                <p className="font-medium">{p.nama}</p>
                <p className="text-sm text-gray-500">
                  {p.poin_dibutuhkan.toLocaleString("id-ID")} poin - stok {p.stok}
                </p>
                <button
                  onClick={() => tukar(p.id)}
                  disabled={poin < p.poin_dibutuhkan || p.stok <= 0}
                  className="mt-auto bg-primary text-white text-sm rounded py-1.5 disabled:opacity-40"
                >
                  Tukar
                </button>
              </div>
            ))}
            {produk.length === 0 && (
              <p className="text-gray-400 text-sm">Belum ada produk tukar tersedia.</p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold mb-4">Riwayat Setor Sampah</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Tanggal</th>
                <th>Jenis</th>
                <th>Berat (kg)</th>
                <th>Poin</th>
              </tr>
            </thead>
            <tbody>
              {riwayat.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">{new Date(r.created_at).toLocaleString("id-ID")}</td>
                  <td>{r.jenis_sampah_nama}</td>
                  <td>{r.berat_kg}</td>
                  <td>{r.poin_didapat}</td>
                </tr>
              ))}
              {riwayat.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    Belum ada riwayat setor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-semibold">Leaderboard — Paling Sering Menyetor</h2>
            <input
              className="border rounded px-2 py-1 text-xs ml-auto"
              placeholder="Filter RT atau 'semua'"
              value={leaderboardRt}
              onChange={(e) => setLeaderboardRt(e.target.value || "semua")}
            />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">#</th>
                <th>Kepala Keluarga</th>
                <th>RT</th>
                <th>Jumlah Setor</th>
                <th>Total Poin</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.slice(0, 10).map((row, i) => (
                <tr
                  key={row.rumah_tangga_id}
                  className={`border-b last:border-0 ${
                    row.rumah_tangga_id === user?.rumah_tangga_id ? "bg-green-50 font-medium" : ""
                  }`}
                >
                  <td className="py-2">{i + 1}</td>
                  <td>{row.nama_kepala_keluarga}</td>
                  <td>{row.rt}</td>
                  <td>{row.jumlah_setor}x</td>
                  <td>{row.total_poin.toLocaleString("id-ID")}</td>
                </tr>
              ))}
              {leaderboard.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-400">
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
