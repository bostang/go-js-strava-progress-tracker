// frontend/src/Home.tsx
import React from 'react';

// Konstanta BACKEND_URL didefinisikan secara lokal untuk mengatasi error impor.
// Nilai ini harus sesuai dengan alamat backend Go Anda.
const BACKEND_URL = 'http://localhost:8080';

interface HomeProps {
    accessToken: string | null;
    loading: boolean;
    fetchActivities: (isRefresh: boolean, tokenOverride?: string | null) => Promise<void>;
}

// --- Style Khusus Halaman Home ---
const styles = {
    // Style untuk container utama (opsional)
    container: {
        // FIX: Mengganti shorthand 'border' dengan longhand properties
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#ddd',
        padding: '20px',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
    },
    // Style tombol koneksi (merah oranye Strava)
    connectButton: {
        padding: '12px 25px',
        fontSize: '18px',
        cursor: 'pointer',
        backgroundColor: '#fc4c02', // Warna merah oranye khas Strava
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        fontWeight: 'bold' as const,
        transition: 'background-color 0.2s',
    },
    // Style tombol aksi (Tampilkan Data)
    loadButton: {
        padding: '10px 18px',
        fontSize: '15px',
        cursor: 'pointer',
        marginRight: '15px',
        border: '1px solid #ccc',
        backgroundColor: 'white',
        borderRadius: '5px',
        transition: 'background-color 0.2s',
    },
    // Style tombol refresh (Sync)
    refreshButton: {
        padding: '10px 18px',
        fontSize: '15px',
        cursor: 'pointer',
        backgroundColor: '#e95420',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        fontWeight: 'normal' as const,
        transition: 'opacity 0.2s',
    },
    // Style untuk pesan status
    statusMessage: {
        fontSize: '1.1em',
        fontWeight: 'bold' as const,
        color: '#28a745', // Warna hijau untuk status sukses
        marginBottom: '20px',
    },
    // Style untuk area tombol aksi
    buttonArea: {
        marginTop: '15px',
        paddingTop: '15px',
        borderTop: '1px solid #eee',
    }
};

const Home: React.FC<HomeProps> = ({ accessToken, loading, fetchActivities }) => {
    
    const handleRefresh = () => {
        fetchActivities(true, accessToken);
    };

    const handleLoadLocal = () => {
        fetchActivities(false, accessToken);
    };

    return (
        <div>
            <h2>Home & Sinkronisasi Data</h2>
            
            {!accessToken ? (
                // Tampilan saat BELUM Terhubung
                <div style={{
                    ...styles.container, 
                    backgroundColor: '#fff0e8', 
                    // Mengganti borderColor dengan property individual yang sudah ada di styles.container
                    borderColor: '#e95420'
                }}>
                    <p style={{ color: '#e95420', fontWeight: 'bold' }}>
                        ⚠️ Belum Terhubung!
                    </p>
                    {/* Tombol yang mengarah ke endpoint otorisasi Strava di backend Go */}
                    <a href={`${BACKEND_URL}/api/auth/strava`}>
                        <button style={styles.connectButton}>
                            Hubungkan ke Strava
                        </button>
                    </a>
                </div>
            ) : (
                // Tampilan saat SUDAH Terhubung
                <div style={styles.container}>
                    <p style={styles.statusMessage}>
                        ✅ Strava Terhubung!
                    </p>
                    
                    <p style={{marginBottom: '15px'}}>
                        Anda dapat memuat data aktivitas yang sudah tersimpan di lokal atau menyinkronkan data terbaru dari Strava.
                    </p>

                    <div style={styles.buttonArea}>
                        {/* Tombol Tampilkan Data Lokal */}
                        <button 
                            onClick={handleLoadLocal} 
                            disabled={loading} 
                            style={{...styles.loadButton, opacity: loading ? 0.6 : 1}}
                        >
                            {loading ? 'Memuat Data Lokal...' : 'Tampilkan Data Lokal Tersimpan'}
                        </button>

                        {/* Tombol Refresh Data (Sync) */}
                        <button 
                            onClick={handleRefresh} 
                            disabled={loading} 
                            style={{...styles.refreshButton, opacity: loading ? 0.6 : 1}}
                        >
                            {loading ? 'Me-refresh...' : 'Refresh Data dari Strava (Sync)'}
                        </button>
                    </div>
                    
                    <p style={{ marginTop: '25px', color: '#666', fontSize: '0.9em' }}>
                        Setelah sinkronisasi, data statistik akan tersedia di halaman **Distance Stats** dan **Pace Stats**.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Home;
