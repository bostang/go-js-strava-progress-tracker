// frontend/src/AllActivities.tsx
import React, { useState, useMemo } from 'react';
import type { Activity } from './App'; 
// Pastikan import calculatePace sudah benar dari utils/StatUtils
import { secondsToHMS, calculatePace, tableStyle, tableHeaderStyle, tableCellStyle } from './utils/StatUtils';

interface AllActivitiesProps {
    activities: Activity[];
}

const AllActivities: React.FC<AllActivitiesProps> = ({ activities }) => {
    // 1. SEMUA HOOKS HARUS ADA DI AWAL DAN TIDAK BERSYARAT
    const [searchTerm, setSearchTerm] = useState('');
    const [minDistance, setMinDistance] = useState<number | ''>('');
    const [maxPace, setMaxPace] = useState<number | ''>(''); // Pace maksimum yang diperbolehkan (menit/km)

    // Hitung aktivitas yang difilter (useMemo dipanggil tanpa syarat)
    const filteredActivities = useMemo(() => {
        let result = activities;

        // 1. Filter Pencarian Nama/Tipe
        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            result = result.filter(activity =>
                activity.name.toLowerCase().includes(lowerCaseSearch) ||
                activity.type.toLowerCase().includes(lowerCaseSearch)
            );
        }

        // 2. Filter Jarak Minimum (Min Distance)
        if (minDistance !== '' && minDistance > 0) {
            const minDistanceMeters = minDistance * 1000;
            result = result.filter(activity => activity.distance >= minDistanceMeters);
        }

        // 3. Filter Pace Maksimum (Max Pace)
        if (maxPace !== '' && maxPace > 0) {
            // Konversi MaxPace dari menit/km ke detik/km
            const maxPaceSecondsPerKm = maxPace * 60; 
            
            result = result.filter(activity => {
                if (activity.distance <= 0 || activity.moving_time <= 0) {
                    return false; 
                }
                const currentPaceSecondsPerKm = (activity.moving_time / activity.distance) * 1000;
                return currentPaceSecondsPerKm <= maxPaceSecondsPerKm;
            });
        }
        
        // Urutkan berdasarkan tanggal (terbaru di atas)
        return result.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    }, [activities, searchTerm, minDistance, maxPace]);

    // 2. KONDISI RETURN DIPINDAHKAN KE SINI (Setelah semua Hooks)
    if (activities.length === 0) {
        return <p>Silakan hubungkan ke Strava dan sinkronkan data di halaman Home.</p>;
    }

    return (
        <div>
            <h2>All Activities</h2>
            <p>Daftar aktivitas Strava Anda ({filteredActivities.length} dari {activities.length} total)</p>

            {/* Kontrol Filter dan Pencarian */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}>
                <input
                    type="text"
                    placeholder="Cari Nama/Tipe Aktivitas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '8px', border: '1px solid #ccc', flex: 1 }}
                />
                <input
                    type="number"
                    placeholder="Min Jarak (km)"
                    value={minDistance}
                    onChange={(e) => setMinDistance(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    style={{ padding: '8px', border: '1px solid #ccc', width: '150px' }}
                />
                <input
                    type="number"
                    placeholder="Max Pace (menit/km)"
                    value={maxPace}
                    onChange={(e) => setMaxPace(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    style={{ padding: '8px', border: '1px solid #ccc', width: '170px' }}
                />
            </div>


            {/* Tabel Aktivitas */}
            <div style={{ maxHeight: '70vh', overflowY: 'auto', border: '1px solid #ddd' }}>
                <table style={{ ...tableStyle, tableLayout: 'fixed' }}>
                    <thead>
                        <tr style={{ background: '#f4f4f4' }}>
                            <th style={{ ...tableHeaderStyle, width: '20%' }}>Nama</th>
                            <th style={{ ...tableHeaderStyle, width: '8%' }}>Tipe</th>
                            <th style={{ ...tableHeaderStyle, width: '12%' }}>Tanggal</th>
                            <th style={{ ...tableHeaderStyle, width: '10%' }}>Jarak (km)</th>
                            <th style={{ ...tableHeaderStyle, width: '15%' }}>Waktu Bergerak</th>
                            <th style={{ ...tableHeaderStyle, width: '15%' }}>HR Rata-rata</th>
                            <th style={{ ...tableHeaderStyle, width: '15%' }}>Pace (min/km)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredActivities.map(activity => (
                            <tr key={activity.id}>
                                <td style={tableCellStyle}>{activity.name}</td>
                                <td style={tableCellStyle}>{activity.type}</td>
                                <td style={tableCellStyle}>{new Date(activity.start_date).toLocaleDateString()}</td>
                                <td style={tableCellStyle}>{(activity.distance / 1000).toFixed(2)}</td>
                                <td style={tableCellStyle}>{secondsToHMS(activity.moving_time)}</td>
                                <td style={tableCellStyle}>
                                    {activity.average_heartrate ? (
                                        <strong>{activity.average_heartrate.toFixed(0)} bpm</strong>
                                    ) : (
                                        'N/A'
                                    )}
                                </td>
                                <td style={tableCellStyle}>
                                    <strong>{calculatePace(activity.moving_time, activity.distance)}</strong>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
        </div>
    );
};

export default AllActivities;