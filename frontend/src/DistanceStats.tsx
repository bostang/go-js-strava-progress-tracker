// frontend/src/DistanceStats.tsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Activity, MonthlySportStats, CategoryTableProps } from './App'; 
import { tableStyle, tableHeaderStyle, tableCellStyle } from './utils/StatUtils';

// --- Interface & Props ---
interface DistanceStatsProps {
    activities: Activity[];
    monthlyStats: MonthlySportStats[];
}

// --- Komponen DistanceStats (Konten Halaman) ---
const DistanceStats: React.FC<DistanceStatsProps> = ({ activities, monthlyStats }) => {
    if (activities.length === 0) {
        return <p>Silakan hubungkan ke Strava dan sinkronkan data di halaman Home.</p>;
    }

    return (
        <div>
            <h2>Distance Stats</h2>
            
            {/* Visualisasi Stacked Bar Chart */}
            <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Visualisasi Jarak Bulanan (Stacked)</h3>
            <MonthlyDistanceChart stats={monthlyStats} />

            {/* Bagian Statistik Per Tipe */}
            <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginTop: '30px' }}>Statistik Jarak Bulanan per Tipe Olahraga</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                <CategoryTable stats={monthlyStats} categoryKey="run_walk_hike" title="1. Run/Walk/Hike" />
                <CategoryTable stats={monthlyStats} categoryKey="bike" title="2. Bike" />
                <CategoryTable stats={monthlyStats} categoryKey="other" title="3. Lain-lain (Soccer, dll.)" />
            </div>

        </div>
    );
};

export default DistanceStats;

// --------------------------------------
// --- KOMPONEN PENDUKUNG ---
// --------------------------------------

// --- Komponen CategoryTable ---
const CategoryTable: React.FC<CategoryTableProps> = ({ stats, categoryKey, title }) => {
    // Filter dan hitung ulang aktivitas hanya untuk kategori ini
    // CategoryKey: keyof MonthlySportStats harus sudah diexport di App.tsx
    const filteredStats = stats.filter(stat => stat[categoryKey] > 0);
    
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
                            <th style={tableHeaderStyle}>Jarak (km)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedStats.map(stat => (
                            <tr key={stat.month_year}>
                                <td style={tableCellStyle}>{stat.month_year}</td>
                                <td style={tableCellStyle}>{(stat[categoryKey] / 1000).toFixed(2)} km</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// --- Komponen Bar Chart Jarak Bulanan ---
const MonthlyDistanceChart: React.FC<{ stats: MonthlySportStats[] }> = ({ stats }) => {
    // Sortir data agar urutan bulan benar (chronological)
    const sortedStats = [...stats].sort((a, b) => a.month_year.localeCompare(b.month_year));

    // Siapkan data untuk grafik (konversi jarak ke KM)
    const chartData = sortedStats.map(stat => ({
        month_year: stat.month_year,
        'Run/Walk/Hike': parseFloat((stat.run_walk_hike / 1000).toFixed(2)),
        'Bike': parseFloat((stat.bike / 1000).toFixed(2)),
        'Lain-lain': parseFloat((stat.other / 1000).toFixed(2)),
        
    }));

    return (
        <div style={{ width: '100%', height: 400, marginTop: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month_year" />
                    <YAxis label={{ value: 'Jarak (km)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                        formatter={(value: number, name: string) => [`${value} km`, name]} 
                    />
                    <Legend />
                    {/* Bar akan menumpuk (stackId="a") */}
                    <Bar dataKey="Run/Walk/Hike" stackId="a" fill="#3879a8" />
                    <Bar dataKey="Bike" stackId="a" fill="#8884d8" />
                    <Bar dataKey="Lain-lain" stackId="a" fill="#e95420" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
