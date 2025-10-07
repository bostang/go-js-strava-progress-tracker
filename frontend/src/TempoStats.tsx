// frontend/src/TempoStats.tsx
import React, { useMemo } from 'react';
import type { Activity } from './App'; 
// FIX: Menghapus 'metersPerSecondToPace' yang tidak diekspor
import { secondsToMinutesAndSeconds, secondsToHMS } from './utils/StatUtils'; 

// Definisikan kategori dan warnanya
const TEMPO_CATEGORIES = {
    '🔴': 'Very Fast Tempo',
    '🟠': 'Fast  Tempo',
    '🟡': 'Moderate Tempo',
    '🟢': 'Slow Tempo',
};

interface Stats {
    totalDistanceKm: number;
    totalMovingTime: number;
    averagePacePerKm: number; // Dalam detik per km
    averageHeartRate: number;
    activityCount: number;
}

interface TempoStatsProps {
    activities: Activity[];
}

const TempoStats: React.FC<TempoStatsProps> = ({ activities }) => {

    const categoryStats = useMemo(() => {
        // Inisialisasi hasil untuk setiap kategori
        const initialStats: Record<keyof typeof TEMPO_CATEGORIES, Stats> = 
            (Object.keys(TEMPO_CATEGORIES) as (keyof typeof TEMPO_CATEGORIES)[]).reduce((acc, key) => ({
                ...acc,
                [key]: {
                    totalDistanceKm: 0,
                    totalMovingTime: 0,
                    averagePacePerKm: 0,
                    averageHeartRate: 0,
                    activityCount: 0,
                }
            }), {} as any);

        // Map untuk mengumpulkan data mentah (total jarak, total waktu, total HR)
        const rawData: Record<keyof typeof TEMPO_CATEGORIES, { 
            totalDistance: number, 
            totalMovingTime: number, 
            totalHeartRate: number, // Sum of average_heartrate
            hrCount: number, // Count of activities with HR data
            count: number 
        }> = (Object.keys(TEMPO_CATEGORIES) as (keyof typeof TEMPO_CATEGORIES)[]).reduce((acc, key) => ({
            ...acc,
            [key]: { totalDistance: 0, totalMovingTime: 0, totalHeartRate: 0, hrCount: 0, count: 0 }
        }), {} as any);

        // 1. Klasifikasikan dan Akumulasikan Data
        activities.forEach(activity => {
            if (activity.type !== 'Run') return; // Hanya fokus pada lari
            
            // Cek setiap kategori
            (Object.keys(TEMPO_CATEGORIES) as (keyof typeof TEMPO_CATEGORIES)[]).forEach(symbol => {
                if (activity.name?.includes(symbol)) {
                    rawData[symbol].totalDistance += activity.distance;
                    rawData[symbol].totalMovingTime += activity.moving_time;
                    rawData[symbol].count += 1;

                    // Akumulasi Heart Rate hanya jika data tersedia
                    if (activity.average_heartrate && activity.average_heartrate > 0) {
                        rawData[symbol].totalHeartRate += activity.average_heartrate;
                        rawData[symbol].hrCount += 1;
                    }
                }
            });
        });

        // 2. Hitung Statistik Akhir (Rata-rata)
        const finalStats: Record<keyof typeof TEMPO_CATEGORIES, Stats> = { ...initialStats };

        (Object.keys(TEMPO_CATEGORIES) as (keyof typeof TEMPO_CATEGORIES)[]).forEach(symbol => {
            const data = rawData[symbol];
            
            if (data.count > 0) {
                const totalDistanceKm = data.totalDistance / 1000;
                
                finalStats[symbol] = {
                    activityCount: data.count,
                    totalDistanceKm: totalDistanceKm,
                    totalMovingTime: data.totalMovingTime,
                    // Pace Rata-rata Total (Total Waktu / Total Jarak Km)
                    averagePacePerKm: totalDistanceKm > 0 ? data.totalMovingTime / totalDistanceKm : 0,
                    // Heart Rate Rata-rata (Total HR / Jumlah Aktivitas dengan HR)
                    averageHeartRate: data.hrCount > 0 ? data.totalHeartRate / data.hrCount : 0,
                };
            }
        });

        return finalStats;
    }, [activities]);

    const isDataAvailable = Object.values(categoryStats).some(stat => stat.activityCount > 0);

    return (
        <div>
            <h2>Perbandingan Statistik Latihan Berdasarkan Klasifikasi Tempo (🔴🟠🟡🟢)</h2>
            <p>Statistik dihitung dengan mengelompokkan aktivitas yang Nama Aktivitasnya mengandung salah satu emoji klasifikasi tempo yang Anda gunakan.</p>

            {!isDataAvailable && (
                <p style={{ color: '#e95420', fontWeight: 'bold' }}>
                    ⚠️ Tidak ada aktivitas lari yang ditemukan mengandung salah satu dari keyword 🔴, 🟠, 🟡, atau 🟢.
                </p>
            )}

            {isDataAvailable && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginTop: '30px' }}>
                    {(Object.keys(TEMPO_CATEGORIES) as (keyof typeof TEMPO_CATEGORIES)[]).map(symbol => {
                        const description = TEMPO_CATEGORIES[symbol];
                        const stats = categoryStats[symbol];
                        const colorCode = symbol === '🔴' ? '#FF4500' : symbol === '🟠' ? '#FF8C00' : symbol === '🟡' ? '#FFD700' : '#3CB371';
                        
                        return (
                            <div key={symbol} style={{ 
                                border: `2px solid ${colorCode}`, 
                                borderRadius: '8px', 
                                padding: '15px', 
                                textAlign: 'center',
                                backgroundColor: '#fff',
                                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                            }}>
                                <h3 style={{ color: colorCode, margin: '0 0 10px 0', fontSize: '1.5em' }}>
                                    {symbol} {description}
                                </h3>
                                <p style={{ fontSize: '1.8em', fontWeight: 'bold', margin: '10px 0', color: '#333' }}>
                                    {stats.activityCount} Aktivitas
                                </p>
                                
                                <div style={{ borderTop: '1px solid #eee', paddingTop: '10px' }}>
                                    {/* 1. Jarak Total */}
                                    <p style={{ margin: '5px 0', fontSize: '1.1em' }}>
                                        Jarak Total: <strong style={{ color: '#0077b6' }}>{stats.totalDistanceKm.toFixed(2)} km</strong>
                                    </p>
                                    
                                    {/* 2. Pace Rata-rata */}
                                    <p style={{ margin: '5px 0', fontSize: '1.1em' }}>
                                        Pace Rata-rata: <strong style={{ color: '#e95420' }}>
                                            {stats.totalDistanceKm > 0 ? secondsToMinutesAndSeconds(stats.averagePacePerKm) : 'N/A'} /km
                                        </strong>
                                    </p>
                                    
                                    {/* 3. Heart Rate Rata-rata */}
                                    <p style={{ margin: '5px 0', fontSize: '1.1em' }}>
                                        HR Rata-rata: <strong style={{ color: '#8A2BE2' }}>
                                            {stats.averageHeartRate > 0 ? stats.averageHeartRate.toFixed(0) : 'N/A'} bpm
                                        </strong>
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TempoStats;