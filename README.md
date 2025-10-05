# 🏃 Strava Monitor: Aplikasi Pelacak Kinerja Latihan

Aplikasi ini adalah *full-stack project* yang dirancang untuk menganalisis data aktivitas dari Strava menggunakan backend Go dan frontend React. Aplikasi memungkinkan pengguna untuk mengautentikasi dengan Strava, mengambil data aktivitas, dan menampilkannya dalam berbagai format statistik dan visualisasi untuk membantu pelacakan kinerja.

📹 **Video Demo**:

![video-demo](./assets/demo.gif)

## 🚀 Fitur Utama

- **Integrasi Strava OAuth:** Login aman menggunakan otorisasi Strava.
- **Sinkronisasi Data:** Mengambil dan menyimpan aktivitas Strava.
- **Statistik Bulanan:** Visualisasi total jarak dan pace rata-rata per bulan.
- **Daftar Aktivitas:** Melihat dan memfilter semua aktivitas yang telah disinkronkan.
- **Plot Kinerja:** Grafik untuk menganalisis tren kinerja (misalnya, Jarak vs. Pace).
- **Training Preparation:** Fitur untuk menghitung statistik kumulatif berdasarkan kata kunci pada Nama Aktivitas.

## ⚙️ Struktur Proyek

Proyek ini dibagi menjadi dua komponen utama:

1. **`backend/`**: Server API yang dibangun dengan **Go** (Golang) untuk mengurus autentikasi Strava, komunikasi API, dan penyimpanan data.
2. **`frontend/`**: Aplikasi Antarmuka Pengguna (UI) yang dibangun dengan **React** dan **TypeScript**.

## Instalasi dan Menjalankan

### Prasyarat

- Go (1.18+)
- Node.js dan npm (atau yarn)
- Akun Strava Developer (untuk mendapatkan Client ID dan Client Secret)

### 1. Setup Backend (Go Server)

Silakan lihat file [`backend/README.md`](./backend/README.md) untuk detail setup dan konfigurasi Go.

1. Isi konfigurasi Strava API (Client ID/Secret) di file konfigurasi backend.
2. Jalankan server Go:

    ```bash
    cd backend
    go run main.go
    ```

### 2. Setup Frontend (React App)

Silakan lihat file [`frontend/README.md`](./frontend/README.md) untuk instruksi lengkap.

1. Instal dependensi:

    ```bash
    cd frontend
    npm install
    ```

2. Jalankan aplikasi React:

    ```bash
    npm start
    ```

Aplikasi seharusnya dapat diakses di `http://localhost:3000` (atau port default React lainnya). Pastikan server backend berjalan di `http://localhost:8080`.

## Catatan Strava

Pastikan pada `backend/` terdapat file `.env` dengan isi sebagai berikut:

```conf
# backend/.env

# Client ID dan Secret dari Strava Developer Portal
STRAVA_CLIENT_ID="XXX"
STRAVA_CLIENT_SECRET="XXX"
STRAVA_ACCESS_TOKEN="XXX"
# port yang DIgunakan untuk backend Go
BACKEND_PORT="8080"
```
