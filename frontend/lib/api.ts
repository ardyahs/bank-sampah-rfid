import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = (data && data.error) || `Request gagal (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: { id: string; role: string; rumah_tangga_id: string } }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ username, password }) }
    ),

  saldoPoin: (rumahTanggaId: string) =>
    request<{ rumah_tangga_id: string; total_poin: number }>(
      `/api/warga/${rumahTanggaId}/poin`
    ),

  riwayat: (rumahTanggaId: string) =>
    request<any[]>(`/api/warga/${rumahTanggaId}/riwayat`),

  produkTukar: () => request<any[]>("/api/produk-tukar"),

  tukarPoin: (rumahTanggaId: string, produkId: string) =>
    request<any>("/api/tukar-poin", {
      method: "POST",
      body: JSON.stringify({ rumah_tangga_id: rumahTanggaId, produk_id: produkId }),
    }),

  leaderboard: (rt: string) => request<any[]>(`/api/leaderboard/${rt}`),

  jenisSampah: () => request<any[]>("/api/jenis-sampah"),

  // Admin
  listWarga: () => request<any[]>("/api/admin/warga"),
  createWarga: (payload: any) =>
    request<any>("/api/admin/warga", { method: "POST", body: JSON.stringify(payload) }),
  updateWarga: (id: string, payload: any) =>
    request<any>(`/api/admin/warga/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteWarga: (id: string) =>
    request<any>(`/api/admin/warga/${id}`, { method: "DELETE" }),

  createProduk: (payload: any) =>
    request<any>("/api/admin/produk", { method: "POST", body: JSON.stringify(payload) }),
  updateProduk: (id: string, payload: any) =>
    request<any>(`/api/admin/produk/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteProduk: (id: string) =>
    request<any>(`/api/admin/produk/${id}`, { method: "DELETE" }),

  semuaTransaksi: () => request<any[]>("/api/admin/transaksi"),

  setorManual: (rumahTanggaId: string, jenisSampahId: string, beratKg: number) =>
    request<any>("/api/admin/setor-manual", {
      method: "POST",
      body: JSON.stringify({
        rumah_tangga_id: rumahTanggaId,
        jenis_sampah_id: jenisSampahId,
        berat_kg: beratKg,
      }),
    }),
};

