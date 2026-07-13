"use client";

import { Fragment, useEffect, useState } from "react";
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

type TransaksiTukar = {
  id: string;
  nama_kepala_keluarga: string;
  produk_nama: string;
  poin_terpakai: number;
  status: string;
  created_at: string;
};

type JenisSampah = {
  id: string;
  nama: string;
  poin_per_kg: number;
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

const PRESET_PRODUK = [
  "Beras 1kg",
  "Beras 5kg",
  "Minyak Goreng 1 Liter",
  "Gula Pasir 1kg",
  "Sabun Mandi",
  "Sabun Cuci/Deterjen",
  "Mie Instan (1 Dus)",
  "Telur 1kg",
  "Kopi Sachet (1 Renceng)",
  "Teh Celup (1 Kotak)",
  "Kecap 1 Botol",
  "Garam 1 Bungkus",
];
const OPSI_LAINNYA = "Lainnya (isi manual)";

const emptyWargaForm = {
  nama_kepala_keluarga: "",
  alamat: "",
  rt: "",
  rw: "",
  kartu_uid: "",
  username: "",
  password: "",
};

const emptyProdukForm = { preset: "", customNama: "", poin_dibutuhkan: 0, stok: 0 };
const emptyManualForm = { rumah_tangga_id: "", jenis_sampah_id: "", berat_kg: 0 };

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<"warga" | "produk" | "transaksi" | "manual" | "leaderboard" | "kontak">("warga");

  const [warga, setWarga] = useState<Warga[]>([]);
  const [transaksi, setTransaksi] = useState<Transaksi[]>([]);
  const [transaksiTukar, setTransaksiTukar] = useState<TransaksiTukar[]>([]);
  const [jenisSampahList, setJenisSampahList] = useState<JenisSampah[]>([]);
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [editStok, setEditStok] = useState<Record<string, number>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardRt, setLeaderboardRt] = useState("semua");
  const [wargaForm, setWargaForm] = useState(emptyWargaForm);
  const [produkForm, setProdukForm] = useState(emptyProdukForm);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [pesan, setPesan] = useState("");
  const [loading, setLoading] = useState(true);
  const [cariWarga, setCariWarga] = useState("");
  const [editingWargaId, setEditingWargaId] = useState<string | null>(null);
  const [editKartuUid, setEditKartuUid] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [kontakForm, setKontakForm] = useState({
    nama_kontak: "",
    whatsapp: "",
    telepon: "",
    email: "",
    alamat: "",
    jam_operasional: "",
  });

  useEffect(() => {
    const u = getUser();
    if (!u || (u.role !== "admin" && u.role !== "petugas")) {
      router.replace("/login");
      return;
    }
    setUser(u);
    muatSemua();
  }, [router]);

  useEffect(() => {
    if (!user || tab !== "leaderboard") return;
    api
      .leaderboard(leaderboardRt)
      .then(setLeaderboard)
      .catch((err) => setPesan(err instanceof ApiError ? err.message : "Gagal memuat leaderboard"));
  }, [user, tab, leaderboardRt]);

  useEffect(() => {
    if (!user || tab !== "kontak") return;
    api
      .getKontak()
      .then(setKontakForm)
      .catch((err) => setPesan(err instanceof ApiError ? err.message : "Gagal memuat kontak"));
  }, [user, tab]);

  async function muatSemua() {
    setLoading(true);
    try {
      const [wargaData, transaksiData, transaksiTukarData, jenisSampahData, produkData] = await Promise.all([
        api.listWarga(),
        api.semuaTransaksi(),
        api.semuaTransaksiTukar(),
        api.jenisSampah(),
        api.produkTukar(),
      ]);
      setWarga(wargaData);
      setTransaksi(transaksiData);
      setTransaksiTukar(transaksiTukarData);
      setJenisSampahList(jenisSampahData);
      setProdukList(produkData);
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

  function mulaiEditWarga(w: Warga) {
    setEditingWargaId(w.id);
    setEditKartuUid(w.kartu_uid);
    setEditUsername("");
    setEditPassword("");
    setPesan("");
  }

  function batalEditWarga() {
    setEditingWargaId(null);
  }

  async function simpanKartuUid(w: Warga) {
    setPesan("");
    try {
      await api.updateWarga(w.id, {
        nama_kepala_keluarga: w.nama_kepala_keluarga,
        alamat: w.alamat,
        rt: w.rt,
        rw: w.rw,
        kartu_uid: editKartuUid,
      });
      setPesan(`UID kartu ${w.nama_kepala_keluarga} berhasil diperbarui.`);
      muatSemua();
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal memperbarui UID kartu");
    }
  }

  async function simpanPasswordWarga(w: Warga) {
    if (!editUsername || !editPassword) {
      setPesan("Isi username dan password baru dulu.");
      return;
    }
    setPesan("");
    try {
      await api.setPasswordWarga(w.id, editUsername, editPassword);
      setPesan(`Akun login ${w.nama_kepala_keluarga} berhasil diperbarui.`);
      setEditUsername("");
      setEditPassword("");
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal memperbarui akun warga");
    }
  }

  async function tambahProduk(e: React.FormEvent) {
    e.preventDefault();
    setPesan("");
    const nama = produkForm.preset === OPSI_LAINNYA ? produkForm.customNama.trim() : produkForm.preset;
    if (!nama) {
      setPesan("Pilih barang dari daftar atau isi nama barang lain dulu.");
      return;
    }
    try {
      await api.createProduk({
        nama,
        poin_dibutuhkan: produkForm.poin_dibutuhkan,
        stok: produkForm.stok,
      });
      setProdukForm(emptyProdukForm);
      setPesan("Produk tukar berhasil ditambahkan.");
      muatSemua();
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal menambah produk");
    }
  }

  async function updateStokProduk(p: Produk) {
    const stokBaru = editStok[p.id] ?? p.stok;
    setPesan("");
    try {
      await api.updateProduk(p.id, {
        nama: p.nama,
        poin_dibutuhkan: p.poin_dibutuhkan,
        stok: stokBaru,
      });
      setPesan(`Stok "${p.nama}" berhasil diperbarui menjadi ${stokBaru}.`);
      muatSemua();
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal memperbarui stok");
    }
  }

  async function hapusProduk(id: string) {
    if (!confirm("Hapus produk tukar ini?")) return;
    try {
      await api.deleteProduk(id);
      setPesan("Produk berhasil dihapus.");
      muatSemua();
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal menghapus produk");
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

  async function simpanKontak(e: React.FormEvent) {
    e.preventDefault();
    setPesan("");
    try {
      await api.updateKontak(kontakForm);
      setPesan("Info kontak berhasil disimpan.");
    } catch (err) {
      setPesan(err instanceof ApiError ? err.message : "Gagal menyimpan kontak");
    }
  }

  if (loading)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <span className="text-4xl animate-pulse" aria-hidden>♻️</span>
        <p className="text-green-700/80 text-sm">Memuat...</p>
      </div>
    );

  const tabLabel: Record<string, string> = {
    warga: "👥 Kelola Warga",
    produk: "🎁 Produk Tukar",
    manual: "✏️ Input Manual",
    transaksi: "📊 Monitor Transaksi",
    leaderboard: "🏆 Leaderboard",
    kontak: "📞 Kontak",
  };

  return (
    <div>
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto p-5 sm:p-6 space-y-6">
        <div className="flex gap-2 flex-wrap">
          {(["warga", "produk", "manual", "transaksi", "leaderboard", "kontak"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t
                  ? "bg-primary text-white shadow-eco-sm"
                  : "bg-white text-gray-600 border border-green-200 hover:bg-green-50"
              }`}
            >
              {tabLabel[t]}
            </button>
          ))}
        </div>

        {pesan && (
          <div className="bg-green-50 border border-green-100 text-green-800 text-sm p-3 rounded-lg flex items-center gap-2">
            <span aria-hidden>ℹ️</span> {pesan}
          </div>
        )}

        {tab === "warga" && (
          <section className="space-y-4">
            <form onSubmit={tambahWarga} className="eco-card p-6 grid sm:grid-cols-2 gap-3">
              <h2 className="eco-title sm:col-span-2 flex items-center gap-2">➕ Tambah Rumah Tangga</h2>
              <input required placeholder="Nama Kepala Keluarga" className="eco-input"
                value={wargaForm.nama_kepala_keluarga}
                onChange={(e) => setWargaForm({ ...wargaForm, nama_kepala_keluarga: e.target.value })} />
              <input required placeholder="Alamat" className="eco-input"
                value={wargaForm.alamat}
                onChange={(e) => setWargaForm({ ...wargaForm, alamat: e.target.value })} />
              <input required placeholder="RT" className="eco-input"
                value={wargaForm.rt}
                onChange={(e) => setWargaForm({ ...wargaForm, rt: e.target.value })} />
              <input placeholder="RW" className="eco-input"
                value={wargaForm.rw}
                onChange={(e) => setWargaForm({ ...wargaForm, rw: e.target.value })} />
              <input required placeholder="UID Kartu RFID" className="eco-input"
                value={wargaForm.kartu_uid}
                onChange={(e) => setWargaForm({ ...wargaForm, kartu_uid: e.target.value })} />
              <div />
              <input placeholder="Username login warga (opsional)" className="eco-input"
                value={wargaForm.username}
                onChange={(e) => setWargaForm({ ...wargaForm, username: e.target.value })} />
              <input placeholder="Password login warga (opsional)" type="password" className="eco-input"
                value={wargaForm.password}
                onChange={(e) => setWargaForm({ ...wargaForm, password: e.target.value })} />
              <button className="eco-btn-primary sm:col-span-2 py-2.5">
                Simpan
              </button>
            </form>

            <input
              placeholder="🔍 Cari nama warga..."
              className="eco-input w-full sm:w-72"
              value={cariWarga}
              onChange={(e) => setCariWarga(e.target.value)}
            />

            <div className="eco-card overflow-hidden">
              <div className="overflow-x-auto">
              <table className="eco-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>RT/RW</th>
                    <th>UID Kartu</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {warga
                    .filter((w) =>
                      w.nama_kepala_keluarga.toLowerCase().includes(cariWarga.toLowerCase())
                    )
                    .map((w) => (
                      <Fragment key={w.id}>
                        <tr>
                          <td className="font-medium text-gray-800">{w.nama_kepala_keluarga}</td>
                          <td>{w.rt}/{w.rw}</td>
                          <td className="font-mono text-xs text-gray-600">{w.kartu_uid}</td>
                          <td className="whitespace-nowrap">
                            <button
                              onClick={() =>
                                editingWargaId === w.id ? batalEditWarga() : mulaiEditWarga(w)
                              }
                              className="text-primary font-medium text-xs mr-3 hover:underline"
                            >
                              {editingWargaId === w.id ? "Tutup" : "Edit"}
                            </button>
                            <button onClick={() => hapusWarga(w.id)} className="text-red-500 font-medium text-xs hover:underline">
                              Hapus
                            </button>
                          </td>
                        </tr>
                        {editingWargaId === w.id && (
                          <tr key={`${w.id}-edit`} className="bg-green-50/60">
                            <td colSpan={4} className="px-4 py-4">
                              <div className="grid sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-green-800">
                                    Ganti UID Kartu (kartu hilang/rusak)
                                  </p>
                                  <input
                                    className="eco-input"
                                    value={editKartuUid}
                                    onChange={(e) => setEditKartuUid(e.target.value)}
                                  />
                                  <button
                                    onClick={() => simpanKartuUid(w)}
                                    className="eco-btn-primary text-xs px-3 py-1.5"
                                  >
                                    Simpan UID Kartu
                                  </button>
                                </div>
                                <div className="sm:col-span-2 space-y-2">
                                  <p className="text-xs font-semibold text-green-800">
                                    Buat/Ganti Password Login Warga
                                  </p>
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                      placeholder="Username baru"
                                      className="eco-input"
                                      value={editUsername}
                                      onChange={(e) => setEditUsername(e.target.value)}
                                    />
                                    <input
                                      placeholder="Password baru"
                                      type="text"
                                      className="eco-input"
                                      value={editPassword}
                                      onChange={(e) => setEditPassword(e.target.value)}
                                    />
                                  </div>
                                  <button
                                    onClick={() => simpanPasswordWarga(w)}
                                    className="eco-btn-primary text-xs px-3 py-1.5"
                                  >
                                    Simpan Akun Login
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  {warga.length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-gray-400">Belum ada data.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </section>
        )}

        {tab === "produk" && (
          <section className="space-y-4">
            <form onSubmit={tambahProduk} className="eco-card p-6 grid sm:grid-cols-2 gap-3">
              <h2 className="eco-title sm:col-span-2 flex items-center gap-2">➕ Tambah Produk Tukar</h2>

              <select required className="eco-input"
                value={produkForm.preset}
                onChange={(e) => setProdukForm({ ...produkForm, preset: e.target.value })}>
                <option value="">Pilih Barang</option>
                {PRESET_PRODUK.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value={OPSI_LAINNYA}>{OPSI_LAINNYA}</option>
              </select>

              {produkForm.preset === OPSI_LAINNYA ? (
                <input required placeholder="Nama barang lain" className="eco-input"
                  value={produkForm.customNama}
                  onChange={(e) => setProdukForm({ ...produkForm, customNama: e.target.value })} />
              ) : (
                <div />
              )}

              <input required type="number" min="1" placeholder="Poin Dibutuhkan" className="eco-input"
                value={produkForm.poin_dibutuhkan || ""}
                onChange={(e) => setProdukForm({ ...produkForm, poin_dibutuhkan: Number(e.target.value) })} />
              <input required type="number" min="0" placeholder="Stok Awal" className="eco-input"
                value={produkForm.stok || ""}
                onChange={(e) => setProdukForm({ ...produkForm, stok: Number(e.target.value) })} />

              <button className="eco-btn-primary sm:col-span-2 py-2.5">
                Simpan Produk
              </button>
            </form>

            <div className="eco-card overflow-hidden">
              <div className="overflow-x-auto">
              <table className="eco-table">
                <thead>
                  <tr>
                    <th>Nama Barang</th>
                    <th>Poin Dibutuhkan</th>
                    <th>Stok</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {produkList.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium text-gray-800">{p.nama}</td>
                      <td><span className="eco-badge">{p.poin_dibutuhkan}</span></td>
                      <td>
                        <input type="number" min="0" className="eco-input w-20 py-1"
                          value={editStok[p.id] ?? p.stok}
                          onChange={(e) =>
                            setEditStok({ ...editStok, [p.id]: Number(e.target.value) })
                          } />
                      </td>
                      <td className="whitespace-nowrap">
                        <button onClick={() => updateStokProduk(p)} className="text-primary font-medium text-xs mr-3 hover:underline">
                          Update Stok
                        </button>
                        <button onClick={() => hapusProduk(p.id)} className="text-red-500 font-medium text-xs hover:underline">
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {produkList.length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-gray-400">Belum ada produk tukar.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </section>
        )}

        {tab === "manual" && (
          <section className="eco-card p-6">
            <h2 className="eco-title mb-1 flex items-center gap-2">✏️ Input Transaksi Manual</h2>
            <p className="text-sm text-gray-500 mb-4">
              Dipakai kalau alat RFID belum siap/rusak, atau untuk mengoreksi transaksi yang terlewat.
            </p>
            <form onSubmit={kirimManual} className="grid sm:grid-cols-3 gap-3">
              <select required className="eco-input"
                value={manualForm.rumah_tangga_id}
                onChange={(e) => setManualForm({ ...manualForm, rumah_tangga_id: e.target.value })}>
                <option value="">Pilih Rumah Tangga</option>
                {warga.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nama_kepala_keluarga} (RT {w.rt})
                  </option>
                ))}
              </select>
              <select required className="eco-input"
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
                className="eco-input"
                value={manualForm.berat_kg || ""}
                onChange={(e) => setManualForm({ ...manualForm, berat_kg: Number(e.target.value) })} />
              <button className="eco-btn-primary sm:col-span-3 py-2.5">
                Simpan Transaksi
              </button>
            </form>
          </section>
        )}

        {tab === "transaksi" && (
          <section className="space-y-6">
            <div>
              <h2 className="eco-title mb-2 flex items-center gap-2">📊 Riwayat Setor Sampah</h2>
              <div className="eco-card overflow-hidden">
                <div className="overflow-x-auto">
                <table className="eco-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Rumah Tangga</th>
                      <th>Jenis</th>
                      <th>Berat (kg)</th>
                      <th>Poin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transaksi.map((t) => (
                      <tr key={t.id}>
                        <td>{t.created_at}</td>
                        <td className="font-medium text-gray-800">{t.nama_kepala_keluarga}</td>
                        <td>{t.jenis_sampah_nama}</td>
                        <td>{t.berat_kg}</td>
                        <td className="font-medium text-primary-dark">+{t.poin_didapat}</td>
                      </tr>
                    ))}
                    {transaksi.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-gray-400">Belum ada transaksi.</td></tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <div>
              <h2 className="eco-title mb-2 flex items-center gap-2">🎁 Riwayat Penukaran Poin (Barang Diambil Warga)</h2>
              <div className="eco-card overflow-hidden">
                <div className="overflow-x-auto">
                <table className="eco-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Rumah Tangga</th>
                      <th>Barang</th>
                      <th>Poin Terpakai</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transaksiTukar.map((t) => (
                      <tr key={t.id}>
                        <td>{t.created_at}</td>
                        <td className="font-medium text-gray-800">{t.nama_kepala_keluarga}</td>
                        <td>{t.produk_nama}</td>
                        <td>{t.poin_terpakai}</td>
                        <td><span className="eco-badge capitalize">{t.status}</span></td>
                      </tr>
                    ))}
                    {transaksiTukar.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-gray-400">Belum ada penukaran.</td></tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "leaderboard" && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="text-sm text-gray-500">
                Ranking rumah tangga yang paling sering menyetor sampah.
              </p>
              <input
                className="eco-input text-sm sm:ml-auto sm:w-56"
                placeholder="Filter RT (mis. 03) atau 'semua'"
                value={leaderboardRt}
                onChange={(e) => setLeaderboardRt(e.target.value || "semua")}
              />
            </div>
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
                  {leaderboard.map((row, i) => (
                    <tr key={row.rumah_tangga_id}>
                      <td>
                        <span className="font-semibold text-gray-700">
                          {["🥇", "🥈", "🥉"][i] ?? i + 1}
                        </span>
                      </td>
                      <td className="font-medium text-gray-800">{row.nama_kepala_keluarga}</td>
                      <td>{row.rt}</td>
                      <td><span className="eco-badge">{row.jumlah_setor}x</span></td>
                      <td>{row.total_berat_kg}</td>
                      <td className="font-semibold text-primary-dark">{row.total_poin.toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                  {leaderboard.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-gray-400">Belum ada data.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </section>
        )}

        {tab === "kontak" && (
          <section className="eco-card p-6 max-w-xl">
            <h2 className="eco-title mb-1 flex items-center gap-2">📞 Contact Center</h2>
            <p className="text-sm text-gray-500 mb-4">
              Info ini akan ditampilkan ke warga supaya tahu cara menghubungi pengelola bank sampah.
            </p>
            <form onSubmit={simpanKontak} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nama Kontak/Petugas</label>
                <input className="eco-input"
                  value={kontakForm.nama_kontak}
                  onChange={(e) => setKontakForm({ ...kontakForm, nama_kontak: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nomor WhatsApp</label>
                <input placeholder="mis. 6281234567890 (pakai kode negara, tanpa +)" className="eco-input"
                  value={kontakForm.whatsapp}
                  onChange={(e) => setKontakForm({ ...kontakForm, whatsapp: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nomor Telepon (opsional)</label>
                <input className="eco-input"
                  value={kontakForm.telepon}
                  onChange={(e) => setKontakForm({ ...kontakForm, telepon: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email (opsional)</label>
                <input className="eco-input"
                  value={kontakForm.email}
                  onChange={(e) => setKontakForm({ ...kontakForm, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Alamat</label>
                <textarea className="eco-input" rows={2}
                  value={kontakForm.alamat}
                  onChange={(e) => setKontakForm({ ...kontakForm, alamat: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Jam Operasional</label>
                <input placeholder="mis. Senin-Sabtu, 08.00-16.00" className="eco-input"
                  value={kontakForm.jam_operasional}
                  onChange={(e) => setKontakForm({ ...kontakForm, jam_operasional: e.target.value })} />
              </div>
              <button className="eco-btn-primary py-2.5 px-5">
                Simpan Kontak
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
