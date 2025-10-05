import React, { useState, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Activity } from './App';
import { calculatePace } from './utils/StatUtils'; 

interface PerformancePlotProps {
    activities: Activity[];
}

// Definisikan pemetaan warna
const TYPE_COLORS: { [key: string]: string } = {
    'Run': '#e95420',   // Merah
    'Walk': '#ffb900',  // Oranye
    'Hike': '#a29b3f',  // Kuning Gelap
    'Ride': '#3879a8',  // Biru (Mapping Bike ke Ride)
};

// Definisikan Tipe data lengkap
interface PlotDataPoint {
    id: number;
    name: string;
    type: 'Run' | 'Walk' | 'Hike' | 'Ride';
    pace: number;
    heartRate: number;
    distanceKm: number;
    dotRadius: number;
    color: string; 
}

const PerformancePlot: React.FC<PerformancePlotProps> = ({ activities }) => {
    // Hooks (Filter State)
    const [showRun, setShowRun] = useState(true);
    const [showWalk, setShowWalk] = useState(true);
    const [showHike, setShowHike] = useState(true);
    const [showBike, setShowBike] = useState(true);

    // 1. Data MENTAH (Mapped) - Dibuat hanya sekali dari activities
    const mappedData = useMemo(() => {
        return activities
            .filter(a => a.moving_time > 0 && a.distance > 0 && a.average_heartrate > 0)
            .map(a => {
                const pace_s_per_km = (a.moving_time / a.distance) * 1000;
                const typeKey = a.type === 'Bike' ? 'Ride' : a.type;
                
                return {
                    id: a.id,
                    name: a.name,
                    type: typeKey as 'Run' | 'Walk' | 'Hike' | 'Ride',
                    pace: pace_s_per_km, 
                    heartRate: a.average_heartrate,
                    distanceKm: a.distance / 1000,
                    dotRadius: Math.max(3, Math.min(15, a.distance / 5000)),
                    color: TYPE_COLORS[typeKey] || '#8884d8' 
                };
            });
    }, [activities]); 
    
    // 2. Data TERFILTER - Dihitung ulang setiap kali filter berubah
    const filteredPlotData = useMemo(() => {
        return mappedData.filter(d => {
            if (d.type === 'Run') return showRun;
            if (d.type === 'Walk') return showWalk;
            if (d.type === 'Hike') return showHike;
            if (d.type === 'Ride') return showBike; 
            return false;
        });
    }, [mappedData, showRun, showWalk, showHike, showBike]);


    if (filteredPlotData.length === 0) {
        // Tampilkan pesan jika tidak ada data yang difilter (atau semua filter dimatikan)
        return <p>Tidak ada data aktivitas yang valid yang cocok dengan filter saat ini.</p>;
    }

    // 3. Data terpisah per tipe (Digunakan untuk 4 Scatter terpisah)
    const runData = filteredPlotData.filter(d => d.type === 'Run');
    const walkData = filteredPlotData.filter(d => d.type === 'Walk');
    const hikeData = filteredPlotData.filter(d => d.type === 'Hike');
    const rideData = filteredPlotData.filter(d => d.type === 'Ride');


    // 4. Hitung Domain Sumbu dari filteredPlotData! (Ini kuncinya)
    const allHeartRates = filteredPlotData.map(d => d.heartRate).filter(Boolean);
    const minHR = allHeartRates.length ? Math.min(...allHeartRates) : 100;
    const maxHR = allHeartRates.length ? Math.max(...allHeartRates) : 180;
    
    const allPaces = filteredPlotData.map(d => d.pace).filter(Boolean);
    const minPace = allPaces.length ? Math.min(...allPaces) : 180; 
    const maxPace = allPaces.length ? Math.max(...allPaces) : 6000; 

    // Fungsi Tooltip (Disesuaikan)
    const renderTooltip = ({ payload }: any) => {
        if (payload && payload.length) {
            // Filter payload yang sebenarnya punya data
            const activePayloads = payload.filter((p: any) => p.payload && p.value);

            if (activePayloads.length === 0) return null;

            // Ambil data pertama yang valid
            const data = activePayloads[0].payload as PlotDataPoint; 
            
            if (!data) return null;
            
            const paceString = calculatePace(data.pace, 1000); 
            
            return (
                <div style={{ background: 'white', border: '1px solid #ccc', padding: '10px', fontSize: '14px' }}>
                    <p style={{ fontWeight: 'bold', margin: '0 0 5px 0', color: data.color }}>{data.name || 'Aktivitas Tidak Bernama'}</p>
                    <p style={{ margin: '2px 0' }}>Tipe: {data.type || 'N/A'}</p>
                    <p style={{ margin: '2px 0' }}>Jarak: {data.distanceKm ? data.distanceKm.toFixed(2) : 'N/A'} km</p>
                    <p style={{ margin: '2px 0' }}>Pace: <strong style={{color: TYPE_COLORS['Run']}}>{paceString}</strong></p>
                    <p style={{ margin: '2px 0' }}>HR Rata-rata: <strong style={{color: TYPE_COLORS['Ride']}}>{data.heartRate ? data.heartRate.toFixed(0) : 'N/A'} bpm</strong></p>
                </div>
            );
        }
        return null;
    };
    
    // Custom Tick Formatter untuk Sumbu X (tetap)
    const paceTickFormatter = (value: number) => {
        const pace = calculatePace(value, 1000);
        return pace.split(' ')[0]; 
    };
    
    return (
        <div>
            <h2>Performance Plot (Pace vs Heart Rate)</h2>
            <p>Visualisasi hubungan antara Pace (menit/km) dan Rata-rata Heart Rate (bpm). Ukuran dot menunjukkan Jarak.</p>

            {/* Filter Controls (tetap) */}
            <div style={{ 
                marginBottom: '20px', 
                border: '1px solid #ddd', 
                padding: '10px', 
                borderRadius: '5px', 
                display: 'flex', 
                gap: '15px',
                flexWrap: 'wrap' 
            }}>
                <label style={{ color: TYPE_COLORS['Run'] }}>
                    <input type="checkbox" checked={showRun} onChange={() => setShowRun(!showRun)} />
                    Run
                </label>
                <label style={{ color: TYPE_COLORS['Walk'] }}>
                    <input type="checkbox" checked={showWalk} onChange={() => setShowWalk(!showWalk)} />
                    Walk
                </label>
                <label style={{ color: TYPE_COLORS['Hike'] }}>
                    <input type="checkbox" checked={showHike} onChange={() => setShowHike(!showHike)} />
                    Hike
                </label>
                <label style={{ color: TYPE_COLORS['Ride'] }}>
                    <input type="checkbox" checked={showBike} onChange={() => setShowBike(!showBike)} />
                    Bike
                </label>
            </div>

            {/* Scatter Plot */}
            <div style={{ width: '100%', height: 650, marginTop: '20px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                        margin={{ top: 10, right: 10, bottom: 30, left: 10 }} 
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        
                        {/* XAxis: Domain dihitung ulang dari data terfilter */}
                        <XAxis 
                            type="number" dataKey="pace" name="Pace" tickFormatter={paceTickFormatter}
                            domain={[Math.floor(minPace * 0.95), Math.ceil(maxPace * 1.05)]}
                            reversed={true} interval="preserveStartEnd" allowDuplicatedCategory={false}
                            label={{ value: 'Pace (menit:detik /km)', position: 'bottom', dy: 10, fill: '#333', fontWeight: 'bold' }}
                        />
                        
                        {/* YAxis: Domain dihitung ulang dari data terfilter */}
                        <YAxis 
                            type="number" dataKey="heartRate" name="Heart Rate" unit=" bpm" tickCount={8} 
                            domain={[Math.floor(minHR * 0.9 / 5) * 5, Math.ceil(maxHR * 1.1 / 5) * 5]}
                            label={{ value: 'Heart Rate (bpm)', angle: -90, position: 'left', fill: '#333', fontWeight: 'bold' }}
                        />
                        
                        <Tooltip 
                            cursor={{ strokeDasharray: '3 3' }} 
                            content={renderTooltip}
                        />
                        
                        <Legend 
                            layout="horizontal" 
                            verticalAlign="top" 
                            align="center" 
                            wrapperStyle={{ paddingTop: '10px', paddingBottom: '10px' }} 
                        />
                        
                        {/* 4 Komponen Scatter menggunakan data yang sudah difilter */}
                        {runData.length > 0 && (
                            <Scatter 
                                name="Run" 
                                data={runData} 
                                dataKey="pace" 
                                fill={TYPE_COLORS['Run']} 
                            />
                        )}
                        {walkData.length > 0 && (
                            <Scatter 
                                name="Walk" 
                                data={walkData} 
                                dataKey="pace" 
                                fill={TYPE_COLORS['Walk']} 
                            />
                        )}
                        {hikeData.length > 0 && (
                            <Scatter 
                                name="Hike" 
                                data={hikeData} 
                                dataKey="pace" 
                                fill={TYPE_COLORS['Hike']} 
                            />
                        )}
                        {rideData.length > 0 && (
                            <Scatter 
                                name="Bike" 
                                data={rideData} 
                                dataKey="pace" 
                                fill={TYPE_COLORS['Ride']} 
                            />
                        )}

                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PerformancePlot;