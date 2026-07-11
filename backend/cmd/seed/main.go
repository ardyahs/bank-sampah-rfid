// Perintah ini membuat akun admin pertama kali.
// Jalankan setelah schema.sql diimpor: go run ./cmd/seed -username admin -password admin123
package main

import (
	"context"
	"flag"
	"log"
	"os"

	"bank-sampah-rfid/internal/db"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	_ = godotenv.Load()

	username := flag.String("username", "admin", "username untuk akun admin")
	password := flag.String("password", "", "password untuk akun admin (wajib diisi)")
	flag.Parse()

	if *password == "" {
		log.Fatal("wajib isi -password, contoh: go run ./cmd/seed -username admin -password rahasia123")
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL belum diset (lihat .env)")
	}

	pool, err := db.Connect(databaseURL)
	if err != nil {
		log.Fatalf("gagal konek database: %v", err)
	}
	defer pool.Close()

	hash, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("gagal hash password: %v", err)
	}

	_, err = pool.Exec(context.Background(),
		`INSERT INTO pengguna (username, password_hash, role) VALUES ($1, $2, 'admin')
		 ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
		*username, string(hash),
	)
	if err != nil {
		log.Fatalf("gagal membuat akun admin: %v", err)
	}

	log.Printf("Akun admin '%s' berhasil dibuat/diperbarui.", *username)
}
