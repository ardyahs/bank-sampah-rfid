"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getUser, SessionUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

type Warga = {
  id: string;
  nama_kepala_keluarga: string;
  alamat: string;
  rt: string;
  rw: string;
  kartu_uid: string;
};

type Transaksi = {
  id: string;
  nama_kepala_keluarga: string;
  jenis_sampah_nama: string;
  berat_kg: number;
  poin_didapat: number;
  created_at: string;
};

type JenisSampah = {
  id: string;
  nama: string;
  poin_per_kg: number;
};

const emptyWargaForm = {
  nama_kepala_keluarga: "",
  alamat: "",
  rt: "",
  rw: "",
  kartu_uid: "",
  username: "",
  password: "",
};

const emptyProdukForm = { nama: "", poin_dibutuhkan: 0, stok: 0 };
const emptyManualForm = { rumah_tangga_id: "", jenis_sampah_id: "", berat_kg: 0 };

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<"warga" | "produk" | "transaksi" | "manual">("warga");

  const [warga, setWarga] = useState<Warga[]>([]);
  const [transaksi, setTransaksi] = useState<Transaksi[]>([]);
  const [jenisSampahList, setJenisSampahList] = useState<JenisSampah[]>([]);
  const [wargaForm, setWargaForm] = useState(emptyWargaForm);
  const [produkForm, setProdukForm] = useState(emptyProdukForm);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [pesan, setPesan] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    if (!u || (u.role !== "admin" && u.role !== "petugas")) {
      router.replace("/login");
      return;
    }
    setUser(u);
    muatSemua();
  }, [router]);

  async function muatSemua() {
    setLoading(true);
    try {
      const [wargaData, transaksiData, jenisSampahData] = await Promise.all([
        api.listWarga(),
        api.semuaTransaksi(),
        api.jenisSampah(),
      ]);
      setWarga(wargaData);
      setTransaksi(transaksiData);
      setJenisSampahList(jenisSampahData);
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  async function tambahWarga(e: React.FormEvent) {
    e.preventDefault();
    setPesan("");
    try {
      await api.createWarga({
        ...wargaForm,
        username: wargaForm.username || undefined,
        password: wargaForm.password || undefined,
      });
      setWargaForm(emptyWargaForm);
      setPesan("Rumah tangga berhasil ditambahkan.");
      muatSemua();
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal menambah rumah tangga");
    }
  }

  async function hapusWarga(id: string) {
    if (!confirm("Hapus rumah tangga ini beserta seluruh riwayatnya?")) return;
    try {
      await api.deleteWarga(id);
      muatSemua();
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal menghapus");
    }
  }

  async function tambahProduk(e: React.FormEvent) {
    e.preventDefault();
    setPesan("");
    try {
      await api.createProduk(produkForm);
      setProdukForm(emptyProdukForm);
      setPesan("Produk tukar berhasil ditambahkan.");
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal menambah produk");
    }
  }

  async function kirimManual(e: React.FormEvent) {
    e.preventDefault();
    setPesan("");
    try {
      const hasil = await api.setorManual(
        manualForm.rumah_tangga_id,
        manualForm.jenis_sampah_id,
        manualForm.berat_kg
      );
      setManualForm(emptyManualForm);
      setPesan(`Transaksi manual berhasil disimpan. Poin didapat: ${hasil.poin_didapat}.`);
      muatSemua();
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal menyimpan transaksi manual");
    }
  }

  if (loading) return <p className="p-6">Memuat...</p>;

  return (
    <div>
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex gap-2">
          {(["warga", "produk", "manual", "transaksi"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded text-sm font-medium ${
                tab === t ? "bg-primary text-white" : "bg-white text-gray-600 border"
              }`}
            >
              {t === "warga"
                ? "Kelola Warga"
                : t === "produk"
                ? "Produk Tukar"
                : t === "manual"
                ? "Input Manual"
                : "Monitor Transaksi"}
            </button>
          ))}
        </div>

        {pesan && <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded">{pesan}</div>}

        {tab === "warga" && (
          <section className="space-y-4">
            <form onSubmit={tambahWarga} className="bg-white rounded-lg shadow p-6 grid sm:grid-cols-2 gap-3">
              <h2 className="font-semibold sm:col-span-2">Tambah Rumah Tangga</h2>
              <input required placeholder="Nama Kepala Keluarga" className="border rounded px-3 py-2"
                value={wargaForm.nama_kepala_keluarga}
                onChange={(e) => setWargaForm({ ...wargaForm, nama_kepala_keluarga: e.target.value })} />
              <input required placeholder="Alamat" className="border rounded px-3 py-2"
                value={wargaForm.alamat}
                onChange={(e) => setWargaForm({ ...wargaForm, alamat: e.target.value })} />
              <input required placeholder="RT" className="border rounded px-3 py-2"
                value={wargaForm.rt}
                onChange={(e) => setWargaForm({ ...wargaForm, rt: e.target.value })} />
              <input placeholder="RW" className="border rounded px-3 py-2"
                value={wargaForm.rw}
                onChange={(e) => setWargaForm({ ...wargaForm, rw: e.target.value })} />
              <input required placeholder="UID Kartu RFID" className="border rounded px-3 py-2"
                value={wargaForm.kartu_uid}
                onChange={(e) => setWargaForm({ ...wargaForm, kartu_uid: e.target.value })} />
              <div />
              <input placeholder="Username login warga (opsional)" className="border rounded px-3 py-2"
                value={wargaForm.username}
                onChange={(e) => setWargaForm({ ...wargaForm, username: e.target.value })} />
              <input placeholder="Password login warga (opsional)" type="password" className="border rounded px-3 py-2"
                value={wargaForm.password}
                onChange={(e) => setWargaForm({ ...wargaForm, password: e.target.value })} />
              <button className="sm:col-span-2 bg-primary text-white rounded py-2 font-medium">
                Simpan
              </button>
            </form>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b bg-gray-50">
                    <th className="py-2 px-4">Nama</th>
                    <th className="px-4">RT/RW</th>
                    <th className="px-4">UID Kartu</th>
                    <th className="px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {warga.map((w) => (
                    <tr key={w.id} className="border-b last:border-0">
                      <td className="py-2 px-4">{w.nama_kepala_keluarga}</td>
                      <td className="px-4">{w.rt}/{w.rw}</td>
                      <td className="px-4 font-mono text-xs">{w.kartu_uid}</td>
                      <td className="px-4">
                        <button onClick={() => hapusWarga(w.id)} className="text-red-500 text-xs">
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {warga.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-gray-400">Belum ada data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "produk" && (
          <section>
            <form onSubmit={tambahProduk} className="bg-white rounded-lg shadow p-6 grid sm:grid-cols-3 gap-3">
              <h2 className="font-semibold sm:col-span-3">Tambah Produk Tukar</h2>
              <input required placeholder="Nama Produk" className="border rounded px-3 py-2"
                value={produkForm.nama}
                onChange={(e) => setProdukForm({ ...produkForm, nama: e.target.value })} />
              <input required type="number" placeholder="Poin Dibutuhkan" className="border rounded px-3 py-2"
                value={produkForm.poin_dibutuhkan || ""}
                onChange={(e) => setProdukForm({ ...produkForm, poin_dibutuhkan: Number(e.target.value) })} />
              <input required type="number" placeholder="Stok" className="border rounded px-3 py-2"
                value={produkForm.stok || ""}
                onChange={(e) => setProdukForm({ ...produkForm, stok: Number(e.target.value) })} />
              <button className="sm:col-span-3 bg-primary text-white rounded py-2 font-medium">
                Simpan Produk
              </button>
            </form>
          </section>
        )}

        {tab === "manual" && (
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold mb-1">Input Transaksi Manual</h2>
            <p className="text-sm text-gray-500 mb-4">
              Dipakai kalau alat RFID belum siap/rusak, atau untuk mengoreksi transaksi yang terlewat.
            </p>
            <form onSubmit={kirimManual} className="grid sm:grid-cols-3 gap-3">
              <select required className="border rounded px-3 py-2"
                value={manualForm.rumah_tangga_id}
                onChange={(e) => setManualForm({ ...manualForm, rumah_tangga_id: e.target.value })}>
                <option value="">Pilih Rumah Tangga</option>
                {warga.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nama_kepala_keluarga} (RT {w.rt})
                  </option>
                ))}
              </select>
              <select required className="border rounded px-3 py-2"
                value={manualForm.jenis_sampah_id}
                onChange={(e) => setManualForm({ ...manualForm, jenis_sampah_id: e.target.value })}>
                <option value="">Pilih Jenis Sampah</option>
                {jenisSampahList.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.nama} ({j.poin_per_kg} poin/kg)
                  </option>
                ))}
              </select>
              <input required type="number" step="0.01" min="0.01" placeholder="Berat (kg)"
                className="border rounded px-3 py-2"
                value={manualForm.berat_kg || ""}
                onChange={(e) => setManualForm({ ...manualForm, berat_kg: Number(e.target.value) })} />
              <button className="sm:col-span-3 bg-primary text-white rounded py-2 font-medium">
                Simpan Transaksi
              </button>
            </form>
          </section>
        )}

        {tab === "transaksi" && (
          <section className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b bg-gray-50">
                  <th className="py-2 px-4">Tanggal</th>
                  <th className="px-4">Rumah Tangga</th>
                  <th className="px-4">Jenis</th>
                  <th className="px-4">Berat (kg)</th>
                  <th className="px-4">Poin</th>
                </tr>
              </thead>
              <tbody>
                {transaksi.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 px-4">{t.created_at}</td>
                    <td className="px-4">{t.nama_kepala_keluarga}</td>
                    <td className="px-4">{t.jenis_sampah_nama}</td>
                    <td className="px-4">{t.berat_kg}</td>
                    <td className="px-4">{t.poin_didapat}</td>
                  </tr>
                ))}
                {transaksi.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-gray-400">Belum ada transaksi.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}