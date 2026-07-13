package handlers

import (
	"encoding/json"
	"net/http"

	"bank-sampah-rfid/internal/models"
)

// GetKontak mengembalikan info contact center pengelola bank sampah.
// Bisa diakses semua role yang sudah login (admin, petugas, warga).
func (e *Env) GetKontak(w http.ResponseWriter, r *http.Request) {
	var k models.PengaturanKontak
	err := e.DB.QueryRow(r.Context(),
		`SELECT nama_kontak, whatsapp, telepon, email, alamat, jam_operasional
		 FROM pengaturan_kontak WHERE id = 1`,
	).Scan(&k.NamaKontak, &k.Whatsapp, &k.Telepon, &k.Email, &k.Alamat, &k.JamOperasional)
	if err != nil {
		// Belum pernah diisi -> kembalikan data kosong, bukan error, supaya
		// halaman warga tidak crash sebelum admin sempat mengisi kontaknya.
		writeJSON(w, http.StatusOK, models.PengaturanKontak{})
		return
	}
	writeJSON(w, http.StatusOK, k)
}

// UpdateKontak dipakai admin untuk mengubah info contact center.
func (e *Env) UpdateKontak(w http.ResponseWriter, r *http.Request) {
	var req models.PengaturanKontak
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body tidak valid")
		return
	}

	_, err := e.DB.Exec(r.Context(), `
		INSERT INTO pengaturan_kontak (id, nama_kontak, whatsapp, telepon, email, alamat, jam_operasional, updated_at)
		VALUES (1, $1, $2, $3, $4, $5, $6, now())
		ON CONFLICT (id) DO UPDATE SET
			nama_kontak = EXCLUDED.nama_kontak,
			whatsapp = EXCLUDED.whatsapp,
			telepon = EXCLUDED.telepon,
			email = EXCLUDED.email,
			alamat = EXCLUDED.alamat,
			jam_operasional = EXCLUDED.jam_operasional,
			updated_at = now()`,
		req.NamaKontak, req.Whatsapp, req.Telepon, req.Email, req.Alamat, req.JamOperasional,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menyimpan kontak")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "kontak berhasil diperbarui"})
}
