package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"bank-sampah-rfid/internal/models"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

// ---------- Rumah Tangga & Kartu RFID ----------

type CreateRumahTanggaRequest struct {
	NamaKepalaKeluarga string `json:"nama_kepala_keluarga"`
	Alamat             string `json:"alamat"`
	RT                 string `json:"rt"`
	RW                 string `json:"rw"`
	KartuUID           string `json:"kartu_uid"`
	// Opsional: langsung buat akun login warga.
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
}

func (e *Env) ListRumahTangga(w http.ResponseWriter, r *http.Request) {
	rows, err := e.DB.Query(r.Context(),
		`SELECT id, nama_kepala_keluarga, alamat, rt, rw, kartu_uid, created_at FROM rumah_tangga ORDER BY rt, nama_kepala_keluarga`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil data rumah tangga")
		return
	}
	defer rows.Close()

	daftar := []models.RumahTangga{}
	for rows.Next() {
		var rt models.RumahTangga
		if err := rows.Scan(&rt.ID, &rt.NamaKepalaKeluarga, &rt.Alamat, &rt.RT, &rt.RW, &rt.KartuUID, &rt.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "gagal membaca data")
			return
		}
		daftar = append(daftar, rt)
	}
	writeJSON(w, http.StatusOK, daftar)
}

func (e *Env) CreateRumahTangga(w http.ResponseWriter, r *http.Request) {
	var req CreateRumahTanggaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body tidak valid")
		return
	}
	if req.NamaKepalaKeluarga == "" || req.KartuUID == "" || req.RT == "" {
		writeError(w, http.StatusBadRequest, "nama_kepala_keluarga, rt, dan kartu_uid wajib diisi")
		return
	}

	ctx := r.Context()
	tx, err := e.DB.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal memulai transaksi")
		return
	}
	defer tx.Rollback(ctx)

	var id string
	err = tx.QueryRow(ctx,
		`INSERT INTO rumah_tangga (nama_kepala_keluarga, alamat, rt, rw, kartu_uid)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		req.NamaKepalaKeluarga, req.Alamat, req.RT, req.RW, req.KartuUID,
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusConflict, "gagal menyimpan (kartu_uid mungkin sudah terpakai)")
		return
	}

	if _, err := tx.Exec(ctx, `INSERT INTO saldo_poin (rumah_tangga_id, total_poin) VALUES ($1, 0)`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "gagal membuat saldo awal")
		return
	}

	if req.Username != "" && req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "gagal membuat akun login")
			return
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO pengguna (rumah_tangga_id, username, password_hash, role) VALUES ($1, $2, $3, 'warga')`,
			id, req.Username, string(hash),
		); err != nil {
			writeError(w, http.StatusConflict, "gagal membuat akun login (username mungkin sudah dipakai)")
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menyimpan perubahan")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (e *Env) UpdateRumahTangga(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req CreateRumahTanggaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body tidak valid")
		return
	}

	_, err := e.DB.Exec(r.Context(),
		`UPDATE rumah_tangga SET nama_kepala_keluarga=$1, alamat=$2, rt=$3, rw=$4, kartu_uid=$5 WHERE id=$6`,
		req.NamaKepalaKeluarga, req.Alamat, req.RT, req.RW, req.KartuUID, id,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal memperbarui data")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "berhasil diperbarui"})
}

func (e *Env) DeleteRumahTangga(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, err := e.DB.Exec(r.Context(), `DELETE FROM rumah_tangga WHERE id=$1`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menghapus data")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "berhasil dihapus"})
}

// SetPasswordWargaRequest dipakai admin untuk membuat/mengganti akun login
// warga (mis. warga lupa password, atau baru mau dikasih akun sekarang).
type SetPasswordWargaRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (e *Env) SetPasswordWarga(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req SetPasswordWargaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body tidak valid")
		return
	}
	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "username dan password wajib diisi")
		return
	}

	ctx := r.Context()

	var exists string
	if err := e.DB.QueryRow(ctx, `SELECT id FROM rumah_tangga WHERE id = $1`, id).Scan(&exists); err != nil {
		writeError(w, http.StatusNotFound, "rumah tangga tidak ditemukan")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal memproses password")
		return
	}

	tag, err := e.DB.Exec(ctx,
		`UPDATE pengguna SET username = $1, password_hash = $2 WHERE rumah_tangga_id = $3 AND role = 'warga'`,
		req.Username, string(hash), id,
	)
	if err != nil {
		writeError(w, http.StatusConflict, "gagal memperbarui akun (username mungkin sudah dipakai)")
		return
	}

	if tag.RowsAffected() == 0 {
		_, err = e.DB.Exec(ctx,
			`INSERT INTO pengguna (rumah_tangga_id, username, password_hash, role) VALUES ($1, $2, $3, 'warga')`,
			id, req.Username, string(hash),
		)
		if err != nil {
			writeError(w, http.StatusConflict, "gagal membuat akun (username mungkin sudah dipakai)")
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "akun warga berhasil diperbarui"})
}

// ---------- Jenis Sampah ----------

func (e *Env) ListJenisSampah(w http.ResponseWriter, r *http.Request) {
	rows, err := e.DB.Query(r.Context(), `SELECT id, nama, poin_per_kg FROM jenis_sampah ORDER BY nama`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil data jenis sampah")
		return
	}
	defer rows.Close()

	daftar := []models.JenisSampah{}
	for rows.Next() {
		var j models.JenisSampah
		if err := rows.Scan(&j.ID, &j.Nama, &j.PoinPerKg); err != nil {
			writeError(w, http.StatusInternalServerError, "gagal membaca data")
			return
		}
		daftar = append(daftar, j)
	}
	writeJSON(w, http.StatusOK, daftar)
}

// ---------- Produk Tukar ----------

type ProdukRequest struct {
	Nama           string `json:"nama"`
	PoinDibutuhkan int    `json:"poin_dibutuhkan"`
	Stok           int    `json:"stok"`
}

func (e *Env) CreateProduk(w http.ResponseWriter, r *http.Request) {
	var req ProdukRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body tidak valid")
		return
	}
	var id string
	err := e.DB.QueryRow(r.Context(),
		`INSERT INTO produk_tukar (nama, poin_dibutuhkan, stok) VALUES ($1, $2, $3) RETURNING id`,
		req.Nama, req.PoinDibutuhkan, req.Stok,
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menyimpan produk")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (e *Env) UpdateProduk(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req ProdukRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body tidak valid")
		return
	}
	_, err := e.DB.Exec(r.Context(),
		`UPDATE produk_tukar SET nama=$1, poin_dibutuhkan=$2, stok=$3 WHERE id=$4`,
		req.Nama, req.PoinDibutuhkan, req.Stok, id,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal memperbarui produk")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "berhasil diperbarui"})
}

func (e *Env) DeleteProduk(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, err := e.DB.Exec(r.Context(), `DELETE FROM produk_tukar WHERE id=$1`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menghapus produk")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "berhasil dihapus"})
}

// ---------- Monitoring Transaksi (semua rumah tangga) ----------

func (e *Env) ListSemuaTransaksi(w http.ResponseWriter, r *http.Request) {
	rows, err := e.DB.Query(r.Context(), `
		SELECT ts.id, ts.rumah_tangga_id, rt.nama_kepala_keluarga, ts.jenis_sampah_id, js.nama,
		       ts.berat_kg, ts.poin_didapat, ts.created_at
		FROM transaksi_setor ts
		JOIN rumah_tangga rt ON rt.id = ts.rumah_tangga_id
		JOIN jenis_sampah js ON js.id = ts.jenis_sampah_id
		ORDER BY ts.created_at DESC
		LIMIT 500`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil data transaksi")
		return
	}
	defer rows.Close()

	type row struct {
		ID                 string  `json:"id"`
		RumahTanggaID      string  `json:"rumah_tangga_id"`
		NamaKepalaKeluarga string  `json:"nama_kepala_keluarga"`
		JenisSampahID      string  `json:"jenis_sampah_id"`
		JenisSampahNama    string  `json:"jenis_sampah_nama"`
		BeratKg            float64 `json:"berat_kg"`
		PoinDidapat        int     `json:"poin_didapat"`
		CreatedAt          string  `json:"created_at"`
	}

	daftar := []row{}
	for rows.Next() {
		var d row
		var t models.TransaksiSetor
		if err := rows.Scan(&t.ID, &t.RumahTanggaID, &d.NamaKepalaKeluarga, &t.JenisSampahID, &t.JenisSampahNama, &t.BeratKg, &t.PoinDidapat, &t.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "gagal membaca data")
			return
		}
		d.ID = t.ID
		d.RumahTanggaID = t.RumahTanggaID
		d.JenisSampahID = t.JenisSampahID
		d.JenisSampahNama = t.JenisSampahNama
		d.BeratKg = t.BeratKg
		d.PoinDidapat = t.PoinDidapat
		d.CreatedAt = t.CreatedAt.Format("2006-01-02 15:04:05")
		daftar = append(daftar, d)
	}
	writeJSON(w, http.StatusOK, daftar)
}

// ListSemuaTransaksiTukar mengembalikan riwayat penukaran poin (barang yang
// sudah diambil warga) dari semua rumah tangga, untuk dipantau admin.
func (e *Env) ListSemuaTransaksiTukar(w http.ResponseWriter, r *http.Request) {
	rows, err := e.DB.Query(r.Context(), `
		SELECT tt.id, tt.rumah_tangga_id, rt.nama_kepala_keluarga, tt.produk_id, pt.nama,
		       tt.poin_terpakai, tt.status, tt.created_at
		FROM transaksi_tukar tt
		JOIN rumah_tangga rt ON rt.id = tt.rumah_tangga_id
		JOIN produk_tukar pt ON pt.id = tt.produk_id
		ORDER BY tt.created_at DESC
		LIMIT 500`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil data penukaran")
		return
	}
	defer rows.Close()

	type tukarRow struct {
		ID                 string `json:"id"`
		RumahTanggaID      string `json:"rumah_tangga_id"`
		NamaKepalaKeluarga string `json:"nama_kepala_keluarga"`
		ProdukID           string `json:"produk_id"`
		ProdukNama         string `json:"produk_nama"`
		PoinTerpakai       int    `json:"poin_terpakai"`
		Status             string `json:"status"`
		CreatedAt          string `json:"created_at"`
	}

	daftar := []tukarRow{}
	for rows.Next() {
		var d tukarRow
		var createdAt time.Time
		if err := rows.Scan(&d.ID, &d.RumahTanggaID, &d.NamaKepalaKeluarga, &d.ProdukID, &d.ProdukNama, &d.PoinTerpakai, &d.Status, &createdAt); err != nil {
			writeError(w, http.StatusInternalServerError, "gagal membaca data penukaran")
			return
		}
		d.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
		daftar = append(daftar, d)
	}
	writeJSON(w, http.StatusOK, daftar)
}
