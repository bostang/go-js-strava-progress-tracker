package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

// Global constants and variables
var (
	clientID     string
	clientSecret string
	// Pastikan redirectURI sesuai dengan yang didaftarkan di Strava App
	redirectURI = "http://localhost:8080/strava-callback"
	// Sesuaikan dengan URL frontend Anda
	frontendURL = "http://localhost:5173"
	scope       = "read,activity:read_all"
)

const (
	dataFilePath   = "data/strava_activities.json"
	tokenFilePath  = "data/strava_token.json" // File baru untuk menyimpan token
	dataDir        = "data"
	tokenTTLMargin = 60 * time.Second // Margin 60 detik sebelum token benar-benar kedaluwarsa
)

// --- Token Management Structures ---

// TokenData menyimpan token dan status kedaluwarsa untuk persistensi lokal.
type TokenData struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"` // Unix timestamp
}

type PaceStat struct {
	// Field Go        // JSON Tag
	Red    float64 `json:"🔴 Merah (Maks/Interval)"`
	Orange float64 `json:"🟠 Oranye (Tempo/Threshold)"`
	Yellow float64 `json:"🟡 Kuning (Steady/Aerobic)"`
	Green  float64 `json:"🟢 Hijau (Easy/Recovery)"`
}

// WeeklyPaceData: Struktur baru untuk menampung data harian
// Kunci: Tanggal (string YYYY-MM-DD), Nilai: PaceStat untuk hari itu
type WeeklyPaceData map[string]PaceStat

// Global variable to hold the token data in memory and protect access
var (
	currentTokens TokenData
	tokenMutex    sync.Mutex // Untuk mencegah race condition saat mengakses token
)

// StravaTokenResponse merepresentasikan struktur respons token dari Strava (digunakan saat pertukaran kode/refresh).
type StravaTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"` // Unix timestamp
}

// MinimalActivityData (struktur yang sama)
type MinimalActivityData struct {
	StartDate  string  `json:"start_date"`
	Distance   float64 `json:"distance"`    // meter
	MovingTime float64 `json:"moving_time"` // detik
	Type       string  `json:"type"`
}

// MonthlySportStats (struktur yang sama)
type MonthlySportStats struct {
	MonthYear   string  `json:"month_year"` // Format: YYYY-MM
	RunWalkHike float64 `json:"run_walk_hike"`
	Bike        float64 `json:"bike"`
	Other       float64 `json:"other"`
}

type StravaActivity struct {
	ID             int64   `json:"id"`
	Name           string  `json:"name"`
	Distance       float64 `json:"distance"`     // meter
	MovingTime     float64 `json:"moving_time"`  // detik
	ElapsedTime    float64 `json:"elapsed_time"` // detik
	Type           string  `json:"type"`
	StartDate      string  `json:"start_date"`       // UTC time (RFC3339)
	StartDateLocal string  `json:"start_date_local"` // Local time (RFC3339)
	// Tambahkan field lain yang mungkin Anda gunakan
}

// MonthlyPaceStats (struktur yang sama)
type MonthlyPaceStats struct {
	MonthYear string `json:"month_year"` // Format: YYYY-MM

	// Data Akumulasi Waktu & Jarak per Kategori (digunakan untuk perhitungan)
	RunWalkHikeTime     float64 `json:"-"`
	RunWalkHikeDistance float64 `json:"-"`
	BikeTime            float64 `json:"-"`
	BikeDistance        float64 `json:"-"`
	OtherTime           float64 `json:"-"`
	OtherDistance       float64 `json:"-"`

	// Pace Rata-rata yang akan dikirim ke Frontend (detik/meter)
	RunWalkHikePace float64 `json:"run_walk_hike_pace"` // detik/meter
	BikePace        float64 `json:"bike_pace"`          // detik/meter
	OtherPace       float64 `json:"other_pace"`         // detik/meter
}

func main() {
	// 1. Muat variabel lingkungan dari file .env
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Peringatan: Tidak dapat memuat file .env. Menggunakan Environment Variables Sistem.")
	}

	// Ambil nilai dari environment variables
	clientID = os.Getenv("STRAVA_CLIENT_ID")
	clientSecret = os.Getenv("STRAVA_CLIENT_SECRET")
	port := os.Getenv("BACKEND_PORT")
	if port == "" {
		port = "8080" // Default port
	}

	if clientID == "" || clientSecret == "" {
		fmt.Println("Error: STRAVA_CLIENT_ID atau STRAVA_CLIENT_SECRET tidak ditemukan. Pastikan .env sudah benar.")
		os.Exit(1)
	}

	// 2. Muat token yang tersimpan saat startup
	loadToken()

	// Gunakan gin.ReleaseMode jika tidak dalam development untuk mengurangi log verbosity
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// --- Konfigurasi CORS (PENTING) ---
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", frontendURL)
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}
		c.Next()
	})
	// ------------------------------------

	// Endpoint API
	router.GET("/api/status", handleStatus)
	router.GET("/api/auth/strava", handleStravaLogin)
	router.GET("/strava-callback", handleStravaCallback)

	// Endpoint untuk data: Mengambil data aktivitas dari Strava (dengan caching lokal)
	router.GET("/api/activities", handleGetActivities)

	// Endpoint untuk statistik: Menghitung dari data lokal
	router.GET("/api/stats", handleGetDistanceStats)
	router.GET("/api/pace-stats", handleGetPaceStats)

	router.GET("/api/weekly-pace-stats", handleGetWeeklyPaceStats)

	fmt.Printf("Server Go berjalan di http://localhost:%s\n", port)
	router.Run(":" + port)
}

// --------------------------------------
// TOKEN MANAGEMENT FUNCTIONS
// --------------------------------------

// loadToken memuat token dari file lokal ke memori.
func loadToken() {
	tokenMutex.Lock()
	defer tokenMutex.Unlock()

	data, err := os.ReadFile(tokenFilePath)
	if err != nil {
		if !os.IsNotExist(err) {
			fmt.Printf("Peringatan: Gagal membaca file token: %v\n", err)
		} else {
			fmt.Println("Peringatan: File token tidak ditemukan. Pengguna perlu login Strava.")
		}
		return
	}

	if err := json.Unmarshal(data, &currentTokens); err != nil {
		fmt.Printf("Peringatan: Gagal mengurai file token: %v\n", err)
		return
	}

	fmt.Printf("Token berhasil dimuat. Token kedaluwarsa pada: %s\n", time.Unix(currentTokens.ExpiresAt, 0).Format(time.RFC822))
}

// saveToken menyimpan token dari memori ke file lokal.
func saveToken(t TokenData) error {
	tokenMutex.Lock()
	defer tokenMutex.Unlock()

	// Perbarui token global di memori
	currentTokens = t

	// Buat folder data jika belum ada
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return fmt.Errorf("gagal membuat direktori data: %w", err)
	}

	data, err := json.MarshalIndent(t, "", " ")
	if err != nil {
		return fmt.Errorf("gagal marshal token: %w", err)
	}

	if err := os.WriteFile(tokenFilePath, data, 0644); err != nil {
		return fmt.Errorf("gagal menulis file token: %w", err)
	}
	fmt.Printf("Token baru berhasil disimpan. Kedaluwarsa pada: %s\n", time.Unix(t.ExpiresAt, 0).Format(time.RFC822))
	return nil
}

// refreshAccessToken menukar refresh token lama dengan access token baru.
func refreshAccessToken() error {
	tokenMutex.Lock()
	defer tokenMutex.Unlock()

	if currentTokens.RefreshToken == "" {
		return fmt.Errorf("tidak ada refresh token yang tersimpan. Pengguna harus login ulang")
	}

	fmt.Printf("Token lama kedaluwarsa. Mencoba refresh token...\n")

	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", currentTokens.RefreshToken)

	resp, err := http.PostForm("https://www.strava.com/oauth/token", data)
	if err != nil {
		return fmt.Errorf("gagal request refresh token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("gagal refresh token. Status: %s, Body: %s", resp.Status, bodyBytes)
	}

	var newTokens StravaTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&newTokens); err != nil {
		return fmt.Errorf("gagal mengurai respons refresh token: %w", err)
	}

	// Update token di memori dan file
	currentTokens.AccessToken = newTokens.AccessToken
	currentTokens.ExpiresAt = newTokens.ExpiresAt
	if newTokens.RefreshToken != "" {
		// Strava terkadang mengeluarkan refresh token baru, terkadang tidak.
		currentTokens.RefreshToken = newTokens.RefreshToken
	}

	// Simpan token baru
	if err := saveToken(currentTokens); err != nil {
		return fmt.Errorf("gagal menyimpan token yang di-refresh: %w", err)
	}

	fmt.Println("Refresh token berhasil! Access token baru telah disimpan.")
	return nil
}

// ensureValidToken memeriksa kedaluwarsa token dan melakukan refresh jika diperlukan.
func ensureValidToken() (string, error) {
	tokenMutex.Lock()
	defer tokenMutex.Unlock()

	if currentTokens.AccessToken == "" {
		return "", fmt.Errorf("access token tidak ada. Silakan login melalui /api/auth/strava")
	}

	// Cek apakah token akan kedaluwarsa dalam waktu dekat
	expiryTime := time.Unix(currentTokens.ExpiresAt, 0)
	if time.Now().Add(tokenTTLMargin).After(expiryTime) {
		// Token sudah kedaluwarsa atau mendekati kedaluwarsa, lepaskan lock dan refresh.
		// Catatan: refreshAccessToken akan mengakuisisi lock-nya sendiri.
		tokenMutex.Unlock()
		defer tokenMutex.Lock()
		if err := refreshAccessToken(); err != nil {
			return "", err
		}
	}

	return currentTokens.AccessToken, nil
}

// --------------------------------------
// HANDLER FUNCTIONS
// --------------------------------------

// fetchActivitiesFromStrava mengambil data dari cache lokal (data/strava_activities.json)
// dan memfilternya berdasarkan rentang tanggal yang diminta (inklusif).
// Parameter:
// - accessToken: Tidak digunakan karena membaca dari cache lokal.
// - startDate, endDate: Rentang waktu (inklusif), harus berupa UTC 00:00:00.
func fetchActivitiesFromStrava(accessToken string, startDate, endDate time.Time) ([]MinimalActivityData, error) {
	// Abaikan accessToken karena kita menggunakan cache lokal untuk performa.

	// 1. Baca semua aktivitas dari cache lokal
	allActivities, err := readLocalActivities()
	if err != nil {
		// Langsung kembalikan error jika gagal membaca/mengurai file cache
		return nil, fmt.Errorf("gagal membaca data aktivitas lokal: %w", err)
	}

	var filteredActivities []MinimalActivityData

	// Untuk mencakup seluruh hari terakhir (endDate), kita cari aktivitas
	// yang dimulai SEBELUM awal hari berikutnya.
	nextDayStart := endDate.AddDate(0, 0, 1) // Ini adalah 00:00:00Z di hari Senin minggu berikutnya

	for _, activity := range allActivities {
		// Parse tanggal mulai aktivitas yang tersimpan dalam format RFC3339 (yang selalu UTC)
		t, err := time.Parse(time.RFC3339, activity.StartDate)
		if err != nil {
			fmt.Printf("Peringatan: Gagal mengurai tanggal aktivitas '%s'. Aktivitas dilewati.\n", activity.StartDate)
			continue
		}

		// Filter: activity time harus >= startDate (inklusi Senin 00:00:00Z)
		// DAN activity time < nextDayStart (inklusi Minggu 23:59:59Z)
		isAfterOrEqualStart := t.Equal(startDate) || t.After(startDate)
		isBeforeNextDay := t.Before(nextDayStart)

		if isAfterOrEqualStart && isBeforeNextDay {
			filteredActivities = append(filteredActivities, activity)
		}
	}

	return filteredActivities, nil
}

func handleStatus(c *gin.Context) {
	// Cek status file data
	_, err := os.Stat(dataFilePath)
	fileStatus := "Not Found"
	if err == nil {
		fileStatus = "OK"
	} else if os.IsNotExist(err) {
		fileStatus = "Missing"
	} else {
		fileStatus = fmt.Sprintf("Error: %s", err.Error())
	}

	tokenMutex.Lock()
	isTokenValid := currentTokens.AccessToken != "" && time.Now().Before(time.Unix(currentTokens.ExpiresAt, 0).Add(-tokenTTLMargin))
	expiryInfo := "N/A"
	if currentTokens.ExpiresAt > 0 {
		expiryInfo = time.Unix(currentTokens.ExpiresAt, 0).Format(time.RFC822)
	}
	tokenMutex.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"status":        "Backend is running 🟢",
		"data_file":     dataFilePath,
		"file_status":   fileStatus,
		"token_status":  isTokenValid,
		"token_expires": expiryInfo,
		"refresh_token": currentTokens.RefreshToken != "", // Hanya untuk debug, cek apakah refresh token ada
	})
}

// handleStravaLogin mengarahkan pengguna ke halaman otorisasi Strava.
func handleStravaLogin(c *gin.Context) {
	authURL := fmt.Sprintf(
		"http://www.strava.com/oauth/authorize?client_id=%s&response_type=code&redirect_uri=%s&scope=%s&approval_prompt=force", // approval_prompt=force agar dapat refresh token baru
		clientID,
		redirectURI,
		scope,
	)
	c.Redirect(http.StatusFound, authURL)
}

// handleStravaCallback menangani respons dari Strava dan menukar kode otorisasi dengan token.
func handleStravaCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		if c.Query("error") != "" {
			// Pengguna menolak otorisasi
			c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/?auth_status=denied")
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code not found"})
		return
	}

	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("code", code)
	data.Set("grant_type", "authorization_code")

	// Lakukan penukaran token
	resp, err := http.PostForm("https://www.strava.com/oauth/token", data)
	if err != nil {
		fmt.Printf("Error postForm Strava: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to request token from Strava"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		fmt.Printf("Strava token exchange failed. Status: %s, Body: %s\n", resp.Status, bodyBytes)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Strava token exchange failed", "status": resp.Status, "response": string(bodyBytes)})
		return
	}

	var tokenResponse StravaTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
		fmt.Printf("Error decoding token response: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode token response"})
		return
	}

	// --- FIX: Simpan SEMUA data token (termasuk refresh token) ke file lokal ---
	if err := saveToken(TokenData(tokenResponse)); err != nil {
		fmt.Printf("Error saving token: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save token locally"})
		return
	}

	// Alihkan ke frontend. Token kini dikelola di backend.
	fmt.Println("Token berhasil didapatkan dan disimpan. Mengarahkan ke frontend.")
	c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("%s/?auth_status=success", frontendURL))
}

// handleGetActivities: Logika Caching dan Refresh Token
func handleGetActivities(c *gin.Context) {
	// Pastikan token valid atau refresh token
	accessToken, err := ensureValidToken()
	if err != nil {
		fmt.Printf("Error during token check/refresh: %v\n", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid atau gagal di-refresh. Silakan login ulang via /api/auth/strava", "details": err.Error()})
		return
	}

	shouldRefresh := c.Query("refresh") == "true"

	// 1. Cek file lokal dan kondisi refresh
	_, err = os.Stat(dataFilePath)
	fileExist := err == nil

	if fileExist && !shouldRefresh {
		// Logika membaca file lokal yang sama
		fmt.Println("Membaca data dari file lokal:", dataFilePath)
		fileContent, err := os.ReadFile(dataFilePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca file lokal", "details": err.Error()})
			return
		}

		var localActivities []map[string]interface{}
		if err := json.Unmarshal(fileContent, &localActivities); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengurai file JSON lokal", "details": err.Error()})
			fmt.Println("File JSON lokal rusak. Mencoba mengambil data baru...")
		} else {
			c.JSON(http.StatusOK, localActivities)
			return
		}
	}

	// 2. Ambil data baru jika file tidak ada/rusak ATAU refresh diminta
	if shouldRefresh {
		fmt.Println("Memaksa refresh. Mengambil semua data baru dari Strava...")
	} else {
		fmt.Println("File lokal tidak ditemukan atau rusak. Mengambil data dari Strava...")
	}

	// Gunakan accessToken yang sudah dipastikan valid/baru dari ensureValidToken
	if err := fetchAndSaveAllActivities(accessToken); err != nil {
		fmt.Printf("Error fetchAndSaveAllActivities: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil dan menyimpan aktivitas dari Strava", "details": err.Error()})
		return
	}

	// 3. Baca ulang data yang baru disimpan dan kirimkan ke frontend
	fileContent, err := os.ReadFile(dataFilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca file setelah sinkronisasi.", "details": err.Error()})
		return
	}
	var savedActivities []map[string]interface{}
	json.Unmarshal(fileContent, &savedActivities)

	c.JSON(http.StatusOK, savedActivities)
}

// main.go (Tambahkan atau pastikan fungsi ini ada)
func loadLocalActivities() []StravaActivity {
	// Pastikan path ke file lokal sudah benar
	data, err := os.ReadFile("data/strava_activities.json")
	if err != nil {
		log.Println("Error reading data file:", err)
		return nil
	}

	var activities []StravaActivity // Menggunakan StravaActivity
	if err := json.Unmarshal(data, &activities); err != nil {
		log.Println("Error unmarshaling activities:", err)
		return nil
	}
	return activities
}

func calculatePaceStats(activity StravaActivity) PaceStat {
	var stats PaceStat

	// Hanya proses aktivitas lari/run
	if activity.Type != "Run" {
		return stats // Mengembalikan PaceStat kosong
	}

	// Jarak (meter)
	distanceM := activity.Distance
	// Waktu bergerak (detik)
	movingTimeS := activity.MovingTime

	if distanceM <= 0 || movingTimeS <= 0 {
		return stats
	}

	// Kecepatan rata-rata (meter/detik)
	avgSpeedMPS := distanceM / movingTimeS

	// Zona pace ilustratif (sesuai dengan frontend)
	paceZone := getPaceZone(avgSpeedMPS)

	// Konversi jarak total ke KM
	distanceKM := distanceM / 1000.0

	// Distribusikan Jarak total ke zona yang ditentukan
	switch paceZone {
	case "🔴 Merah (Maks/Interval)":
		stats.Red = distanceKM
	case "🟠 Oranye (Tempo/Threshold)":
		stats.Orange = distanceKM
	case "🟡 Kuning (Steady/Aerobic)":
		stats.Yellow = distanceKM
	case "🟢 Hijau (Easy/Recovery)":
		stats.Green = distanceKM
	}

	return stats
}

// PaceStat digunakan untuk mengembalikan data agregasi statistik
// CATATAN: Struktur ini tidak lagi digunakan, tetapi dipertahankan agar kode kompilasi
// type PaceStat struct {
// 	PaceDistances map[string]float64 `json:"paceDistances"`
// }

// getPaceZone mengelompokkan kecepatan rata-rata (m/s) ke dalam zona warna
func getPaceZone(speed float64) string {
	// Pace zones ilustratif berdasarkan kecepatan (m/s)
	// Kecepatan dihitung dari distance/elapsed_time
	// Semakin tinggi m/s, semakin cepat lari
	if speed >= 4.8 {
		return "🔴 Merah (Maks/Interval)" // Pace < 3:28 /km
	} else if speed >= 3.8 {
		return "🟠 Oranye (Tempo/Threshold)" // Pace 3:28 - 4:23 /km
	} else if speed >= 3.0 {
		return "🟡 Kuning (Steady/Aerobic)" // Pace 4:23 - 5:33 /km
	} else {
		return "🟢 Hijau (Easy/Recovery)" // Pace > 5:33 /km
	}
}

// handleGetWeeklyPaceStats: Mengambil aktivitas dalam rentang tanggal dan mengagregasi jarak per zona tempo
func handleGetWeeklyPaceStats(c *gin.Context) {
	// Gunakan UTC (atau zona waktu yang konsisten)
	loc := time.UTC

	// 1. Ambil query params startDate dan endDate
	startQuery := c.Query("startDate")
	endQuery := c.Query("endDate")

	var startDate, endDate time.Time
	var err error

	if startQuery != "" && endQuery != "" {
		// ... (Logika parsing tanggal dari query params)
		startDate, err = time.ParseInLocation("2006-01-02", startQuery, loc)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid startDate format. Use YYYY-MM-DD."})
			return
		}
		endDate, err = time.ParseInLocation("2006-01-02", endQuery, loc)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid endDate format. Use YYYY-MM-DD."})
			return
		}
	} else {
		// Hitung default minggu ini: Senin-Minggu.
		now := time.Now().In(loc)

		offset := int(time.Monday - now.Weekday())
		if offset > 0 {
			offset = -6
		}

		startDate = now.AddDate(0, 0, offset).Truncate(24 * time.Hour)
		endDate = startDate.AddDate(0, 0, 6).Truncate(24 * time.Hour)
	}

	// 2. Muat aktivitas
	activities := loadLocalActivities() // Sekarang dikenali

	// 3. Inisialisasi map data harian (WeeklyPaceData)
	weeklyData := make(WeeklyPaceData)

	// Inisialisasi semua hari dalam rentang (Senin-Minggu) ke nol
	current := startDate
	for current.Before(endDate.AddDate(0, 0, 1)) {
		dateStr := current.Format("2006-01-02")
		weeklyData[dateStr] = PaceStat{} // Inisialisasi PaceStat kosong
		current = current.AddDate(0, 0, 1)
	}

	// 4. Iterasi dan hitung aktivitas harian
	for _, activity := range activities {
		activityTime, err := time.Parse(time.RFC3339, activity.StartDateLocal)
		if err != nil {
			continue
		}

		activityDate := activityTime.In(loc).Truncate(24 * time.Hour)

		// Cek apakah aktivitas berada dalam rentang [startDate, endDate]
		if (activityDate.Equal(startDate) || activityDate.After(startDate)) &&
			(activityDate.Equal(endDate) || activityDate.Before(endDate.AddDate(0, 0, 1))) {

			dateStr := activityDate.Format("2006-01-02")

			paceStats := calculatePaceStats(activity) // Sekarang dikenali

			// Tambahkan ke total harian yang sudah ada di map (FIELD BERHURUF KAPITAL)
			currentDayStats := weeklyData[dateStr]
			currentDayStats.Red += paceStats.Red
			currentDayStats.Orange += paceStats.Orange
			currentDayStats.Yellow += paceStats.Yellow
			currentDayStats.Green += paceStats.Green
			weeklyData[dateStr] = currentDayStats
		}
	}

	// 5. Kirim map data harian (WeeklyPaceData) sebagai respons JSON
	c.JSON(http.StatusOK, weeklyData)
}

// handleGetDistanceStats: Mengembalikan ringkasan statistik jarak bulanan (Sama)
func handleGetDistanceStats(c *gin.Context) {
	// Periksa token sebelum mencoba membaca data lokal (data lokal dihasilkan dari Strava)
	if _, err := ensureValidToken(); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid, tidak dapat memproses data lokal. Silakan sinkronisasi ulang.", "details": err.Error()})
		return
	}

	stats, err := calculateMonthlyDistanceStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghitung statistik jarak", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// handleGetPaceStats: Mengembalikan ringkasan statistik pace bulanan (Sama)
func handleGetPaceStats(c *gin.Context) {
	// Periksa token sebelum mencoba membaca data lokal
	if _, err := ensureValidToken(); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid, tidak dapat memproses data lokal. Silakan sinkronisasi ulang.", "details": err.Error()})
		return
	}

	stats, err := calculateMonthlyPaceStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghitung statistik pace", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// --------------------------------------
// LOGIC FUNCTIONS
// --------------------------------------

// fetchAndSaveAllActivities mengambil semua aktivitas dari Strava dan menyimpannya ke file JSON.
// Menggunakan access token yang sudah dipastikan valid.
func fetchAndSaveAllActivities(accessToken string) error {
	var allActivities []map[string]interface{}
	page := 1
	perPage := 200 // Maksimal per_page untuk efisiensi

	for {
		activitiesURL := fmt.Sprintf(
			"https://www.strava.com/api/v3/athlete/activities?per_page=%d&page=%d",
			perPage,
			page,
		)

		client := &http.Client{Timeout: 60 * time.Second} // Tambahkan timeout yang lebih lama
		req, err := http.NewRequest("GET", activitiesURL, nil)
		if err != nil {
			return fmt.Errorf("gagal membuat request: %w", err)
		}
		// Gunakan access token yang valid
		req.Header.Add("Authorization", "Bearer "+accessToken)

		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("gagal mengambil aktivitas dari Strava (Timeout/Network Error): %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("API Strava error: %s - Body: %s", resp.Status, bodyBytes)
		}

		var currentActivities []map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&currentActivities); err != nil {
			return fmt.Errorf("gagal mengurai respons Strava: %w", err)
		}

		allActivities = append(allActivities, currentActivities...)

		// Log kemajuan
		fmt.Printf("Fetched page %d, activities count: %d\n", page, len(currentActivities))

		// Cek kondisi berhenti: jika kurang dari perPage, berarti ini adalah halaman terakhir
		if len(currentActivities) < perPage {
			break
		}
		page++
	}

	// Buat folder data jika belum ada
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return fmt.Errorf("gagal membuat direktori data: %w", err)
	}

	// Tulis semua aktivitas ke file JSON
	file, err := os.Create(dataFilePath)
	if err != nil {
		return fmt.Errorf("gagal membuat file data: %w", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", " ") // Agar file JSON mudah dibaca
	if err := encoder.Encode(allActivities); err != nil {
		return fmt.Errorf("gagal menulis ke file JSON: %w", err)
	}

	fmt.Printf("Sinkronisasi selesai. Total %d aktivitas disimpan ke %s\n", len(allActivities), dataFilePath)
	return nil
}

// classifyActivity (Sama)
func classifyActivity(activityType string) string {
	switch activityType {
	case "Run", "Walk", "Hike", "TrailRun":
		return "RunWalkHike"
	case "Ride", "VirtualRide", "Handcycle":
		return "Bike"
	default:
		// Mencakup Swim, Yoga, AlpineSki, dll.
		return "Other"
	}
}

// readLocalActivities (Sama)
func readLocalActivities() ([]MinimalActivityData, error) {
	fileContent, err := os.ReadFile(dataFilePath)
	if err != nil {
		// Periksa apakah error karena file tidak ditemukan.
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("file data lokal '%s' tidak ditemukan. Silakan sinkronisasi data dari Strava terlebih dahulu", dataFilePath)
		}
		return nil, fmt.Errorf("gagal membaca file data lokal: %w", err)
	}

	var rawActivities []map[string]interface{}
	if err := json.Unmarshal(fileContent, &rawActivities); err != nil {
		return nil, fmt.Errorf("gagal mengurai file JSON: %w", err)
	}

	var minimalActivities []MinimalActivityData
	for _, activity := range rawActivities {
		// Menggunakan type assertion yang lebih aman untuk menangani int/float
		distance, _ := getFloat(activity["distance"])
		movingTime, _ := getFloat(activity["moving_time"])
		startDate, ok1 := activity["start_date"].(string)
		activityType, ok2 := activity["type"].(string)

		if ok1 && ok2 && distance > 0 && movingTime > 0 {
			minimalActivities = append(minimalActivities, MinimalActivityData{
				StartDate:  startDate,
				Distance:   distance,
				MovingTime: movingTime,
				Type:       activityType,
			})
		}
	}

	if len(minimalActivities) == 0 {
		return nil, fmt.Errorf("tidak ada aktivitas valid yang ditemukan dalam file lokal")
	}

	return minimalActivities, nil
}

// getFloat (Sama)
func getFloat(v interface{}) (float64, bool) {
	switch f := v.(type) {
	case float64:
		return f, true
	case int:
		return float64(f), true
	case int64:
		return float64(f), true
	default:
		return 0, false
	}
}

// calculateMonthlyDistanceStats (Sama)
func calculateMonthlyDistanceStats() ([]MonthlySportStats, error) {
	activities, err := readLocalActivities()
	if err != nil {
		return nil, err
	}

	statsMap := make(map[string]MonthlySportStats)

	for _, activity := range activities {
		// Parse tanggal
		t, err := time.Parse(time.RFC3339, activity.StartDate)
		if err != nil {
			continue // Lewati jika gagal parse tanggal
		}
		monthYear := t.Format("2006-01") // Format YYYY-MM

		// Klasifikasi
		category := classifyActivity(activity.Type)

		stat, exists := statsMap[monthYear]
		if !exists {
			stat.MonthYear = monthYear
		}

		// Tambahkan jarak (distance) ke kategori yang sesuai
		switch category {
		case "RunWalkHike":
			stat.RunWalkHike += activity.Distance
		case "Bike":
			stat.Bike += activity.Distance
		case "Other":
			stat.Other += activity.Distance
		}

		statsMap[monthYear] = stat
	}

	// Konversi map menjadi slice
	var monthlyStats []MonthlySportStats
	for _, stat := range statsMap {
		monthlyStats = append(monthlyStats, stat)
	}

	return monthlyStats, nil
}

// calculateMonthlyPaceStats (Sama)
func calculateMonthlyPaceStats() ([]MonthlyPaceStats, error) {
	activities, err := readLocalActivities()
	if err != nil {
		return nil, err
	}

	paceMap := make(map[string]MonthlyPaceStats)

	for _, activity := range activities {
		t, err := time.Parse(time.RFC3339, activity.StartDate)
		if err != nil {
			continue
		}
		monthYear := t.Format("2006-01")

		// Klasifikasi
		category := classifyActivity(activity.Type)

		stat, exists := paceMap[monthYear]
		if !exists {
			stat.MonthYear = monthYear
		}

		// Akumulasi total waktu dan jarak berdasarkan kategori
		switch category {
		case "RunWalkHike":
			stat.RunWalkHikeDistance += activity.Distance
			stat.RunWalkHikeTime += activity.MovingTime
		case "Bike":
			stat.BikeDistance += activity.Distance
			stat.BikeTime += activity.MovingTime
		case "Other":
			stat.OtherDistance += activity.Distance
			stat.OtherTime += activity.MovingTime
		}

		paceMap[monthYear] = stat
	}

	var monthlyPaceStats []MonthlyPaceStats
	for _, stat := range paceMap {
		// Hitung Pace Rata-rata (detik per meter) untuk setiap kategori

		// Run/Walk/Hike Pace
		if stat.RunWalkHikeDistance > 0 {
			stat.RunWalkHikePace = stat.RunWalkHikeTime / stat.RunWalkHikeDistance
		}

		// Bike Pace
		if stat.BikeDistance > 0 {
			stat.BikePace = stat.BikeTime / stat.BikeDistance
		}

		// Other Pace
		if stat.OtherDistance > 0 {
			stat.OtherPace = stat.OtherTime / stat.OtherDistance
		}

		monthlyPaceStats = append(monthlyPaceStats, stat)
	}

	return monthlyPaceStats, nil
}
