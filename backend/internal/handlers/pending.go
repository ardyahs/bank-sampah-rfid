package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	appmw "bank-sampah-rfid/internal/middleware"

	"github.com/go-chi/chi/v5"
)

// ScanPendingRequest dikirim ESP32: cukup UID kartu (berat opsional, boleh 0
// untuk mode tanpa timbangan). Backend mencari warga lalu menyimpan scan
// sebagai "menunggu" untuk diproses admin di dashboard.
type ScanPendingRequest struct {
	KartuUID string  `json:"kartu_uid"`
	BeratKg  float64 `json:"berat_kg"`
}

func (e *Env) ScanPending(w http.ResponseWriter, r *http.Request) {
	var req ScanPendingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body tidak valid")
		return
	}
	if req.KartuUID == "" {
		writeError(w, http.StatusBadRequest, "kartu_uid wajib diisi")
		return
	}

	ctx := r.Context()
	var rumahTanggaID string
	err := e.DB.QueryRow(ctx, `SELECT id FROM rumah_tangga WHERE kartu_uid = $1`, req.KartuUID).Scan(&rumahTanggaID)
	if err != nil {
		writeError(w, http.StatusNotFound, "kartu tidak terdaftar")
		return
	}

	var id string
	err = e.DB.QueryRow(ctx,
		`INSERT INTO pending_scan (rumah_tangga_id, berat_kg) VALUES ($1, $2) RETURNING id`,
		rumahTanggaID, req.BeratKg,
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menyimpan scan")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":     "menunggu diproses admin",
		"pending_id": id,
	})
}

// ListPending menampilkan scan kartu yang menunggu diproses admin.
func (e *Env) ListPending(w http.ResponseWriter, r *http.Request) {
	rows, err := e.DB.Query(r.Context(), `
		SELECT ps.id, ps.rumah_tangga_id, rt.nama_kepala_keluarga, rt.rt, ps.berat_kg, ps.created_at
		FROM pending_scan ps
		JOIN rumah_tangga rt ON rt.id = ps.rumah_tangga_id
		ORDER BY ps.created_at ASC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil data scan")
		return
	}
	defer rows.Close()

	type pendingRow struct {
		ID                 string  `json:"id"`
		RumahTanggaID      string  `json:"rumah_tangga_id"`
		NamaKepalaKeluarga string  `json:"nama_kepala_keluarga"`
		RT                 string  `json:"rt"`
		BeratKg            float64 `json:"berat_kg"`
		CreatedAt          string  `json:"created_at"`
	}
	daftar := []pendingRow{}
	for rows.Next() {
		var d pendingRow
		var createdAt time.Time
		if err := rows.Scan(&d.ID, &d.RumahTanggaID, &d.NamaKepalaKeluarga, &d.RT, &d.BeratKg, &createdAt); err != nil {
			writeError(w, http.StatusInternalServerError, "gagal membaca data scan")
			return
		}
		d.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
		daftar = append(daftar, d)
	}
	writeJSON(w, http.StatusOK, daftar)
}

// ProsesPendingRequest: admin memilih jenis sampah + berat untuk 1 scan pending.
type ProsesPendingRequest struct {
	JenisSampahID string  `json:"jenis_sampah_id"`
	BeratKg       float64 `json:"berat_kg"`
}

// ProsesPending menyelesaikan scan pending: hitung poin, catat transaksi setor,
// tambah saldo poin warga, lalu hapus baris pending. Semua dalam 1 transaksi DB.
func (e *Env) ProsesPending(w http.ResponseWriter, r *http.Request) {
	pendingID := chi.URLParam(r, "id")

	var req ProsesPendingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body tidak valid")
		return
	}
	if req.JenisSampahID == "" || req.BeratKg <= 0 {
		writeError(w, http.StatusBadRequest, "jenis_sampah_id dan berat_kg (>0) wajib diisi")
		return
	}

	ctx := r.Context()
	tx, err := e.DB.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal memulai transaksi database")
		return
	}
	defer tx.Rollback(ctx)

	var rumahTanggaID string
	err = tx.QueryRow(ctx, `SELECT rumah_tangga_id FROM pending_scan WHERE id = $1 FOR UPDATE`, pendingID).Scan(&rumahTanggaID)
	if err != nil {
		writeError(w, http.StatusNotFound, "scan tidak ditemukan (mungkin sudah diproses)")
		return
	}

	var poinPerKg int
	err = tx.QueryRow(ctx, `SELECT poin_per_kg FROM jenis_sampah WHERE id = $1`, req.JenisSampahID).Scan(&poinPerKg)
	if err != nil {
		writeError(w, http.StatusNotFound, "jenis sampah tidak ditemukan")
		return
	}

	poinDidapat := int(req.BeratKg * float64(poinPerKg))
	petugasID := appmw.UserIDFromContext(ctx)

	var transaksiID string
	err = tx.QueryRow(ctx,
		`INSERT INTO transaksi_setor (rumah_tangga_id, jenis_sampah_id, berat_kg, poin_didapat, petugas_id)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		rumahTanggaID, req.JenisSampahID, req.BeratKg, poinDidapat, petugasID,
	).Scan(&transaksiID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menyimpan transaksi")
		return
	}

	var totalPoin int64
	err = tx.QueryRow(ctx,
		`INSERT INTO saldo_poin (rumah_tangga_id, total_poin, updated_at)
		 VALUES ($1, $2, now())
		 ON CONFLICT (rumah_tangga_id)
		 DO UPDATE SET total_poin = saldo_poin.total_poin + EXCLUDED.total_poin, updated_at = now()
		 RETURNING total_poin`,
		rumahTanggaID, poinDidapat,
	).Scan(&totalPoin)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal memperbarui saldo poin")
		return
	}

	if _, err := tx.Exec(ctx, `DELETE FROM pending_scan WHERE id = $1`, pendingID); err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menghapus scan pending")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menyimpan perubahan")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":          "berhasil",
		"transaksi_id":    transaksiID,
		"poin_didapat":    poinDidapat,
		"total_poin_baru": totalPoin,
	})
}

// HapusPending membatalkan scan pending (mis. kartu salah tempel).
func (e *Env) HapusPending(w http.ResponseWriter, r *http.Request) {
	pendingID := chi.URLParam(r, "id")
	_, err := e.DB.Exec(r.Context(), `DELETE FROM pending_scan WHERE id = $1`, pendingID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal membatalkan scan")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "scan dibatalkan"})
}
