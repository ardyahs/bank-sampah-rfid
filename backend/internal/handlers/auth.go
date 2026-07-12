package handlers

import (
	"encoding/json"
	"net/http"

	appmw "bank-sampah-rfid/internal/middleware"
	"bank-sampah-rfid/internal/models"

	"golang.org/x/crypto/bcrypt"
)

// Login memverifikasi username/password dan mengembalikan JWT.
func (e *Env) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body tidak valid")
		return
	}
	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "username dan password wajib diisi")
		return
	}

	var (
		id            string
		passwordHash  string
		role          string
		rumahTanggaID *string
	)
	err := e.DB.QueryRow(r.Context(),
		`SELECT id, password_hash, role, rumah_tangga_id FROM pengguna WHERE username = $1`,
		req.Username,
	).Scan(&id, &passwordHash, &role, &rumahTanggaID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "username atau password salah")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "username atau password salah")
		return
	}

	rtID := ""
	if rumahTanggaID != nil {
		rtID = *rumahTanggaID
	}

	token, err := appmw.GenerateToken(e.JWTSecret, id, role, rtID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal membuat token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user": map[string]string{
			"id":              id,
			"username":        req.Username,
			"role":            role,
			"rumah_tangga_id": rtID,
		},
	})
}
