-- Bank Sampah Digital Berbasis RFID
-- Skema database PostgreSQL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE rumah_tangga (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_kepala_keluarga VARCHAR(150) NOT NULL,
    alamat TEXT NOT NULL,
    rt VARCHAR(5) NOT NULL,
    rw VARCHAR(5) NOT NULL,
    kartu_uid VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pengguna (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rumah_tangga_id UUID REFERENCES rumah_tangga(id) ON DELETE SET NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'petugas', 'warga')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE jenis_sampah (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama VARCHAR(100) NOT NULL,
    poin_per_kg INTEGER NOT NULL CHECK (poin_per_kg >= 0)
);

CREATE TABLE transaksi_setor (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rumah_tangga_id UUID NOT NULL REFERENCES rumah_tangga(id) ON DELETE CASCADE,
    jenis_sampah_id UUID NOT NULL REFERENCES jenis_sampah(id),
    berat_kg NUMERIC(8,2) NOT NULL CHECK (berat_kg > 0),
    poin_didapat INTEGER NOT NULL,
    petugas_id UUID REFERENCES pengguna(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE saldo_poin (
    rumah_tangga_id UUID PRIMARY KEY REFERENCES rumah_tangga(id) ON DELETE CASCADE,
    total_poin BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE produk_tukar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama VARCHAR(150) NOT NULL,
    poin_dibutuhkan INTEGER NOT NULL CHECK (poin_dibutuhkan > 0),
    stok INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transaksi_tukar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rumah_tangga_id UUID NOT NULL REFERENCES rumah_tangga(id) ON DELETE CASCADE,
    produk_id UUID NOT NULL REFERENCES produk_tukar(id),
    poin_terpakai INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'selesai', 'dibatalkan')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transaksi_setor_rumah ON transaksi_setor(rumah_tangga_id);
CREATE INDEX idx_transaksi_setor_created ON transaksi_setor(created_at);
CREATE INDEX idx_transaksi_tukar_rumah ON transaksi_tukar(rumah_tangga_id);
CREATE INDEX idx_rumah_tangga_rt ON rumah_tangga(rt);

-- Seed data contoh jenis sampah
INSERT INTO jenis_sampah (nama, poin_per_kg) VALUES
    ('Plastik', 100),
    ('Kertas', 80),
    ('Kaca', 60),
    ('Logam', 150),
    ('Kardus', 70);

-- Seed akun admin default (username: admin, password: admin123 -> ganti setelah deploy)
-- Hash bcrypt untuk "admin123" dibuat oleh backend saat pertama kali dijalankan (lihat cmd/seed).
