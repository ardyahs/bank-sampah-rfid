package handlers

import (
	"encoding/json"
	"net/http"

	appmw "bank-sampah-rfid/internal/middleware"
)

// ManualSetorRequest dipakai petugas/admin untuk input transaksi setor lewat
// dashboard web, tanpa lewat alat ESP32 (misalnya saat alat rusak/belum siap,
// atau untuk mengoreksi transaksi yang terlewat).
type ManualSetorRequest struct {
	RumahTanggaID string  `json:"rumah_tangga_id"`
	JenisSampahID string  `json:"jenis_sampah_id"`
	BeratKg       float64 `json:"berat_kg"`
}

// ManualSetor sama logikanya dengan Scan, tapi dipicu dari dashboard (butuh
// login admin/petugas) dan mulai dari rumah_tangga_id langsung, bukan dari
// UID kartu.
func (e *Env) ManualSetor(w http.ResponseWriter, r *http.Request) {
	var req ManualSetorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body tidak valid")
		return
	}
	if req.RumahTanggaID == "" || req.JenisSampahID == "" || req.BeratKg <= 0 {
		writeError(w, http.StatusBadRequest, "rumah_tangga_id, jenis_sampah_id, dan berat_kg (>0) wajib diisi")
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
	err = tx.QueryRow(ctx, `SELECT id FROM rumah_tangga WHERE id = $1`, req.RumahTanggaID).Scan(&rumahTanggaID)
	if err != nil {
		writeError(w, http.StatusNotFound, "rumah tangga tidak ditemukan")
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
