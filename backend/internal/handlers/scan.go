package handlers

import (
	"encoding/json"
	"net/http"

	"bank-sampah-rfid/internal/models"
)

// Scan menerima data dari ESP32 setiap kali warga menyetor sampah:
// kartu di-scan, berat ditimbang, lalu ESP32 mengirim JSON ke endpoint ini.
func (e *Env) Scan(w http.ResponseWriter, r *http.Request) {
	var req models.ScanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body tidak valid")
		return
	}
	if req.KartuUID == "" || req.BeratKg <= 0 || (req.JenisSampahID == "" && req.JenisSampahNama == "") {
		writeError(w, http.StatusBadRequest, "kartu_uid, berat_kg (>0), dan jenis_sampah_id atau jenis_sampah_nama wajib diisi")
		return
	}

	ctx := r.Context()
	tx, err := e.DB.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal memulai transaksi database")
		return
	}
	defer tx.Rollback(ctx)

	// 1. Cari rumah tangga berdasarkan UID kartu.
	var rumahTanggaID string
	err = tx.QueryRow(ctx, `SELECT id FROM rumah_tangga WHERE kartu_uid = $1`, req.KartuUID).Scan(&rumahTanggaID)
	if err != nil {
		writeError(w, http.StatusNotFound, "kartu tidak terdaftar")
		return
	}

	// 2. Ambil poin per kg dari jenis sampah (cari berdasarkan ID atau nama).
	var poinPerKg int
	var jenisSampahID string
	if req.JenisSampahID != "" {
		err = tx.QueryRow(ctx, `SELECT id, poin_per_kg FROM jenis_sampah WHERE id = $1`, req.JenisSampahID).
			Scan(&jenisSampahID, &poinPerKg)
	} else {
		err = tx.QueryRow(ctx, `SELECT id, poin_per_kg FROM jenis_sampah WHERE lower(nama) = lower($1)`, req.JenisSampahNama).
			Scan(&jenisSampahID, &poinPerKg)
	}
	if err != nil {
		writeError(w, http.StatusNotFound, "jenis sampah tidak ditemukan")
		return
	}

	poinDidapat := int(req.BeratKg * float64(poinPerKg))

	// 3. Simpan transaksi setor.
	var transaksiID string
	err = tx.QueryRow(ctx,
		`INSERT INTO transaksi_setor (rumah_tangga_id, jenis_sampah_id, berat_kg, poin_didapat)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		rumahTanggaID, jenisSampahID, req.BeratKg, poinDidapat,
	).Scan(&transaksiID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menyimpan transaksi")
		return
	}

	// 4. Update saldo poin (upsert).
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
