// frontend/src/App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

import Home from './Home';
import DistanceStats from './DistanceStats';
import PaceStats from './PaceStats';
import AllActivities from './AllActivities';
import PerformancePlot from './PerformancePlot';
import TrainingPreparation from './TrainingPreparation'; 
import TempoStats from './TempoStats';
import WeeklyActivity from './WeeklyActivity';
// ----------------------------

// --- Interface Data Global ---
export interface Activity {
    id: number;
    name: string;
    distance: number; // Dalam meter
    moving_time: number; // Dalam detik
    type: string;
    start_date: string;
    average_heartrate: number;
}

export interface MonthlySportStats {
    month_year: string;
    run_walk_hike: number;
    bike: number;
    other: number;
}

export interface MonthlyPaceStats { 
    month_year: string;
    // Pace Rata-rata dalam detik/meter (s/m)
    run_walk_hike_pace: number; 
    bike_pace: number; 
    other_pace: number;
    // Total distance diperlukan untuk tabel ringkasan
    run_walk_hike_distance: number; 
    bike_distance: number;
    other_distance: number;
}

export interface CategoryTableProps { 
    stats: any; 
    categoryKey: string; 
    title: string;
}
// ---------------------------------

export const BACKEND_URL = 'http://localhost:8080';

// --- STYLES UNTUK FIXED HEADER ---

const headerStyle: React.CSSProperties = {
    position: 'fixed', 
    top: 0,
    left: 0,
    width: '100%',
    backgroundColor: '#ffffff',
    borderBottom: '3px solid #e95420',
    padding: '10px 30px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    zIndex: 1000,
};

const titleStyle: React.CSSProperties = {
    margin: '0',
    fontSize: '2em',
    color: '#2c2f33'
};

const statusStyle: React.CSSProperties = {
    fontSize: '0.9em',
    color: '#666',
    margin: '5px 0 10px 0',
};

const navContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '25px',
    marginTop: '10px',
    paddingTop: '5px'
};

const linkStyle: React.CSSProperties = {
    textDecoration: 'none',
    color: '#e95420',
    fontWeight: 'bold',
    fontSize: '1.1em',
    transition: 'color 0.2s',
};

const mainContentStyle: React.CSSProperties = {
    marginTop: '150px', 
    padding: '20px 30px',
};


const App: React.FC = () => {
    const [backendStatus, setBackendStatus] = useState<string>('Checking backend...');
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [monthlyStats, setMonthlyStats] = useState<MonthlySportStats[]>([]);
    const [monthlyPaceStats, setMonthlyPaceStats] = useState<MonthlyPaceStats[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    // Fungsi fetchStats dan fetchActivities (dibiarkan tetap)
    const fetchStats = useCallback(async () => {
        try {
            const [statsRes, paceRes] = await Promise.all([
                axios.get<MonthlySportStats[]>(`${BACKEND_URL}/api/stats`), 
                axios.get<MonthlyPaceStats[]>(`${BACKEND_URL}/api/pace-stats`)
            ]);
            setMonthlyStats(statsRes.data);
            setMonthlyPaceStats(paceRes.data);
            console.log("Statistik Jarak dan Pace berhasil dimuat.");
        } catch (error) {
            console.error("Gagal mengambil statistik:", error);
        }
    }, []);

    const fetchActivities = useCallback(async (isRefresh: boolean, tokenOverride?: string | null) => {
        const token = tokenOverride || accessToken;
        if (!token) return;
        
        localStorage.setItem('strava_token', token);
        setLoading(true);
        try {
            let url = `${BACKEND_URL}/api/activities`;
            if (isRefresh) {
                url = `${BACKEND_URL}/api/activities?refresh=true&token=${token}`;
            } else if (token) {
                url = `${BACKEND_URL}/api/activities?token=${token}`;
            }

            const response = await axios.get(url);
            setActivities(response.data as Activity[]);
            
            await fetchStats(); 
            
            if (isRefresh) {
                console.log(`Berhasil me-refresh data. Total ${response.data.length} aktivitas tersimpan.`);
            }
        } catch (error) {
            console.error("Gagal mengambil data dari Strava:", error);
            console.error("Gagal mengambil data. Token mungkin kedaluwarsa atau server backend bermasalah.");
        } finally {
            setLoading(false);
        }
    }, [accessToken, fetchStats]); 

    // Hooks untuk Inisialisasi
    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/status`)
            .then(res => setBackendStatus(res.data.status))
            .catch(() => setBackendStatus(`Error: Pastikan Go Server berjalan di ${BACKEND_URL}!`));

        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (token) {
            setAccessToken(token);
            window.history.replaceState({}, document.title, window.location.pathname);
            fetchActivities(false, token);
        } else if (localStorage.getItem('strava_token')) {
            const storedToken = localStorage.getItem('strava_token');
            setAccessToken(storedToken);
            fetchActivities(false, storedToken);
        }
    }, [fetchActivities]);

    // --- Render Fixed Header dan Router ---
    return (
        <div style={{ padding: 0 }}> 
            
            {/* FIXED HEADER */}
            <header style={headerStyle}>
                <h1 style={titleStyle}>Strava Monitor App</h1>
                {/* <p style={statusStyle}>
                    Backend Status: <strong>{backendStatus}</strong>
                </p> */}

                {/* Navigation */}
                {accessToken && (
                    <nav style={navContainerStyle}>
                        {/* Menggunakan Link dari react-router-dom */}
                        <Link to="/" style={linkStyle}>Home & Sync</Link>
                        <Link to="/activities" style={linkStyle}>All Activities</Link> 
                        <Link to="/stats/distance" style={linkStyle}>Distance Stats</Link>
                        <Link to="/stats/pace" style={linkStyle}>Pace Stats</Link>
                        <Link to="/plot/performance" style={linkStyle}>Performance Plot</Link>
                        <Link to="/preparation" style={linkStyle}>Training Preparation</Link> 
                        <Link to="/stats/tempo" style={linkStyle}>Tempo Stats</Link> 
                        <Link to="/stats/weekly-pace" style={linkStyle}>Weekly Activity</Link> {/* 🌟 BARU: Link untuk Aktivitas Mingguan */}
                    </nav>
                )}
            </header>

            {/* MAIN CONTENT (Diberi margin-top agar tidak tertutup header) */}
            <main style={mainContentStyle}>
                <Routes>
                    <Route 
                        path="/" 
                        element={
                            <Home 
                                accessToken={accessToken} 
                                loading={loading} 
                                fetchActivities={fetchActivities} 
                            />
                        } 
                    />
                    <Route 
                        path="/activities" 
                        element={
                            <AllActivities 
                                activities={activities} 
                            />
                        } 
                    />
                    <Route 
                        path="/stats/distance" 
                        element={
                            <DistanceStats 
                                activities={activities} 
                                monthlyStats={monthlyStats} 
                            />
                        } 
                    />
                    <Route 
                        path="/stats/pace" 
                        element={
                            <PaceStats 
                                monthlyPaceStats={monthlyPaceStats} 
                            />
                        } 
                    />
                    <Route 
                        path="/plot/performance" 
                        element={
                            <PerformancePlot 
                                activities={activities} // Melewatkan semua aktivitas
                            />
                        } 
                    />
                    {/* Rute untuk Training Preparation */}
                    <Route 
                        path="/preparation" 
                        element={
                            <TrainingPreparation
                                activities={activities}
                            />
                        }
                    />
                    {/* Rute untuk Tempo Stats */}
                    <Route 
                        path="/stats/tempo" 
                        element={
                            <TempoStats
                                activities={activities}
                            />
                        }
                    />

                    {/* 🌟 Rute BARU: Aktivitas per Minggu */}
                    <Route 
                        path="/stats/weekly-pace" 
                        element={<WeeklyActivity />} 
                    />
                </Routes>
            </main>
        </div>
    );
};

export default App;