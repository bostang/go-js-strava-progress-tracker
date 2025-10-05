// backend/main.go
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

// Global constants and variables
var (
	clientID     string
	clientSecret string
	redirectURI  = "http://localhost:8080/strava-callback"
	frontendURL  = "http://localhost:5173"
	scope        = "read,activity:read_all"
)

const dataFilePath = "data/strava_activities.json"

// StravaTokenResponse merepresentasikan struktur respons dari Strava saat menukar kode otorisasi.
type StravaTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
}

// MonthlyStats digunakan untuk menyimpan ringkasan statistik
type MonthlyStats struct {
	MonthYear     string  `json:"month_year"`     // Format: YYYY-MM
	TotalDistance float64 `json:"total_distance"` // Dalam meter
	ActivityCount int     `json:"activity_count"`
}

// MonthlySportStats digunakan untuk menyimpan ringkasan statistik per bulan dan per tipe olahraga.
type MonthlySportStats struct {
	MonthYear   string  `json:"month_year"` // Format: YYYY-MM
	RunWalkHike float64 `json:"run_walk_hike"`
	Bike        float64 `json:"bike"`
	Other       float64 `json:"other"`
}

// MonthlyPaceStats menyimpan ringkasan pace rata-rata bulanan.
type MonthlyPaceStats struct {
	MonthYear string `json:"month_year"` // Format: YYYY-MM

	// Data Akumulasi Waktu & Jarak per Kategori
	RunWalkHikeTime     int     `json:"run_walk_hike_time"`
	RunWalkHikeDistance float64 `json:"run_walk_hike_distance"`
	BikeTime            int     `json:"bike_time"`
	BikeDistance        float64 `json:"bike_distance"`
	OtherTime           int     `json:"other_time"`
	OtherDistance       float64 `json:"other_distance"`

	// Pace Rata-rata yang akan dikirim ke Frontend (detik/meter)
	RunWalkHikePace float64 `json:"run_walk_hike_pace"`
	BikePace        float64 `json:"bike_pace"`
	OtherPace       float64 `json:"other_pace"`
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
		port = "8080" // Default jika .env tidak ada
	}

	if clientID == "" || clientSecret == "" {
		fmt.Println("Error: STRAVA_CLIENT_ID atau STRAVA_CLIENT_SECRET tidak ditemukan. Pastikan .env sudah benar.")
		os.Exit(1)
	}

	router := gin.Default()

	// --- Konfigurasi CORS (PENTING) ---
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", frontendURL)
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
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
	router.GET("/api/activities", handleGetActivities) // Logika Caching & Ambil data Strava
	router.GET("/api/stats", handleGetStats)
	router.GET("/api/pace-stats", handleGetPaceStats)

	fmt.Printf("Server Go berjalan di http://localhost:%s\n", port)
	router.Run(":" + port)
}

// --------------------------------------
// HANDLER FUNCTIONS
// --------------------------------------

func handleGetPaceStats(c *gin.Context) {
	stats, err := calculateMonthlyPaceStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghitung statistik pace", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// classifyActivity mengelompokkan tipe olahraga ke dalam kategori yang ditentukan.
func classifyActivity(activityType string) string {
	switch activityType {
	case "Run", "Walk", "Hike":
		return "RunWalkHike"
	case "Ride", "VirtualRide":
		return "Bike"
	default:
		// Mencakup Soccer dan tipe lain yang kurang umum
		return "Other"
	}
}

// calculateMonthlyDistanceStats membaca data aktivitas lokal dan menghitung statistik jarak bulanan berdasarkan tipe olahraga.
func calculateMonthlyDistanceStats() ([]MonthlySportStats, error) {
	fileContent, err := os.ReadFile(dataFilePath)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca file data lokal: %w", err)
	}

	var activities []map[string]interface{}
	if err := json.Unmarshal(fileContent, &activities); err != nil {
		return nil, fmt.Errorf("gagal mengurai file JSON: %w", err)
	}

	// Gunakan map untuk mengelompokkan statistik berdasarkan bulan (YYYY-MM)
	statsMap := make(map[string]MonthlySportStats)

	for _, activity := range activities {
		startDateStr, ok1 := activity["start_date"].(string)
		distance, ok2 := activity["distance"].(float64)
		activityType, ok3 := activity["type"].(string)

		if !ok1 || !ok2 || !ok3 {
			continue
		}

		// Klasifikasi
		category := classifyActivity(activityType)

		// Parse tanggal
		t, err := time.Parse(time.RFC3339, startDateStr)
		if err != nil {
			continue
		}
		monthYear := t.Format("2006-01") // Format YYYY-MM

		// Lakukan perhitungan
		stat, exists := statsMap[monthYear]
		if !exists {
			stat.MonthYear = monthYear
		}

		// Tambahkan jarak (distance) ke kategori yang sesuai
		switch category {
		case "RunWalkHike":
			stat.RunWalkHike += distance
		case "Bike":
			stat.Bike += distance
		case "Other":
			stat.Other += distance
		}

		statsMap[monthYear] = stat
	}

	// Konversi map menjadi slice untuk dikirim ke frontend
	var monthlyStats []MonthlySportStats
	for _, stat := range statsMap {
		monthlyStats = append(monthlyStats, stat)
	}

	// (Opsional) Sorting, tetapi kita serahkan ke frontend untuk fleksibilitas
	return monthlyStats, nil
}

func handleStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "Backend is running 🟢"})
}

func handleStravaLogin(c *gin.Context) {
	authURL := fmt.Sprintf(
		"http://www.strava.com/oauth/authorize?client_id=%s&response_type=code&redirect_uri=%s&scope=%s",
		clientID,
		redirectURI,
		scope,
	)
	c.Redirect(http.StatusFound, authURL)
}

func handleStravaCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		if c.Query("error") != "" {
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

	resp, err := http.PostForm("https://www.strava.com/oauth/token", data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to request token from Strava"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Strava token exchange failed", "status": resp.Status})
		return
	}

	var tokenResponse StravaTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode token response"})
		return
	}

	// Redirect kembali ke frontend dengan Access Token (untuk demo)
	c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("%s/?token=%s&expires_at=%d", frontendURL, tokenResponse.AccessToken, tokenResponse.ExpiresAt))
}

// fetchAndSaveAllActivities mengambil semua aktivitas dari Strava dan menyimpannya ke file JSON.
// Menggunakan []map[string]interface{} untuk menyimpan SEMUA field yang dikirim Strava.
func fetchAndSaveAllActivities(accessToken string) error {
	// Gunakan map[string]interface{} untuk menyimpan SEMUA field
	var allActivities []map[string]interface{}
	page := 1
	perPage := 100 // Gunakan maksimal per_page (max 200)

	for {
		activitiesURL := fmt.Sprintf(
			"https://www.strava.com/api/v3/athlete/activities?per_page=%d&page=%d",
			perPage,
			page,
		)

		client := &http.Client{Timeout: 30 * time.Second}
		req, err := http.NewRequest("GET", activitiesURL, nil)
		if err != nil {
			return fmt.Errorf("gagal membuat request: %w", err)
		}
		req.Header.Add("Authorization", "Bearer "+accessToken)

		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("gagal mengambil aktivitas dari Strava: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("API Strava error: %s - Body: %s", resp.Status, bodyBytes)
		}

		// Decode respons ke []map[string]interface{} untuk fleksibilitas
		var currentActivities []map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&currentActivities); err != nil {
			return fmt.Errorf("gagal mengurai respons Strava: %w", err)
		}

		allActivities = append(allActivities, currentActivities...)

		// Cek kondisi berhenti
		if len(currentActivities) < perPage {
			break
		}
		page++
	}

	// Buat folder data jika belum ada
	if err := os.MkdirAll(filepath.Dir(dataFilePath), 0755); err != nil {
		return fmt.Errorf("gagal membuat direktori data: %w", err)
	}

	// Tulis semua aktivitas ke file JSON
	file, err := os.Create(dataFilePath)
	if err != nil {
		return fmt.Errorf("gagal membuat file data: %w", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ") // Agar file JSON mudah dibaca
	if err := encoder.Encode(allActivities); err != nil {
		return fmt.Errorf("gagal menulis ke file JSON: %w", err)
	}

	return nil
}

// handleGetActivities: Logika Caching (Prioritas Baca Lokal)

// handleGetActivities: Mengambil data, ưu tiên dari lokal. Dapat dipaksa refresh.
func handleGetActivities(c *gin.Context) {
	// Cek apakah pengguna meminta refresh data (http://localhost:8080/api/activities?refresh=true)
	shouldRefresh := c.Query("refresh") == "true"

	// 1. Cek apakah ada file lokal DAN pengguna TIDAK meminta refresh
	if _, err := os.Stat(dataFilePath); err == nil && !shouldRefresh {
		fmt.Println("Membaca data dari file lokal:", dataFilePath)
		fileContent, err := os.ReadFile(dataFilePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca file lokal", "details": err.Error()})
			return
		}

		var localActivities []map[string]interface{}
		if err := json.Unmarshal(fileContent, &localActivities); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengurai file JSON lokal", "details": err.Error()})
			return
		}
		c.JSON(http.StatusOK, localActivities)
		return
	}

	// --- Jika file tidak ada ATAU refresh diminta ---

	// 2. Ambil Access Token. Token ini hanya diperlukan saat refresh/pengambilan pertama.
	accessToken := c.Query("token")
	if accessToken == "" {
		// Jika file tidak ada DAN token tidak ada, kita tidak bisa mengambil data baru
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Access token diperlukan untuk refresh/pengambilan data baru."})
		return
	}

	// 3. Ambil dan Simpan semua aktivitas dari Strava (memaksa penulisan ulang file)
	if shouldRefresh {
		fmt.Println("Memaksa refresh. Mengambil semua data baru dari Strava...")
	} else {
		fmt.Println("File lokal tidak ditemukan. Mengambil data dari Strava...")
	}

	if err := fetchAndSaveAllActivities(accessToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil dan menyimpan aktivitas", "details": err.Error()})
		return
	}

	// 4. Baca ulang data yang baru disimpan dan kirimkan ke frontend
	fileContent, _ := os.ReadFile(dataFilePath)
	var savedActivities []map[string]interface{}
	json.Unmarshal(fileContent, &savedActivities)

	c.JSON(http.StatusOK, savedActivities)
}

// handleGetStats: Mengembalikan ringkasan statistik bulanan
func handleGetStats(c *gin.Context) {
	stats, err := calculateMonthlyDistanceStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghitung statistik", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// calculateMonthlyPaceStats menghitung pace rata-rata bulanan per kategori.
func calculateMonthlyPaceStats() ([]MonthlyPaceStats, error) {
	fileContent, err := os.ReadFile(dataFilePath)
	if err != nil {
		// Jika file tidak ada, tidak bisa dihitung. Ini kemungkinan penyebab Error 500.
		return nil, fmt.Errorf("gagal membaca file data lokal: %w. Pastikan Anda sudah sinkronisasi data dari Strava.", err)
	}

	var activities []map[string]interface{}
	if err := json.Unmarshal(fileContent, &activities); err != nil {
		return nil, fmt.Errorf("gagal mengurai file JSON: %w", err)
	}

	paceMap := make(map[string]MonthlyPaceStats)

	for _, activity := range activities {
		startDateStr, ok1 := activity["start_date"].(string)
		distance, ok2 := activity["distance"].(float64)
		movingTime, ok3 := activity["moving_time"].(float64)
		activityType, ok4 := activity["type"].(string)

		if !ok1 || !ok2 || !ok3 || !ok4 {
			continue
		}

		// Klasifikasi Aktivitas
		category := classifyActivity(activityType)

		t, err := time.Parse(time.RFC3339, startDateStr)
		if err != nil {
			continue
		}
		monthYear := t.Format("2006-01")

		stat, exists := paceMap[monthYear]
		if !exists {
			stat.MonthYear = monthYear
		}

		// Akumulasi total waktu dan jarak berdasarkan kategori
		// Konversi movingTime dari float64 ke int
		timeInt := int(movingTime)

		switch category {
		case "RunWalkHike":
			stat.RunWalkHikeDistance += distance
			stat.RunWalkHikeTime += timeInt
		case "Bike":
			stat.BikeDistance += distance
			stat.BikeTime += timeInt
		case "Other":
			stat.OtherDistance += distance
			stat.OtherTime += timeInt
		}

		paceMap[monthYear] = stat
	}

	var monthlyPaceStats []MonthlyPaceStats
	for _, stat := range paceMap {
		// Hitung Pace Rata-rata (detik per meter) untuk setiap kategori

		// Run/Walk/Hike Pace
		if stat.RunWalkHikeDistance > 0 {
			stat.RunWalkHikePace = float64(stat.RunWalkHikeTime) / stat.RunWalkHikeDistance
		}

		// Bike Pace
		if stat.BikeDistance > 0 {
			stat.BikePace = float64(stat.BikeTime) / stat.BikeDistance
		}

		// Other Pace
		if stat.OtherDistance > 0 {
			stat.OtherPace = float64(stat.OtherTime) / stat.OtherDistance
		}

		monthlyPaceStats = append(monthlyPaceStats, stat)
	}

	return monthlyPaceStats, nil
}
