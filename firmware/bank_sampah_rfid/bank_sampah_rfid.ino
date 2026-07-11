/*
  Bank Sampah Digital Berbasis RFID - Firmware ESP32
  ----------------------------------------------------
  Alat: ESP32 + RFID RC522 + Load Cell (HX711) + LED/Buzzer

  Alur kerja:
   1. Petugas memilih jenis sampah dengan menekan tombol (siklus jenis sampah).
   2. Warga menempelkan kartu RFID -> ESP32 baca UID.
   3. ESP32 baca berat dari load cell (HX711).
   4. Data dikirim ke backend Go via HTTP POST /api/scan.
   5. LED hijau + buzzer pendek = sukses, LED merah = gagal.
   6. Jika WiFi/backend tidak terjangkau, data disimpan sementara di memori
      dan dicoba kirim ulang otomatis.

  Library yang dibutuhkan (install lewat Arduino Library Manager):
   - MFRC522 by GithubCommunity
   - HX711 by bogdan Necula (bogde/HX711)
   - ArduinoJson by Benoit Blanchon
   (WiFi.h dan HTTPClient.h sudah termasuk di board package ESP32)
*/

#include <SPI.h>
#include <MFRC522.h>
#include <HX711.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---------------- KONFIGURASI (SESUAIKAN) ----------------
const char* WIFI_SSID     = "NAMA_WIFI_ANDA";
const char* WIFI_PASSWORD = "PASSWORD_WIFI_ANDA";

// Ganti sesuai alamat server backend (bisa IP lokal atau domain publik).
const char* SERVER_URL  = "http://192.168.1.100:8080/api/scan";
const char* DEVICE_KEY  = "kunci-rahasia-untuk-esp32"; // harus sama dengan DEVICE_KEY di backend/.env

// Kalibrasi load cell: sesuaikan setelah kalibrasi manual (lihat fungsi kalibrasi di bawah).
const float HX711_CALIBRATION_FACTOR = 420.0f;

// Daftar jenis sampah yang bisa dipilih petugas dengan tombol (harus sama persis
// dengan kolom "nama" di tabel jenis_sampah pada database).
const char* DAFTAR_JENIS_SAMPAH[] = {"Plastik", "Kertas", "Kaca", "Logam", "Kardus"};
const int JUMLAH_JENIS_SAMPAH = 5;
int indexJenisSampah = 0;

// ---------------- PIN ----------------
#define SS_PIN     5    // RC522 SDA/SS
#define RST_PIN    22   // RC522 RST
// Pin SPI default ESP32: SCK=18, MISO=19, MOSI=23 (otomatis dipakai library SPI)

#define HX711_DT_PIN  16
#define HX711_SCK_PIN 4

#define TOMBOL_PILIH_JENIS_PIN 27  // tombol untuk ganti jenis sampah
#define LED_HIJAU_PIN 25
#define LED_MERAH_PIN 26
#define BUZZER_PIN    33

MFRC522 mfrc522(SS_PIN, RST_PIN);
HX711 scale;

// Antrean sederhana untuk data yang gagal terkirim (disimpan di RAM).
struct DataPending {
  String kartuUid;
  String jenisSampah;
  float beratKg;
  bool terpakai;
};
#define MAX_ANTREAN 20
DataPending antrean[MAX_ANTREAN];
int jumlahAntrean = 0;

unsigned long lastTombolPress = 0;

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(TOMBOL_PILIH_JENIS_PIN, INPUT_PULLUP);
  pinMode(LED_HIJAU_PIN, OUTPUT);
  pinMode(LED_MERAH_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  SPI.begin();
  mfrc522.PCD_Init();
  Serial.println("RC522 siap. Tempelkan kartu RFID...");

  scale.begin(HX711_DT_PIN, HX711_SCK_PIN);
  scale.set_scale(HX711_CALIBRATION_FACTOR);
  scale.tare(); // pastikan timbangan kosong saat start

  connectWiFi();
  Serial.printf("Jenis sampah aktif: %s (tekan tombol untuk ganti)\n", DAFTAR_JENIS_SAMPAH[indexJenisSampah]);
}

void loop() {
  cekTombolPilihJenis();

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  } else {
    kirimAntreanTertunda();
  }

  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  String uid = bacaUID();
  Serial.printf("Kartu terdeteksi: %s\n", uid.c_str());

  float berat = bacaBerat();
  Serial.printf("Berat: %.2f kg | Jenis: %s\n", berat, DAFTAR_JENIS_SAMPAH[indexJenisSampah]);

  if (berat < 0.01f) {
    Serial.println("Berat terlalu kecil, abaikan (pastikan sampah sudah di atas timbangan).");
    beepGagal();
  } else {
    bool sukses = kirimDataKeServer(uid, DAFTAR_JENIS_SAMPAH[indexJenisSampah], berat);
    if (sukses) {
      beepSukses();
    } else {
      simpanKeAntrean(uid, DAFTAR_JENIS_SAMPAH[indexJenisSampah], berat);
      beepGagal();
      Serial.println("Gagal kirim, data disimpan di antrean untuk dicoba ulang.");
    }
  }

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(1500); // jeda sebelum scan berikutnya
}

// ---------------- FUNGSI BANTUAN ----------------

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("Menghubungkan ke WiFi %s...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int percobaan = 0;
  while (WiFi.status() != WL_CONNECTED && percobaan < 20) {
    delay(500);
    Serial.print(".");
    percobaan++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi tersambung. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nGagal konek WiFi, akan dicoba lagi di loop berikutnya.");
  }
}

String bacaUID() {
  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

float bacaBerat() {
  if (!scale.is_ready()) return 0.0f;
  float berat = scale.get_units(10); // rata-rata 10 pembacaan biar stabil
  if (berat < 0) berat = 0;
  return berat;
}

void cekTombolPilihJenis() {
  if (digitalRead(TOMBOL_PILIH_JENIS_PIN) == LOW && millis() - lastTombolPress > 400) {
    lastTombolPress = millis();
    indexJenisSampah = (indexJenisSampah + 1) % JUMLAH_JENIS_SAMPAH;
    Serial.printf("Jenis sampah diganti ke: %s\n", DAFTAR_JENIS_SAMPAH[indexJenisSampah]);
    tone(BUZZER_PIN, 1500, 100);
  }
}

bool kirimDataKeServer(String uid, String jenis, float berat) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  http.setTimeout(8000);

  StaticJsonDocument<256> doc;
  doc["kartu_uid"] = uid;
  doc["jenis_sampah_nama"] = jenis;
  doc["berat_kg"] = berat;

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("HTTP %d: %s\n", httpCode, response.c_str());
  return (httpCode == 200);
}

void simpanKeAntrean(String uid, String jenis, float berat) {
  if (jumlahAntrean >= MAX_ANTREAN) {
    Serial.println("Antrean penuh, data terlama dibuang.");
    for (int i = 1; i < MAX_ANTREAN; i++) antrean[i - 1] = antrean[i];
    jumlahAntrean--;
  }
  antrean[jumlahAntrean].kartuUid = uid;
  antrean[jumlahAntrean].jenisSampah = jenis;
  antrean[jumlahAntrean].beratKg = berat;
  antrean[jumlahAntrean].terpakai = true;
  jumlahAntrean++;
}

void kirimAntreanTertunda() {
  for (int i = 0; i < jumlahAntrean; i++) {
    if (!antrean[i].terpakai) continue;
    bool sukses = kirimDataKeServer(antrean[i].kartuUid, antrean[i].jenisSampah, antrean[i].beratKg);
    if (sukses) {
      Serial.println("Data antrean berhasil dikirim ulang.");
      antrean[i].terpakai = false;
    } else {
      break; // server masih belum bisa diakses, coba lagi nanti
    }
  }
}

void beepSukses() {
  digitalWrite(LED_HIJAU_PIN, HIGH);
  tone(BUZZER_PIN, 2000, 150);
  delay(300);
  digitalWrite(LED_HIJAU_PIN, LOW);
}

void beepGagal() {
  digitalWrite(LED_MERAH_PIN, HIGH);
  tone(BUZZER_PIN, 400, 400);
  delay(500);
  digitalWrite(LED_MERAH_PIN, LOW);
}

/*
  CARA KALIBRASI LOAD CELL:
  1. Upload firmware ini dulu dengan HX711_CALIBRATION_FACTOR = 1.
  2. Buka Serial Monitor, catat nilai scale.get_units(10) saat timbangan kosong (harusnya ~0 setelah tare).
  3. Taruh beban yang diketahui beratnya (misal 1 kg), catat nilai reading yang muncul.
  4. Hitung faktor kalibrasi = reading / berat_asli_kg.
  5. Masukkan nilai itu ke HX711_CALIBRATION_FACTOR, upload ulang.
*/
