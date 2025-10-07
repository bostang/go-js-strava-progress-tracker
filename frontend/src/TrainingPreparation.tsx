// frontend/src/TrainingPreparation.tsx
import React, { useState, useMemo } from 'react';
import type { Activity } from './App'; 
import { secondsToHMS } from './utils/StatUtils';

interface TrainingPreparationProps {
    activities: Activity[];
}

const TrainingPreparation: React.FC<TrainingPreparationProps> = ({ activities }) => {
    // State baru untuk mendukung multiple keywords dan filter tanggal
    const [keywords, setKeywords] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);

    // Hitung statistik berdasarkan keyword dan tanggal yang difilter
    const { filteredActivities, stats } = useMemo(() => {
        let result = activities;

        // 1. Filter berdasarkan Multiple Keywords di NAMA AKTIVITAS (activity.name)
        const trimmedKeywords = keywords.trim();

        if (trimmedKeywords) {
            // Memecah input keywords menjadi array, menghilangkan spasi, dan mengubah case jika tidak sensitif
            const searchTerms = trimmedKeywords.split(',').map(term => 
                (caseSensitive ? term.trim() : term.trim().toLowerCase())
            ).filter(term => term.length > 0);
            
            if (searchTerms.length > 0) {
                result = result.filter(activity => {
                    const name = activity.name || ''; 
                    const comparisonText = caseSensitive ? name : name.toLowerCase();
                    
                    // Aktivitas akan cocok jika namanya mengandung SALAH SATU dari searchTerms
                    return searchTerms.some(term => comparisonText.includes(term));
                });
            }
        }
        
        // 2. Filter berdasarkan Range Tanggal (activity.start_date)
        if (startDate || endDate) {
            const startTimestamp = startDate ? new Date(startDate).getTime() : 0;
            // Set endDate ke akhir hari (23:59:59) agar inklusif
            const endTimestamp = endDate 
                ? new Date(endDate).getTime() + (24 * 60 * 60 * 1000) - 1
                : Infinity;

            result = result.filter(activity => {
                const activityTimestamp = new Date(activity.start_date).getTime();
                
                const afterStart = startTimestamp === 0 || activityTimestamp >= startTimestamp;
                const beforeEnd = endTimestamp === Infinity || activityTimestamp <= endTimestamp;

                return afterStart && beforeEnd;
            });
        }

        // 3. Hitung Statistik
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
    }, [activities, keywords, startDate, endDate, caseSensitive]); // Update dependencies

    return (
        <div>
            <h2>Training Preparation & Program Review</h2>
            <p>Gunakan filter di bawah ini untuk menganalisis statistik berdasarkan kata kunci (di **Nama Aktivitas**) dan rentang tanggal.</p>

            {/* Kontrol Filter */}
            <div style={{ padding: '15px', border: '1px solid #0077b6', borderRadius: '8px', background: '#e0f7fa' }}>
                
                {/* Filter Keyword */}
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Filter Keyword (Dipisahkan Koma):</label>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <input
                            type="text"
                            placeholder="Contoh: Long Run, Tempo, Interval"
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            style={{ padding: '10px', border: '1px solid #00a6ff', flex: 1, borderRadius: '4px' }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input 
                                type="checkbox" 
                                checked={caseSensitive} 
                                onChange={() => setCaseSensitive(!caseSensitive)} 
                                style={{ marginRight: '8px', transform: 'scale(1.2)' }}
                            />
                            Case Sensitive
                        </label>
                    </div>
                </div>

                {/* Filter Tanggal */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Filter Rentang Tanggal:</label>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '3px' }}>Tanggal Awal:</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ padding: '10px', border: '1px solid #00a6ff', width: '100%', boxSizing: 'border-box', borderRadius: '4px' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '3px' }}>Tanggal Akhir:</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ padding: '10px', border: '1px solid #00a6ff', width: '100%', boxSizing: 'border-box', borderRadius: '4px' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Display Statistik */}
            <div style={{ margin: '30px 0', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', background: '#f8f8f8' }}>
                <h3>Hasil Statistik Latihan ({filteredActivities.length} Aktivitas):</h3>
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

            {filteredActivities.length === 0 && (keywords.trim() || startDate || endDate) && (
                 <p style={{ color: 'red', marginTop: '20px' }}>Tidak ada aktivitas yang cocok dengan kriteria filter Anda.</p>
            )}
        </div>
    );
};

export default TrainingPreparation;