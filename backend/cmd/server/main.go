package main

import (
	"log"
	"net/http"
	"os"

	"bank-sampah-rfid/internal/db"
	"bank-sampah-rfid/internal/handlers"
	appmw "bank-sampah-rfid/internal/middleware"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	_ = godotenv.Load() // aman jika file .env tidak ada (mis. di production pakai env asli)

	port := getenv("PORT", "8080")
	databaseURL := os.Getenv("DATABASE_URL")
	jwtSecret := os.Getenv("JWT_SECRET")
	deviceKey := os.Getenv("DEVICE_KEY")

	if databaseURL == "" || jwtSecret == "" || deviceKey == "" {
		log.Fatal("DATABASE_URL, JWT_SECRET, dan DEVICE_KEY wajib diset (lihat .env.example)")
	}

	pool, err := db.Connect(databaseURL)
	if err != nil {
		log.Fatalf("gagal konek database: %v", err)
	}
	defer pool.Close()

	env := &handlers.Env{DB: pool, JWTSecret: jwtSecret, DeviceKey: deviceKey}

	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "Authorization", "X-Device-Key"},
		AllowCredentials: false,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	r.Route("/api", func(r chi.Router) {
		// Publik
		r.Post("/auth/login", env.Login)

		// Endpoint khusus ESP32 (pakai device key, bukan JWT)
		r.With(appmw.DeviceKey(deviceKey)).Post("/scan", env.Scan)

		// Butuh login (JWT)
		r.Group(func(r chi.Router) {
			r.Use(appmw.Auth(jwtSecret))

			r.Get("/warga/{id}/poin", env.SaldoPoin)
			r.Get("/warga/{id}/riwayat", env.RiwayatTransaksi)
			r.Post("/tukar-poin", env.TukarPoin)
			r.Get("/produk-tukar", env.ListProdukTukar)
			r.Get("/leaderboard/{rt}", env.Leaderboard)
			r.Get("/jenis-sampah", env.ListJenisSampah)

			// Hanya admin
			r.Group(func(r chi.Router) {
				r.Use(appmw.RequireRole("admin"))

				r.Get("/admin/warga", env.ListRumahTangga)
				r.Post("/admin/warga", env.CreateRumahTangga)
				r.Put("/admin/warga/{id}", env.UpdateRumahTangga)
				r.Delete("/admin/warga/{id}", env.DeleteRumahTangga)

				r.Post("/admin/produk", env.CreateProduk)
				r.Put("/admin/produk/{id}", env.UpdateProduk)
				r.Delete("/admin/produk/{id}", env.DeleteProduk)

				r.Get("/admin/transaksi", env.ListSemuaTransaksi)
			})
		})
	})

	log.Printf("Bank Sampah RFID backend berjalan di port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
