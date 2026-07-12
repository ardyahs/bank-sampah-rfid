package models

import "time"

type RumahTangga struct {
	ID                 string    `json:"id"`
	NamaKepalaKeluarga string    `json:"nama_kepala_keluarga"`
	Alamat             string    `json:"alamat"`
	RT                 string    `json:"rt"`
	RW                 string    `json:"rw"`
	KartuUID           string    `json:"kartu_uid"`
	CreatedAt          time.Time `json:"created_at"`
}

type Pengguna struct {
	ID             string  `json:"id"`
	RumahTanggaID  *string `json:"rumah_tangga_id,omitempty"`
	Username       string  `json:"username"`
	PasswordHash   string  `json:"-"`
	Role           string  `json:"role"`
}

type JenisSampah struct {
	ID         string `json:"id"`
	Nama       string `json:"nama"`
	PoinPerKg  int    `json:"poin_per_kg"`
}

type TransaksiSetor struct {
	ID             string    `json:"id"`
	RumahTanggaID  string    `json:"rumah_tangga_id"`
	JenisSampahID  string    `json:"jenis_sampah_id"`
	JenisSampahNama string   `json:"jenis_sampah_nama,omitempty"`
	BeratKg        float64   `json:"berat_kg"`
	PoinDidapat    int       `json:"poin_didapat"`
	PetugasID      *string   `json:"petugas_id,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type SaldoPoin struct {
	RumahTanggaID string    `json:"rumah_tangga_id"`
	TotalPoin     int64     `json:"total_poin"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ProdukTukar struct {
	ID             string `json:"id"`
	Nama           string `json:"nama"`
	PoinDibutuhkan int    `json:"poin_dibutuhkan"`
	Stok           int    `json:"stok"`
}

type TransaksiTukar struct {
	ID            string    `json:"id"`
	RumahTanggaID string    `json:"rumah_tangga_id"`
	ProdukID      string    `json:"produk_id"`
	PoinTerpakai  int       `json:"poin_terpakai"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

// ScanRequest adalah payload yang dikirim ESP32 setiap ada warga menyetor sampah.
// Isi salah satu dari JenisSampahID atau JenisSampahNama (alat biasanya hanya tahu
// nama jenis sampah dari tombol yang ditekan petugas, bukan UUID di database).
type ScanRequest struct {
	KartuUID        string  `json:"kartu_uid"`
	JenisSampahID   string  `json:"jenis_sampah_id,omitempty"`
	JenisSampahNama string  `json:"jenis_sampah_nama,omitempty"`
	BeratKg         float64 `json:"berat_kg"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LeaderboardRow struct {
	RumahTanggaID      string  `json:"rumah_tangga_id"`
	NamaKepalaKeluarga string  `json:"nama_kepala_keluarga"`
	RT                 string  `json:"rt"`
	JumlahSetor        int64   `json:"jumlah_setor"`
	TotalBeratKg       float64 `json:"total_berat_kg"`
	TotalPoin          int64   `json:"total_poin"`
}
