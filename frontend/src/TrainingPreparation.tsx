// frontend/src/TrainingPreparation.tsx
import React, { useState, useMemo } from 'react';
import type { Activity } from './App'; 
import { secondsToHMS } from './utils/StatUtils';

interface TrainingPreparationProps {
    activities: Activity[];
}

const TrainingPreparation: React.FC<TrainingPreparationProps> = ({ activities }) => {
    const [keyword, setKeyword] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);

    // Hitung statistik berdasarkan keyword yang difilter
    const { filteredActivities, stats } = useMemo(() => {
        let result = activities;

        // 1. Filter berdasarkan keyword di NAMA AKTIVITAS (activity.name)
        if (keyword.trim()) {
            const searchString = caseSensitive ? keyword.trim() : keyword.trim().toLowerCase();
            
            result = result.filter(activity => {
                // Perbaikan: Menggunakan activity.name untuk filter
                const name = activity.name || ''; 
                const comparisonText = caseSensitive ? name : name.toLowerCase();
                
                return comparisonText.includes(searchString);
            });
        }
        
        // 2. Hitung Statistik
        const totalDistanceKm = result.reduce((sum, a) => sum + a.distance / 1000, 0);
        const totalMovingTime = result.reduce((sum, a) => sum + a.moving_time, 0);
        const totalActivities = result.length;

        const averageDistanceKm = totalActivities > 0 ? totalDistanceKm / totalActivities : 0;
        
        const stats = {
            totalDistanceKm,
            totalMovingTime,
            totalActivities,
            averageDistanceKm,
        };
        
        return { filteredActivities: result, stats };
    }, [activities, keyword, caseSensitive]);

    return (
        <div>
            <h2>Training Preparation & Program Review</h2>
            <p>Masukkan kata kunci (keyword) yang ada pada **Nama Aktivitas** (misalnya: "Long Run", "Interval", "Tempo", atau nama program) untuk melihat akumulasi dan statistik latihan tersebut.</p>

            {/* Kontrol Filter Keyword */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', padding: '15px', border: '1px solid #0077b6', borderRadius: '8px', background: '#e0f7fa' }}>
                <input
                    type="text"
                    placeholder="Masukkan Keyword Nama Aktivitas..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    style={{ padding: '10px', border: '1px solid #00a6ff', flex: 1, borderRadius: '4px' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input 
                        type="checkbox" 
                        checked={caseSensitive} 
                        onChange={() => setCaseSensitive(!caseSensitive)} 
                        style={{ marginRight: '8px', transform: 'scale(1.2)' }}
                    />
                    Case Sensitive
                </label>
            </div>

            {/* Display Statistik */}
            <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', background: '#f8f8f8' }}>
                <h3>Hasil Statistik Latihan ({keyword || 'Semua Aktivitas'}):</h3>
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '15px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '1.2em', margin: '0 0 5px 0', color: '#333' }}>Total Aktivitas</p>
                        <h4 style={{ fontSize: '2.5em', margin: 0, color: '#e95420' }}>{stats.totalActivities}</h4>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '1.2em', margin: '0 0 5px 0', color: '#333' }}>Total Jarak</p>
                        <h4 style={{ fontSize: '2.5em', margin: 0, color: '#0077b6' }}>{stats.totalDistanceKm.toFixed(2)} km</h4>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '1.2em', margin: '0 0 5px 0', color: '#333' }}>Total Waktu</p>
                        <h4 style={{ fontSize: '2.5em', margin: 0, color: '#ffb900' }}>{secondsToHMS(stats.totalMovingTime)}</h4>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '1.2em', margin: '0 0 5px 0', color: '#333' }}>Jarak Rata-rata</p>
                        <h4 style={{ fontSize: '2.5em', margin: 0, color: '#a29b3f' }}>{stats.averageDistanceKm.toFixed(2)} km</h4>
                    </div>
                </div>
            </div>

            {/* Ringkasan Tabel Aktivitas yang Difilter */}
            {filteredActivities.length > 0 && (
                <>
                    <h3>Daftar {filteredActivities.length} Aktivitas yang Cocok:</h3>
                    <div style={{ maxHeight: '40vh', overflowY: 'auto', border: '1px solid #ddd' }}>
                        {/* Menggunakan style sederhana karena tabel lengkap ada di AllActivities */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ background: '#f4f4f4' }}>
                                    <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Nama</th>
                                    <th style={{ padding: '10px', border: '1px solid #ddd', width: '15%' }}>Tipe</th>
                                    <th style={{ padding: '10px', border: '1px solid #ddd', width: '20%' }}>Tanggal</th>
                                    <th style={{ padding: '10px', border: '1px solid #ddd', width: '15%' }}>Jarak</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredActivities.map(activity => (
                                    <tr key={activity.id}>
                                        <td style={{ padding: '10px', border: '1px solid #eee', textAlign: 'left' }}>{activity.name}</td>
                                        <td style={{ padding: '10px', border: '1px solid #eee' }}>{activity.type}</td>
                                        <td style={{ padding: '10px', border: '1px solid #eee' }}>{new Date(activity.start_date).toLocaleDateString()}</td>
                                        <td style={{ padding: '10px', border: '1px solid #eee' }}>{(activity.distance / 1000).toFixed(2)} km</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {filteredActivities.length === 0 && keyword.trim() && (
                 <p style={{ color: 'red', marginTop: '20px' }}>Tidak ada aktivitas yang ditemukan dengan keyword: "{keyword}".</p>
            )}
        </div>
    );
};

export default TrainingPreparation;