package handlers

import (
	"encoding/json"
	"net/http"

	appmw "bank-sampah-rfid/internal/middleware"
)

type TukarPoinRequest struct {
	RumahTanggaID string `json:"rumah_tangga_id"`
	ProdukID      string `json:"produk_id"`
}

// TukarPoin menukar poin milik warga dengan salah satu produk_tukar (sembako dll).
func (e *Env) TukarPoin(w http.ResponseWriter, r *http.Request) {
	var req TukarPoinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body tidak valid")
		return
	}
	if req.RumahTanggaID == "" || req.ProdukID == "" {
		writeError(w, http.StatusBadRequest, "rumah_tangga_id dan produk_id wajib diisi")
		return
	}

	// Warga hanya boleh menukar poin miliknya sendiri (admin/petugas bebas).
	role := appmw.RoleFromContext(r.Context())
	if role == "warga" && appmw.RumahTanggaIDFromContext(r.Context()) != req.RumahTanggaID {
		writeError(w, http.StatusForbidden, "tidak boleh menukar poin milik rumah tangga lain")
		return
	}

	ctx := r.Context()
	tx, err := e.DB.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal memulai transaksi database")
		return
	}
	defer tx.Rollback(ctx)

	var poinDibutuhkan, stok int
	err = tx.QueryRow(ctx, `SELECT poin_dibutuhkan, stok FROM produk_tukar WHERE id = $1 FOR UPDATE`, req.ProdukID).
		Scan(&poinDibutuhkan, &stok)
	if err != nil {
		writeError(w, http.StatusNotFound, "produk tidak ditemukan")
		return
	}
	if stok <= 0 {
		writeError(w, http.StatusConflict, "stok produk habis")
		return
	}

	var totalPoin int64
	err = tx.QueryRow(ctx, `SELECT COALESCE(total_poin, 0) FROM saldo_poin WHERE rumah_tangga_id = $1 FOR UPDATE`, req.RumahTanggaID).
		Scan(&totalPoin)
	if err != nil {
		writeError(w, http.StatusBadRequest, "warga belum memiliki saldo poin")
		return
	}
	if totalPoin < int64(poinDibutuhkan) {
		writeError(w, http.StatusBadRequest, "poin tidak mencukupi")
		return
	}

	var transaksiID string
	err = tx.QueryRow(ctx,
		`INSERT INTO transaksi_tukar (rumah_tangga_id, produk_id, poin_terpakai, status)
		 VALUES ($1, $2, $3, 'selesai') RETURNING id`,
		req.RumahTanggaID, req.ProdukID, poinDibutuhkan,
	).Scan(&transaksiID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menyimpan transaksi tukar")
		return
	}

	if _, err := tx.Exec(ctx, `UPDATE saldo_poin SET total_poin = total_poin - $1, updated_at = now() WHERE rumah_tangga_id = $2`,
		poinDibutuhkan, req.RumahTanggaID); err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengurangi saldo poin")
		return
	}

	if _, err := tx.Exec(ctx, `UPDATE produk_tukar SET stok = stok - 1 WHERE id = $1`, req.ProdukID); err != nil {
		writeError(w, http.StatusInternalServerError, "gagal memperbarui stok produk")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menyimpan perubahan")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":        "berhasil",
		"transaksi_id":  transaksiID,
		"poin_terpakai": poinDibutuhkan,
		"sisa_poin":     totalPoin - int64(poinDibutuhkan),
	})
}

// ListProdukTukar mengembalikan daftar produk yang bisa ditukar dengan poin.
func (e *Env) ListProdukTukar(w http.ResponseWriter, r *http.Request) {
	rows, err := e.DB.Query(r.Context(), `SELECT id, nama, poin_dibutuhkan, stok FROM produk_tukar ORDER BY nama`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil daftar produk")
		return
	}
	defer rows.Close()

	type produk struct {
		ID             string `json:"id"`
		Nama           string `json:"nama"`
		PoinDibutuhkan int    `json:"poin_dibutuhkan"`
		Stok           int    `json:"stok"`
	}

	daftar := []produk{}
	for rows.Next() {
		var p produk
		if err := rows.Scan(&p.ID, &p.Nama, &p.PoinDibutuhkan, &p.Stok); err != nil {
			writeError(w, http.StatusInternalServerError, "gagal membaca data produk")
			return
		}
		daftar = append(daftar, p)
	}

	writeJSON(w, http.StatusOK, daftar)
}
