// frontend/src/StatUtils.ts

import type * as React from 'react'; // Import type untuk React.CSSProperties

// --- UTILITY FUNCTIONS ---

/**
 * Menghitung dan memformat pace rata-rata menjadi MM:SS/km.
 * @param time_seconds Waktu bergerak (moving_time) dalam detik.
 * @param distance_meters Jarak (distance) dalam meter.
 * @returns String pace dalam format MM:SS/km. Mengembalikan "N/A" jika jarak/waktu 0.
 */
export const calculatePace = (time_seconds: number, distance_meters: number): string => {
    if (distance_meters <= 0 || time_seconds <= 0) {
        return "N/A";
    }
    // Pace: (waktu_detik / jarak_meter) * 1000 m/km
    const pace_s_per_km = (time_seconds / distance_meters) * 1000;
    
    // Konversi detik per km menjadi menit dan detik
    const minutes = Math.floor(pace_s_per_km / 60);
    const seconds = Math.floor(pace_s_per_km % 60);

    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds} /km`;
};


/**
 * Konversi detik ke format HH:MM:SS.
 */
export const secondsToHMS = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Konversi Pace (detik/meter) ke format M:SS / km.
 * @param pace_s_per_m Pace dalam detik per meter (average_pace dari backend).
 */
export const paceToMinPerKm = (pace_s_per_m: number): string => {
    if (pace_s_per_m === 0) return 'N/A';
    // Total detik per km = pace (s/m) * 1000
    const totalSecondsPerKm = pace_s_per_m * 1000;
    const minutes = Math.floor(totalSecondsPerKm / 60);
    const seconds = Math.round(totalSecondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};


// --- SHARED STYLES (untuk tabel di DistanceStats dan PaceStats) ---

export const tableStyle: React.CSSProperties = { 
    width: '100%', 
    borderCollapse: 'collapse', 
};

export const tableHeaderStyle: React.CSSProperties = { 
    padding: '10px', 
    border: '1px solid #ddd', 
    textAlign: 'left',
    position: 'sticky',
    top: 0,
    background: '#f4f4f4',
};

export const tableCellStyle: React.CSSProperties = { 
    padding: '8px 10px', 
    border: '1px solid #eee', 
    wordWrap: 'break-word',
};