package handlers

import (
	"net/http"

	"bank-sampah-rfid/internal/models"

	"github.com/go-chi/chi/v5"
)

// Leaderboard mengembalikan ranking rumah tangga dalam satu RT berdasarkan total poin.
// Gunakan rt = "semua" untuk melihat ranking lintas RT.
func (e *Env) Leaderboard(w http.ResponseWriter, r *http.Request) {
	rt := chi.URLParam(r, "rt")

	query := `
		SELECT rt.id, rt.nama_kepala_keluarga, rt.rt,
		       COALESCE(SUM(ts.berat_kg), 0) AS total_berat,
		       COALESCE(sp.total_poin, 0) AS total_poin
		FROM rumah_tangga rt
		LEFT JOIN transaksi_setor ts ON ts.rumah_tangga_id = rt.id
		LEFT JOIN saldo_poin sp ON sp.rumah_tangga_id = rt.id
		WHERE ($1 = 'semua' OR rt.rt = $1)
		GROUP BY rt.id, rt.nama_kepala_keluarga, rt.rt, sp.total_poin
		ORDER BY total_poin DESC
		LIMIT 100`

	rows, err := e.DB.Query(r.Context(), query, rt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil leaderboard")
		return
	}
	defer rows.Close()

	hasil := []models.LeaderboardRow{}
	for rows.Next() {
		var row models.LeaderboardRow
		if err := rows.Scan(&row.RumahTanggaID, &row.NamaKepalaKeluarga, &row.RT, &row.TotalBeratKg, &row.TotalPoin); err != nil {
			writeError(w, http.StatusInternalServerError, "gagal membaca data leaderboard")
			return
		}
		hasil = append(hasil, row)
	}

	writeJSON(w, http.StatusOK, hasil)
}
