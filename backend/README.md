# ⚙️ Backend Strava Monitor (Go)

Backend ini adalah server API yang menangani autentikasi pengguna dengan Strava dan mengelola data aktivitas mereka. Dibangun menggunakan Go untuk kinerja dan efisiensi.

## Endpoint API

| Metode | Jalur | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/status` | Memeriksa status server. |
| `GET` | `/api/login` | Mengarahkan pengguna ke halaman otorisasi Strava. |
| `GET` | `/api/auth/callback` | Endpoint callback dari Strava (menukarkan kode dengan token). |
| `GET` | `/api/activities` | Mengambil semua aktivitas dari Strava (opsional `?refresh=true` untuk sinkronisasi paksa). |
| `GET` | `/api/stats` | Mengambil statistik jarak bulanan (Run/Bike/Other). |
| `GET` | `/api/pace-stats`| Mengambil statistik pace rata-rata bulanan. |

## Konfigurasi

Anda harus mengatur variabel lingkungan (atau file konfigurasi) berikut.

1. **STRAVA\_CLIENT\_ID**
2. **STRAVA\_CLIENT\_SECRET**
3. **STRAVA\_REDIRECT\_URI** (Biasanya: `http://localhost:8080/api/auth/callback`)

*Catatan: Pastikan URI Pengalihan (Redirect URI) Anda terdaftar di Pengaturan Aplikasi Strava Anda.*

## Cara Menjalankan

Pastikan Anda berada di direktori `backend/`.

1. Unduh dependensi Go:

    ```bash
    go mod tidy
    ```

2. Jalankan server:

    ```bash
    go run main.go
    ```

Server akan berjalan di `http://localhost:8080`.
