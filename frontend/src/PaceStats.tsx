// frontend/src/PaceStats.tsx

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { MonthlyPaceStats, CategoryTableProps } from './App'; 
// Import utilitas dan style dari file StatUtils
import { paceToMinPerKm, tableStyle, tableHeaderStyle, tableCellStyle } from './utils/StatUtils.tsx';

interface PaceStatsProps {
    monthlyPaceStats: MonthlyPaceStats[];
}

// --- Komponen Line Chart Pace Bulanan (Hanya Run/Walk/Hike dan Bike) ---
const MonthlyPaceChart: React.FC<{ stats: MonthlyPaceStats[] }> = ({ stats }) => {
    // Sortir data agar urutan bulan benar (chronological)
    const sortedStats = [...stats].sort((a, b) => a.month_year.localeCompare(b.month_year));

    const paceToFloatMinPerKm = (pace_s_per_m: number): number => {
        if (pace_s_per_m === 0) return 0;
        return parseFloat((pace_s_per_m * 1000 / 60).toFixed(2));
    };
    
    const chartData = sortedStats.map(stat => ({
        month_year: stat.month_year,
        'Run/Walk/Hike': paceToFloatMinPerKm(stat.run_walk_hike_pace),
        'Bike': paceToFloatMinPerKm(stat.bike_pace),
        // Kategori 'Lain-lain' dihapus dari data chart
    })).filter(data => 
        // Filter agar baris data tidak kosong sama sekali (hanya cek 2 kategori utama)
        data['Run/Walk/Hike'] > 0 || data['Bike'] > 0
    );

    if (chartData.length === 0) {
        return <p>Data pace bulanan Run/Walk/Hike atau Bike tidak ditemukan untuk divisualisasikan.</p>;
    }

    // Hitung domain hanya dari Run/Walk/Hike dan Bike
    const allPaces = chartData.flatMap(d => [d['Run/Walk/Hike'], d['Bike']]).filter(p => p > 0);
    const maxPace = allPaces.length > 0 ? Math.max(...allPaces) : 1;
    const minPace = allPaces.length > 0 ? Math.min(...allPaces) : 0;


    return (
        <div style={{ width: '100%', height: 400, marginTop: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month_year" />
                    <YAxis 
                        reversed={true} 
                        domain={[Math.floor(minPace * 0.9), Math.ceil(maxPace * 1.1)]} // Buffer 10%
                        label={{ value: 'Pace (menit/km)', angle: -90, position: 'insideLeft' }} 
                    />
                    <Tooltip 
                        formatter={(value: number, name: string) => [paceToMinPerKm(value * 60 / 1000), name]} 
                    />
                    <Legend />
                    {/* HANYA dua Garis untuk Kategori Utama */}
                    <Line type="monotone" dataKey="Run/Walk/Hike" stroke="#e95420" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Bike" stroke="#3879a8" strokeWidth={2} dot={false} />
                    {/* Line "Lain-lain" DIHAPUS */}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

// --- Komponen PaceCategoryTable (TETAP SAMA, menampilkan 3 tabel) ---
interface PaceCategoryTableProps extends CategoryTableProps {
    stats: MonthlyPaceStats[]; 
}

const PaceCategoryTable: React.FC<PaceCategoryTableProps> = ({ stats, categoryKey, title }) => {
    const paceKey = categoryKey as keyof MonthlyPaceStats; 
    const distanceKey = (paceKey.replace('_pace', '_distance')) as keyof MonthlyPaceStats;

    // Filter data hanya yang memiliki pace dan jarak (pace=0 biasanya berarti tidak ada aktivitas)
    const filteredStats = stats.filter(stat => stat[paceKey] > 0 && stat[distanceKey] > 0);
    
    // Sortir data agar bulan terbaru di atas
    const sortedStats = [...filteredStats].sort((a, b) => b.month_year.localeCompare(a.month_year));

    return (
        <div style={{ flex: '1 1 30%', minWidth: '300px', margin: '0 10px 20px 0' }}>
            <h4>{title}</h4>
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd' }}>
                <table style={{ ...tableStyle, tableLayout: 'fixed' }}>
                    <thead>
                        <tr style={{ background: '#f4f4f4' }}>
                            <th style={tableHeaderStyle}>Bulan/Tahun</th>
                            <th style={tableHeaderStyle}>Pace (min/km)</th>
                            <th style={tableHeaderStyle}>Jarak (km)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedStats.map(stat => (
                            <tr key={stat.month_year}>
                                <td style={tableCellStyle}>{stat.month_year}</td>
                                <td style={tableCellStyle}>
                                    <strong>{paceToMinPerKm(stat[paceKey] as number)} / km</strong>
                                </td>
                                <td style={tableCellStyle}>{(stat[distanceKey] as number / 1000).toFixed(2)} km</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// --- Komponen Halaman PaceStats ---
const PaceStats: React.FC<PaceStatsProps> = ({ monthlyPaceStats }) => {
    // Cek apakah ada data pace yang relevan
    // Note: Cek harus tetap menyertakan 'other_pace' agar pesan 'Tidak ada data' tidak muncul 
    // jika user hanya punya aktivitas 'Lain-lain'
    const hasData = monthlyPaceStats.some(stat => 
        stat.run_walk_hike_pace > 0 || stat.bike_pace > 0 || stat.other_pace > 0
    );

    if (!hasData) {
        return <p>Tidak ada data pace yang tersedia untuk divisualisasikan. Silakan sinkronkan data Anda dari Strava.</p>;
    }
    
    return (
        <div>
            <h2>Average Pace Stats per Activity Type</h2>
            
            <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Visualisasi Pace Rata-Rata Bulanan</h3>
            {/* Menggunakan chart yang sudah dimodifikasi */}
            <MonthlyPaceChart stats={monthlyPaceStats} />

            <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginTop: '30px' }}>Tabel Pace Rata-rata per Tipe Olahraga</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                <PaceCategoryTable 
                    stats={monthlyPaceStats} 
                    categoryKey="run_walk_hike_pace" 
                    title="1. Run/Walk/Hike" 
                />
                <PaceCategoryTable 
                    stats={monthlyPaceStats} 
                    categoryKey="bike_pace" 
                    title="2. Bike" 
                />
                <PaceCategoryTable 
                    stats={monthlyPaceStats} 
                    categoryKey="other_pace" 
                    title="3. Lain-lain" 
                />
            </div>
        </div>
    );
};

export default PaceStats;