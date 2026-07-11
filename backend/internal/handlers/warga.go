package handlers

import (
	"net/http"

	"bank-sampah-rfid/internal/models"

	"github.com/go-chi/chi/v5"
)

// SaldoPoin mengembalikan total poin milik satu rumah tangga.
func (e *Env) SaldoPoin(w http.ResponseWriter, r *http.Request) {
	rumahTanggaID := chi.URLParam(r, "id")

	var totalPoin int64
	err := e.DB.QueryRow(r.Context(),
		`SELECT COALESCE(total_poin, 0) FROM saldo_poin WHERE rumah_tangga_id = $1`,
		rumahTanggaID,
	).Scan(&totalPoin)
	if err != nil {
		// Belum pernah setor sama sekali -> saldo 0, bukan error.
		totalPoin = 0
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rumah_tangga_id": rumahTanggaID,
		"total_poin":      totalPoin,
	})
}

// RiwayatTransaksi mengembalikan daftar riwayat setor sampah milik satu rumah tangga.
func (e *Env) RiwayatTransaksi(w http.ResponseWriter, r *http.Request) {
	rumahTanggaID := chi.URLParam(r, "id")

	rows, err := e.DB.Query(r.Context(), `
		SELECT ts.id, ts.rumah_tangga_id, ts.jenis_sampah_id, js.nama, ts.berat_kg, ts.poin_didapat, ts.created_at
		FROM transaksi_setor ts
		JOIN jenis_sampah js ON js.id = ts.jenis_sampah_id
		WHERE ts.rumah_tangga_id = $1
		ORDER BY ts.created_at DESC
		LIMIT 200`,
		rumahTanggaID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil riwayat")
		return
	}
	defer rows.Close()

	riwayat := []models.TransaksiSetor{}
	for rows.Next() {
		var t models.TransaksiSetor
		if err := rows.Scan(&t.ID, &t.RumahTanggaID, &t.JenisSampahID, &t.JenisSampahNama, &t.BeratKg, &t.PoinDidapat, &t.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "gagal membaca data riwayat")
			return
		}
		riwayat = append(riwayat, t)
	}

	writeJSON(w, http.StatusOK, riwayat)
}
