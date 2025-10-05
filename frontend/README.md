# 🖥️ Frontend Strava Monitor (React/TypeScript)

Aplikasi *frontend* ini dibangun dengan **React** dan **TypeScript** untuk menyajikan data Strava secara interaktif dan visual. Aplikasi menggunakan `react-router-dom` untuk navigasi antar halaman.

## Halaman (Komponen) Utama

- **`Home.tsx`**: Halaman utama untuk login Strava dan memulai sinkronisasi data.
- **`AllActivities.tsx`**: Menampilkan daftar aktivitas lengkap dengan filter berdasarkan nama, jarak, dan pace.
- **`DistanceStats.tsx`**: Menampilkan grafik dan tabel statistik total jarak bulanan.
- **`PaceStats.tsx`**: Menampilkan grafik dan tabel statistik pace rata-rata bulanan.
- **`PerformancePlot.tsx`**: Menampilkan plot kustom untuk analisis kinerja lanjutan.
- **`TrainingPreparation.tsx`**: Fitur untuk menghitung akumulasi statistik berdasarkan *keyword* dalam Nama Aktivitas, berguna untuk mereview program latihan.

## Struktur File Penting

- **`App.tsx`**: Komponen utama yang mengelola otentikasi, *state* data global (`activities`, `monthlyStats`), dan *routing* aplikasi.
- **`src/`**: Berisi semua kode sumber React.
- **`utils/StatUtils.ts`**: Berisi fungsi helper seperti `secondsToHMS` dan `calculatePace`.

## Dependensi

- `axios` (untuk komunikasi dengan backend Go)
- `react-router-dom` (untuk navigasi)
- Pustaka charting (sesuai yang Anda gunakan, misal: `recharts`, `chart.js`, atau lainnya)

## Cara Menjalankan

Pastikan Anda berada di direktori `frontend/`.

1. Instal dependensi:

    ```bash
    npm install
    ```

2. Jalankan aplikasi dalam mode pengembangan:

    ```bash
    npm start
    ```

Aplikasi akan dibuka di browser Anda (biasanya `http://localhost:3000`). Pastikan backend Go telah berjalan terlebih dahulu di `http://localhost:8080`.
