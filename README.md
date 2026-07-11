# Bank Sampah Digital Berbasis RFID

Source code awal untuk sistem Bank Sampah Digital: warga menyetor sampah, kartu RFID di-scan, berat ditimbang otomatis, poin masuk ke akun warga, poin bisa ditukar sembako, dan ada leaderboard antar RT.

## Struktur Folder

```
bank-sampah-rfid/
  database/       -> schema.sql (PostgreSQL)
  backend/        -> API Go (chi + pgx + JWT)
  frontend/       -> Next.js (dashboard admin, warga, leaderboard)
  firmware/       -> firmware ESP32 (.ino) untuk RC522 + load cell
```

## 1. Database (PostgreSQL)

```bash
createdb bank_sampah
psql bank_sampah < database/schema.sql
```

Ini membuat semua tabel + seed data jenis sampah (Plastik, Kertas, Kaca, Logam, Kardus).

## 2. Backend (Go)

Butuh Go 1.22+ dan PostgreSQL yang sudah jalan.

```bash
cd backend
cp .env.example .env
# edit .env: isi DATABASE_URL, JWT_SECRET, DEVICE_KEY

go mod tidy
go run ./cmd/seed -username admin -password admin123   # buat akun admin pertama
go run ./cmd/server                                     # jalankan API di :8080
```

Cek `http://localhost:8080/health` harus balas `ok`.

### Endpoint utama

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/auth/login` | Login, balas JWT |
| POST | `/api/scan` | Dipanggil ESP32 (header `X-Device-Key`) |
| GET | `/api/warga/:id/poin` | Saldo poin warga |
| GET | `/api/warga/:id/riwayat` | Riwayat setor |
| GET | `/api/produk-tukar` | Daftar produk tukar poin |
| POST | `/api/tukar-poin` | Tukar poin jadi produk |
| GET | `/api/leaderboard/:rt` | Ranking (pakai `semua` untuk semua RT) |
| GET/POST/PUT/DELETE | `/api/admin/warga` | CRUD rumah tangga & kartu (admin) |
| POST/PUT/DELETE | `/api/admin/produk` | CRUD produk tukar (admin) |
| GET | `/api/admin/transaksi` | Semua transaksi (monitoring admin) |

Semua endpoint kecuali login & scan butuh header `Authorization: Bearer <token>`.

## 3. Frontend (Next.js)

Butuh Node.js 18+.

```bash
cd frontend
cp .env.local.example .env.local   # isi NEXT_PUBLIC_API_URL sesuai alamat backend
npm install
npm run dev
```

Buka `http://localhost:3000`, login dengan akun admin yang dibuat lewat `cmd/seed`.

- `/admin` — kelola rumah tangga & kartu, kelola produk tukar, monitor semua transaksi.
- `/warga` — saldo poin, riwayat setor, tukar poin.
- `/leaderboard` — ranking antar RT.

## 4. Firmware ESP32

Buka `firmware/bank_sampah_rfid/bank_sampah_rfid.ino` di Arduino IDE.

1. Install board package "esp32" (Boards Manager) dan library: `MFRC522`, `HX711` (bogde), `ArduinoJson`.
2. Sambungkan RC522 ke ESP32: SDA→GPIO5, RST→GPIO22, SCK→GPIO18, MISO→GPIO19, MOSI→GPIO23, 3.3V, GND.
3. Sambungkan HX711 (load cell): DT→GPIO16, SCK→GPIO4.
4. Edit bagian `KONFIGURASI` di atas file: `WIFI_SSID`, `WIFI_PASSWORD`, `SERVER_URL` (IP backend), `DEVICE_KEY` (harus sama dengan `.env` backend).
5. Kalibrasi load cell — ikuti komentar "CARA KALIBRASI LOAD CELL" di akhir file.
6. Upload ke ESP32, buka Serial Monitor (115200 baud) untuk memantau proses scan.

Tombol di GPIO27 dipakai petugas untuk memilih jenis sampah (Plastik/Kertas/Kaca/Logam/Kardus) sebelum kartu ditempelkan. Alat otomatis menyimpan data di memori dan mengirim ulang jika koneksi backend sempat putus.

## Catatan Keamanan Sebelum Produksi

Ganti `admin123`, `JWT_SECRET`, dan `DEVICE_KEY` di atas dengan nilai acak yang kuat. Jangan commit file `.env` / `.env.local` ke git — sudah ada contoh di `.env.example` / `.env.local.example`.

## Alur Lengkap

Untuk alur pengembangan tahap demi tahap (perencanaan sampai deployment), lihat dokumen terpisah "Alur Pembangunan Bank Sampah RFID" yang sudah dibuat sebelumnya.
