import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, RefreshCw, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// URL API backend Go
const API_BASE_URL = 'http://localhost:8080/api/weekly-pace-stats';

// --- Tipe Data (Menggunakan Key Sederhana) ---

interface PaceStat {
    // ASUMSI: Backend Go sekarang mengirimkan key sederhana
    Red: number;
    Orange: number;
    Yellow: number;
    Green: number;
}

interface WeeklyPaceData {
    [date: string]: PaceStat;
}

// BarData: Struktur yang digunakan untuk Recharts (diratakan)
interface ChartData extends PaceStat {
    date: string;
    totalDistance: number;
}

// Peta untuk nama tampilan (display name) dan warna
const displayNames: Record<keyof PaceStat, string> = {
    Red: '🔴 Maks/Interval', 
    Orange: '🟠 Tempo/Threshold',
    Yellow: '🟡 Steady/Aerobic',
    Green: '🟢 Easy/Recovery',
};

// Warna untuk setiap zona tempo (hex codes)
const paceColors: Record<keyof PaceStat, string> = {
    Red: '#EF4444', // Red-500
    Orange: '#F97316', // Orange-600
    Yellow: '#FACC15', // Yellow-500
    Green: '#10B981', // Green-500
};

// --- Utility Functions ---

/** Mengambil tanggal Senin (start date) dari minggu yang diberikan. */
const getMonday = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0); 
    const day = d.getDay(); 
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(d.setDate(diff));
    return monday;
};

// Memformat tanggal ke YYYY-MM-DD
const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

// Menghitung total jarak dari PaceStat
const calculateTotalDistance = (stats: PaceStat | null): number => {
    if (!stats) return 0;
    // Menggunakan key sederhana untuk menghitung total
    const { Red = 0, Orange = 0, Yellow = 0, Green = 0 } = stats;
    return Red + Orange + Yellow + Green;
};

// --- Komponen Pembantu: WeeklyPaceChart ---

interface WeeklyPaceChartProps {
    data: ChartData[];
}

const WeeklyPaceChart: React.FC<WeeklyPaceChartProps> = ({ data }) => {
    // Memformat label XAxis (hanya hari)
    const formatXAxis = (tickItem: string) => {
        const date = new Date(tickItem);
        return date.toLocaleDateString('id-ID', { weekday: 'short' });
    };

    return (
        <div style={{ width: '100%', height: 350, marginTop: '20px', padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="date" tickFormatter={formatXAxis} />
                    <YAxis label={{ value: 'Jarak (km)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                        // Menggunakan displayNames untuk menampilkan nama zona yang lebih indah
                        formatter={(value: number, name: string) => [`${value.toFixed(2)} km`, displayNames[name as keyof PaceStat] || name]} 
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    
                    {/* Menggunakan key data sederhana untuk Bar */}
                    {Object.keys(paceColors).map(key => {
                        const paceKey = key as keyof PaceStat;
                        return (
                            <Bar 
                                key={paceKey}
                                dataKey={paceKey} 
                                stackId="a" 
                                name={displayNames[paceKey]} // Nama Legend yang indah
                                fill={paceColors[paceKey]} 
                            />
                        );
                    })}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

// --- Komponen Utama ---

const App = () => {
    const [weeklyData, setWeeklyData] = useState<WeeklyPaceData | null>(null);
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentWeekEnd = useMemo(() => {
        const end = new Date(currentWeekStart); 
        end.setDate(end.getDate() + 6); // Hari Minggu
        return end;
    }, [currentWeekStart]);

    const fetchWeeklyStats = useCallback(async () => {
        const weekStart = formatDate(currentWeekStart);
        const weekEnd = formatDate(currentWeekEnd);
        
        setIsLoading(true);
        setError(null);
        setWeeklyData(null); 

        try {
            const response = await axios.get<WeeklyPaceData>(
                `${API_BASE_URL}?startDate=${weekStart}&endDate=${weekEnd}`
            );
            
            // Asumsi: response.data sekarang memiliki key sederhana (Red, Orange, dll.)
            setWeeklyData(response.data); 
        } catch (err) {
            console.error("Error fetching weekly stats:", err);
            setError("Gagal mengambil data dari API. Pastikan server Go berjalan di http://localhost:8080 dan menggunakan key JSON sederhana (Red, Orange, dll.).");
        } finally {
            setIsLoading(false);
        }
    }, [currentWeekStart, currentWeekEnd]);

    useEffect(() => {
        fetchWeeklyStats();
    }, [fetchWeeklyStats]);

    // --- Navigation Handlers (Dihilangkan untuk brevity) ---
    const handlePreviousWeek = () => {
        const newStart = new Date(currentWeekStart);
        newStart.setDate(newStart.getDate() - 7);
        setCurrentWeekStart(newStart);
    };

    const handleNextWeek = () => {
        const newStart = new Date(currentWeekStart);
        newStart.setDate(newStart.getDate() + 7);
        setCurrentWeekStart(newStart);
    };

    const handleGoToCurrentWeek = () => {
        setCurrentWeekStart(getMonday(new Date()));
    };

    // LOGIKA PERBAIKAN: Memproses data harian menggunakan key sederhana
    const processedChartData: ChartData[] = useMemo(() => {
        if (!weeklyData) return [];

        return Object.entries(weeklyData)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, paceStats]) => {
                // Gunakan spread dan ?? 0 untuk memastikan semua key ada dan bernilai numerik
                const safePaceStats: PaceStat = {
                    Red: paceStats.Red ?? 0,
                    Orange: paceStats.Orange ?? 0,
                    Yellow: paceStats.Yellow ?? 0,
                    Green: paceStats.Green ?? 0,
                };

                const totalDistance = calculateTotalDistance(safePaceStats);
                
                return {
                    date,
                    totalDistance: parseFloat(totalDistance.toFixed(2)),
                    // Menggunakan key sederhana, dijamin angka karena sudah di-guard
                    Red: parseFloat(safePaceStats.Red.toFixed(2)),
                    Orange: parseFloat(safePaceStats.Orange.toFixed(2)),
                    Yellow: parseFloat(safePaceStats.Yellow.toFixed(2)),
                    Green: parseFloat(safePaceStats.Green.toFixed(2)),
                };
            });
    }, [weeklyData]);

    const overallTotalDistance = processedChartData.reduce((sum, day) => sum + day.totalDistance, 0);

    // --- Render Components (Tidak berubah) ---

    const DateNavigation = () => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <button 
                onClick={handlePreviousWeek} 
                style={buttonStyle}
                aria-label="Minggu sebelumnya"
            >
                <ChevronLeft style={{ width: '20px', height: '20px' }} />
            </button>
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1em', color: '#333' }}>
                {currentWeekStart.toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})} - {currentWeekEnd.toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'})}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                    onClick={handleNextWeek} 
                    style={buttonStyle}
                    aria-label="Minggu berikutnya"
                >
                    <ChevronRight style={{ width: '20px', height: '20px' }} />
                </button>
                <button 
                    onClick={handleGoToCurrentWeek} 
                    style={buttonStyle}
                    aria-label="Kembali ke minggu ini"
                >
                    <RefreshCw style={{ width: '18px', height: '18px' }} />
                </button>
            </div>
        </div>
    );

    const LoadingState = () => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', height: '250px' }}>
            <div className="spinner" style={spinnerStyle}></div>
            <p style={{ marginTop: '16px', color: '#1E40AF', fontWeight: '600' }}>Memuat statistik mingguan...</p>
        </div>
    );

    const ErrorState = () => (
        <div style={{ padding: '16px', backgroundColor: '#FEE2E2', borderLeft: '4px solid #DC2626', color: '#991B1B', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontWeight: 'bold' }}>Kesalahan API</p>
            <p>{error}</p>
            <p style={{ marginTop: '8px', fontSize: '0.875em' }}>Cek konsol browser dan pastikan server Go Anda berjalan.</p>
        </div>
    );

    const StatsSummary = () => (
        <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>
                <BarChart3 style={{ width: '24px', height: '24px', color: '#1E40AF', marginRight: '8px' }} />
                <h2 style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#333' }}>Analisis Tempo Lari Mingguan</h2>
            </div>
            
            <div style={{ fontSize: '2em', fontWeight: 'bolder', color: '#1E40AF', marginBottom: '8px' }}>
                {overallTotalDistance.toFixed(2)} km
            </div>
            <p style={{ fontSize: '0.875em', color: '#6B7280' }}>Total Jarak Lari Minggu Ini</p>

            <WeeklyPaceChart data={processedChartData} />

            {overallTotalDistance === 0 && (
                <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#F3F4F6', borderRadius: '8px', textAlign: 'center', color: '#6B7280', fontWeight: '500' }}>
                    Tidak ada aktivitas lari yang ditemukan dalam rentang waktu ini.
                </div>
            )}
        </div>
    );


    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', padding: '20px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '700px' }}>
                <header style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '2.25em', fontWeight: 'bolder', color: '#111827', marginBottom: '8px' }}>
                        Pace Zone Tracker
                    </h1>
                    <p style={{ color: '#6B7280' }}>Statistik Lari Mingguan dari Strava</p>
                </header>

                <DateNavigation />

                {error && <ErrorState />}
                
                {isLoading && !error && <LoadingState />}
                
                {!isLoading && !error && <StatsSummary />}
                
            </div>
        </div>
    );
};

// --- Custom Styles for Buttons and Spinner ---
const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '9999px', // Rounded full
    backgroundColor: '#fff',
    border: '1px solid #D1D5DB',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#374151',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    flexShrink: 0,
};

const spinnerStyle: React.CSSProperties = {
    border: '4px solid rgba(0, 0, 0, 0.1)',
    borderTop: '4px solid #1E40AF',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
};

// Menambahkan keyframes untuk CSS murni
const globalStyles = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

// Menambahkan style global ke DOM
if (typeof window !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = globalStyles;
    document.head.appendChild(styleSheet);
}

export default App;