import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, RefreshCw, BarChart3, Clock, TrendingUp, Locate } from 'lucide-react';
import { ResponsiveContainer } from 'recharts'; // Dibiarkan jika ada kebutuhan lain

// URL API backend Go
const API_BASE_URL = 'http://localhost:8080/api/weekly-pace-stats';

// --- Tipe Data ---

interface PaceStat {
    Red: number;
    Orange: number;
    Yellow: number;
    Green: number;
}

interface WeeklyPaceData {
    [date: string]: PaceStat;
}

// Struktur Summary BARU (Pastikan backend Go mengembalikan ini)
interface WeeklySummaryStats {
    total_distance_km: number;
    total_moving_time_seconds: number;
    average_pace_sec_per_m: number; // Detik per meter
}

// Struktur Data Global BARU dari API
interface GlobalWeeklyData {
    pace_data: WeeklyPaceData;
    summary: WeeklySummaryStats;
}

// BarData: Struktur yang digunakan untuk rendering bar harian
interface BarData {
    date: string;
    totalDistance: number;
    zones: {
        zone: keyof PaceStat;
        distance: number;
        percentage: number;
        color: string; // Misal: '#EF4444'
    }[];
}


// Peta untuk nama tampilan (display name)
const displayNames: Record<keyof PaceStat, string> = {
    Red: '🔴 Maks/Interval', 
    Orange: '🟠 Tempo/Threshold',
    Yellow: '🟡 Steady/Aerobic',
    Green: '🟢 Easy/Recovery',
};

// Warna untuk setiap zona tempo (hex codes)
const paceColors: Record<keyof PaceStat, string> = {
    Red: '#EF4444', 
    Orange: '#F97316', 
    Yellow: '#FACC15', 
    Green: '#10B981', 
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

/** Mengkonversi pace (detik/meter) ke format mm:ss /km */
const formatPace = (paceSecPerM: number): string => {
    if (paceSecPerM <= 0) return 'N/A';
    
    const paceSecPerKM = paceSecPerM * 1000;
    
    const minutes = Math.floor(paceSecPerKM / 60);
    const seconds = Math.round(paceSecPerKM % 60);

    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
};

/** Mengkonversi total waktu (detik) ke format HH:MM:SS */
const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '00:00:00';
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Menghitung total jarak dari PaceStat
const calculateTotalDistance = (stats: PaceStat | null): number => {
    if (!stats) return 0;
    const { Red = 0, Orange = 0, Yellow = 0, Green = 0 } = stats;
    return Red + Orange + Yellow + Green;
};

// --- Komponen Utama ---

const App = () => {
    const [globalData, setGlobalData] = useState<GlobalWeeklyData | null>(null);
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentWeekEnd = useMemo(() => {
        const end = new Date(currentWeekStart); 
        end.setDate(end.getDate() + 6); 
        return end;
    }, [currentWeekStart]);

    const fetchWeeklyStats = useCallback(async () => {
        const weekStart = formatDate(currentWeekStart);
        const weekEnd = formatDate(currentWeekEnd);
        
        setIsLoading(true);
        setError(null);
        setGlobalData(null); 

        try {
            const response = await axios.get<GlobalWeeklyData>(
                `${API_BASE_URL}?startDate=${weekStart}&endDate=${weekEnd}`
            );
            
            setGlobalData(response.data); 
        } catch (err) {
            console.error("Error fetching weekly stats:", err);
            setError("Gagal mengambil data dari API. Pastikan server Go berjalan di http://localhost:8080 dan mengembalikan struktur data yang benar (PaceData dan Summary).");
        } finally {
            setIsLoading(false);
        }
    }, [currentWeekStart, currentWeekEnd]);

    useEffect(() => {
        fetchWeeklyStats();
    }, [fetchWeeklyStats]);

    // --- Navigation Handlers ---
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

    // --- LOGIKA DATA (Processed Chart Data) ---
    const processedBarData: BarData[] = useMemo(() => {
        if (!globalData || !globalData.pace_data) return [];

        const weeklyData = globalData.pace_data;

        return Object.entries(weeklyData)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, paceStats]) => {
                const safePaceStats: PaceStat = {
                    Red: paceStats.Red ?? 0,
                    Orange: paceStats.Orange ?? 0,
                    Yellow: paceStats.Yellow ?? 0,
                    Green: paceStats.Green ?? 0,
                };

                const totalDistance = calculateTotalDistance(safePaceStats);
                
                const zones: BarData['zones'] = (Object.keys(paceColors) as (keyof PaceStat)[])
                    .map(zone => {
                        const distance = safePaceStats[zone] ?? 0;
                        const percentage = totalDistance > 0 ? (distance / totalDistance) * 100 : 0;
                        return {
                            zone,
                            distance,
                            percentage,
                            color: paceColors[zone],
                        };
                    })
                    .filter(zoneData => zoneData.distance > 0); // Hanya tampilkan zona yang memiliki jarak

                return {
                    date,
                    totalDistance: totalDistance,
                    zones,
                };
            });
    }, [globalData]);

    const summaryStats = globalData?.summary;
    const overallTotalDistance = summaryStats?.total_distance_km ?? 0;

    // --- DEFINISI KOMPONEN PEMBANTU (Wajib ada di dalam scope App) ---

    // Komponen Pembantu: MetricItem
    interface MetricItemProps {
        label: string;
        value: string;
        color: string;
        icon: React.ElementType;
    }

    const MetricItem: React.FC<MetricItemProps> = ({ label, value, color, icon: Icon }) => (
        <div style={metricItemStyle}>
            <div style={metricIconContainerStyle}>
                <Icon style={{ width: '20px', height: '20px', color: color }} />
            </div>
            <div>
                <p style={{ fontSize: '0.85em', color: '#6B7280', marginBottom: '2px' }}>{label}</p>
                <p style={{ fontSize: '1.4em', fontWeight: 'bolder', color: '#1F2937' }}>
                    {value}
                </p>
            </div>
        </div>
    );
    
    // Komponen Pembantu: DayBarChart
    interface DayBarChartProps {
        dayData: BarData;
    }
    
    const DayBarChart: React.FC<DayBarChartProps> = ({ dayData }) => {
        return (
            <div key={dayData.date} style={dayBarContainerStyle}>
                <div style={dayBarHeaderStyle}>
                    <h3 style={dayBarTitleStyle}>
                        {new Date(dayData.date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </h3>
                    <span style={{...dayBarDistanceStyle, color: dayData.totalDistance > 0 ? '#1E40AF' : '#9CA3AF'}}>
                        {dayData.totalDistance.toFixed(2)} km
                    </span>
                </div>
    
                {/* Stacked Bar Chart Harian */}
                <div style={stackedBarStyle}>
                    {dayData.zones.map(zoneData => (
                        <div 
                            key={zoneData.zone}
                            style={{ 
                                height: '100%', 
                                backgroundColor: zoneData.color,
                                width: `${zoneData.percentage}%`,
                            }}
                            title={`${displayNames[zoneData.zone]}: ${zoneData.distance.toFixed(2)} km (${zoneData.percentage.toFixed(1)}%)`}
                        ></div>
                    ))}
                </div>
            </div>
        );
    };

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

    const SummaryMetricsCard = () => (
        <div style={summaryCardStyle}>
            <h3 style={summaryTitleStyle}>Ringkasan Kinerja</h3>
            
            <MetricItem 
                label="Total Jarak" 
                value={`${overallTotalDistance.toFixed(2)} km`} 
                color="#1E40AF"
                icon={Locate}
            />
            
            <MetricItem 
                label="Pace Rata-rata" 
                value={formatPace(summaryStats?.average_pace_sec_per_m ?? 0)} 
                color="#059669"
                icon={TrendingUp}
            />
            
            <MetricItem 
                label="Total Waktu" 
                value={formatTime(summaryStats?.total_moving_time_seconds ?? 0)} 
                color="#D97706"
                icon={Clock}
            />
            
            <div style={legendContainerStyle}>
                <p style={{fontSize: '0.85em', color: '#6B7280', marginBottom: '8px', fontWeight: 'bold'}}>Distribusi Zona Tempo:</p>
                {(Object.keys(paceColors) as (keyof PaceStat)[])
                    .map(zoneKey => (
                        <span key={zoneKey} style={legendItemStyle}>
                            <span style={{...legendDotStyle, backgroundColor: paceColors[zoneKey]}}></span>
                            {displayNames[zoneKey]}
                        </span>
                    ))}
            </div>
        </div>
    );
    
    const StatsSummary = () => (
        <div style={statsSummaryContainerStyle}>
            <div style={headerStyle}>
                <BarChart3 style={iconStyle} />
                <h2 style={titleStyle}>Analisis Tempo Lari Mingguan</h2>
            </div>
            
            {/* FLEX CONTAINER: Chart (Kiri) vs Summary (Kanan) */}
            <div style={mainContentFlexStyle}>
                
                {/* Chart Column (Kiri - 70%) */}
                <div style={chartColumnStyle}>
                    <h3 style={chartSubTitleStyle}>Jarak Harian Berdasarkan Zona</h3>
                    {processedBarData.length > 0 ? (
                        processedBarData.map(dayData => (
                            <DayBarChart key={dayData.date} dayData={dayData} />
                        ))
                    ) : (
                        <div style={noActivityStyle}>
                            Tidak ada aktivitas lari yang ditemukan dalam rentang waktu ini.
                        </div>
                    )}
                </div>

                {/* Summary Column (Kanan - 30%) */}
                <div style={summaryColumnStyle}>
                    <SummaryMetricsCard />
                </div>
                
            </div>
        </div>
    );


    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', padding: '20px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '960px' }}>
                <header style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '2.25em', fontWeight: 'bolder', color: '#111827', marginBottom: '8px' }}>
                        Pace Zone Tracker
                    </h1>
                    <p style={{ color: '#6B7280' }}>Statistik Lari Mingguan dari Strava</p>
                </header>

                {/* Komponen yang didefinisikan di atas */}
                <DateNavigation />

                {error && <ErrorState />}
                
                {isLoading && !error && <LoadingState />}
                
                {!isLoading && !error && summaryStats && <StatsSummary />}
                
            </div>
        </div>
    );
};

// --- Custom Styles ---

const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '9999px',
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

// --- Styles BARU untuk Tata Letak Flexbox ---
const statsSummaryContainerStyle: React.CSSProperties = {
    padding: '24px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    border: '1px solid #E5E7EB',
};

const headerStyle: React.CSSProperties = {
    display: 'flex', 
    alignItems: 'center', 
    marginBottom: '20px', 
    borderBottom: '2px solid #e0e0e0', 
    paddingBottom: '10px'
}

const mainContentFlexStyle: React.CSSProperties = {
    display: 'flex',
    gap: '24px', 
    flexWrap: 'wrap', 
};

const chartColumnStyle: React.CSSProperties = {
    flex: '2 1 60%', 
    minWidth: '300px',
};

const summaryColumnStyle: React.CSSProperties = {
    flex: '1 1 30%', 
    minWidth: '250px',
};

const summaryCardStyle: React.CSSProperties = {
    padding: '20px',
    backgroundColor: '#F3F4F6',
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
    height: '100%',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const summaryTitleStyle: React.CSSProperties = {
    fontSize: '1.25em',
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: '20px',
    borderBottom: '2px solid #E5E7EB',
    paddingBottom: '10px',
};

const metricItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '12px',
    padding: '8px',
    borderRadius: '6px',
    backgroundColor: 'white',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
};

const metricIconContainerStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: '#F3F4F6',
    border: '1px solid #E5E7EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const chartSubTitleStyle: React.CSSProperties = {
    fontSize: '1.1em',
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: '15px',
    marginTop: '0px',
};

const dayBarContainerStyle: React.CSSProperties = {
    borderBottom: '1px solid #E5E7EB',
    paddingBottom: '12px',
    marginBottom: '16px',
};

const dayBarHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
};

const dayBarTitleStyle: React.CSSProperties = {
    fontSize: '1em',
    fontWeight: 'bold',
    color: '#333',
};

const dayBarDistanceStyle: React.CSSProperties = {
    fontSize: '1em',
    fontWeight: 'bolder',
};

const stackedBarStyle: React.CSSProperties = {
    width: '100%', 
    backgroundColor: '#E5E7EB', 
    borderRadius: '9999px', 
    height: '16px', 
    display: 'flex', 
    overflow: 'hidden',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
};

const noActivityStyle: React.CSSProperties = {
    marginTop: '24px', 
    padding: '16px', 
    backgroundColor: '#F3F4F6', 
    borderRadius: '8px', 
    textAlign: 'center', 
    color: '#6B7280', 
    fontWeight: '500',
};

const iconStyle: React.CSSProperties = {
    width: '24px', 
    height: '24px', 
    color: '#1E40AF', 
    marginRight: '8px',
};

const titleStyle: React.CSSProperties = {
    fontSize: '1.5em', 
    fontWeight: 'bold', 
    color: '#1F2937', 
};

const legendContainerStyle: React.CSSProperties = {
    marginTop: '25px',
    paddingTop: '15px',
    borderTop: '1px solid #D1D5DB',
};

const legendItemStyle: React.CSSProperties = {
    display: 'block',
    alignItems: 'center',
    fontSize: '0.9em',
    color: '#374151',
    marginBottom: '6px',
};

const legendDotStyle: React.CSSProperties = {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    marginRight: '6px',
    display: 'inline-block',
    transform: 'translateY(1px)'
};

// Menambahkan keyframes dan style global
const globalStyles = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

if (typeof window !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = globalStyles;
    document.head.appendChild(styleSheet);
}

export default App;