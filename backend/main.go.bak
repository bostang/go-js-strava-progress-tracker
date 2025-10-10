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
	// Pastikan redirectURI sesuai dengan yang didaftarkan di Strava App
	redirectURI = "http://localhost:8080/strava-callback"
	// Sesuaikan dengan URL frontend Anda
	frontendURL = "http://localhost:5173"
	scope       = "read,activity:read_all"
)

const dataFilePath = "data/strava_activities.json"

// StravaTokenResponse merepresentasikan struktur respons token dari Strava.
type StravaTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
}

// MinimalActivityData digunakan untuk deserialisasi data lokal untuk keperluan statistik.
// Menggunakan float64 untuk moving_time karena dapat dikirim sebagai int atau float di JSON,
// namun tipe ini lebih aman untuk perhitungan.
type MinimalActivityData struct {
	StartDate  string  `json:"start_date"`
	Distance   float64 `json:"distance"`    // meter
	MovingTime float64 `json:"moving_time"` // detik
	Type       string  `json:"type"`
}

// MonthlySportStats digunakan untuk menyimpan ringkasan statistik jarak per bulan dan per tipe olahraga.
type MonthlySportStats struct {
	MonthYear   string  `json:"month_year"` // Format: YYYY-MM
	RunWalkHike float64 `json:"run_walk_hike"`
	Bike        float64 `json:"bike"`
	Other       float64 `json:"other"`
}

// MonthlyPaceStats menyimpan ringkasan pace rata-rata bulanan.
type MonthlyPaceStats struct {
	MonthYear string `json:"month_year"` // Format: YYYY-MM

	// Data Akumulasi Waktu & Jarak per Kategori (digunakan untuk perhitungan)
	RunWalkHikeTime     float64 `json:"-"` // Time in seconds
	RunWalkHikeDistance float64 `json:"-"` // Distance in meters
	BikeTime            float64 `json:"-"`
	BikeDistance        float64 `json:"-"`
	OtherTime           float64 `json:"-"`
	OtherDistance       float64 `json:"-"`

	// Pace Rata-rata yang akan dikirim ke Frontend (detik/meter)
	// Kita akan menggunakan satuan yang lebih ramah pengguna di frontend (misalnya menit/km)
	// Namun di backend kita hitung sebagai detik/meter.
	RunWalkHikePace float64 `json:"run_walk_hike_pace"` // detik/meter
	BikePace        float64 `json:"bike_pace"`          // detik/meter
	OtherPace       float64 `json:"other_pace"`         // detik/meter
}

func main() {
	// 1. Muat variabel lingkungan dari file .env
	err := godotenv.Load()
	if err != nil {
		// Log peringatan jika .env tidak ditemukan, tapi lanjutkan karena mungkin menggunakan ENV sistem.
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

	// Gunakan gin.ReleaseMode jika tidak dalam development untuk mengurangi log verbosity
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// --- Konfigurasi CORS (PENTING) ---
	router.Use(func(c *gin.Context) {
		// Izinkan frontend Anda
		c.Writer.Header().Set("Access-Control-Allow-Origin", frontendURL)
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true") // Diperlukan jika menggunakan cookie/session

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

	fmt.Printf("Server Go berjalan di http://localhost:%s\n", port)
	router.Run(":" + port)
}

// --------------------------------------
// HANDLER FUNCTIONS
// --------------------------------------

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

	c.JSON(http.StatusOK, gin.H{
		"status":      "Backend is running 🟢",
		"data_file":   dataFilePath,
		"file_status": fileStatus,
	})
}

// handleStravaLogin mengarahkan pengguna ke halaman otorisasi Strava.
func handleStravaLogin(c *gin.Context) {
	authURL := fmt.Sprintf(
		"http://www.strava.com/oauth/authorize?client_id=%s&response_type=code&redirect_uri=%s&scope=%s",
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

	// PENTING: Untuk aplikasi produksi, token ini harus disimpan di database server-side,
	// TIDAK dikirim langsung ke frontend melalui URL! Ini adalah DEMO.
	fmt.Println("Token berhasil didapatkan. Mengarahkan ke frontend.")
	c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("%s/?token=%s&expires_at=%d", frontendURL, tokenResponse.AccessToken, tokenResponse.ExpiresAt))
}

// handleGetActivities: Logika Caching (Prioritas Baca Lokal)
func handleGetActivities(c *gin.Context) {
	// Peringatan Keamanan: Mengirim token melalui query parameter adalah tidak aman untuk produksi.
	// Gunakan header Authorization, cookie, atau session management.
	accessToken := c.Query("token")
	shouldRefresh := c.Query("refresh") == "true"

	// 1. Cek file lokal dan kondisi refresh
	_, err := os.Stat(dataFilePath)
	fileExist := err == nil

	if fileExist && !shouldRefresh {
		fmt.Println("Membaca data dari file lokal:", dataFilePath)
		fileContent, err := os.ReadFile(dataFilePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca file lokal", "details": err.Error()})
			return
		}

		// Karena kita tidak tahu struktur JSON Strava secara lengkap, kita pakai []interface{}
		var localActivities []map[string]interface{}
		if err := json.Unmarshal(fileContent, &localActivities); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengurai file JSON lokal", "details": err.Error()})
			// Jika file rusak, coba refresh dari Strava
			fmt.Println("File JSON lokal rusak. Mencoba mengambil data baru...")
		} else {
			c.JSON(http.StatusOK, localActivities)
			return
		}
	}

	// 2. Ambil data baru jika file tidak ada/rusak ATAU refresh diminta
	if accessToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Access token diperlukan untuk mengambil data Strava baru. Silakan login ulang."})
		return
	}

	if shouldRefresh {
		fmt.Println("Memaksa refresh. Mengambil semua data baru dari Strava...")
	} else {
		fmt.Println("File lokal tidak ditemukan atau rusak. Mengambil data dari Strava...")
	}

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

// handleGetDistanceStats: Mengembalikan ringkasan statistik jarak bulanan
func handleGetDistanceStats(c *gin.Context) {
	stats, err := calculateMonthlyDistanceStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghitung statistik jarak", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// handleGetPaceStats: Mengembalikan ringkasan statistik pace bulanan
func handleGetPaceStats(c *gin.Context) {
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

	fmt.Printf("Sinkronisasi selesai. Total %d aktivitas disimpan ke %s\n", len(allActivities), dataFilePath)
	return nil
}

// classifyActivity mengelompokkan tipe olahraga ke dalam kategori yang ditentukan.
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

// readLocalActivities membaca data aktivitas lokal dan menguraikannya menjadi slice of MinimalActivityData.
func readLocalActivities() ([]MinimalActivityData, error) {
	fileContent, err := os.ReadFile(dataFilePath)
	if err != nil {
		// Periksa apakah error karena file tidak ditemukan.
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("file data lokal '%s' tidak ditemukan. Silakan sinkronisasi data dari Strava terlebih dahulu", dataFilePath)
		}
		return nil, fmt.Errorf("gagal membaca file data lokal: %w", err)
	}

	// Karena data lokal disimpan sebagai []map[string]interface{}, kita perlu menguraikannya
	// dan mengkonversinya ke MinimalActivityData untuk perhitungan yang aman.
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

// getFloat adalah helper untuk menangani angka yang mungkin berupa float64 atau int di JSON.
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

// calculateMonthlyDistanceStats menghitung statistik jarak bulanan berdasarkan tipe olahraga.
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

// calculateMonthlyPaceStats menghitung pace rata-rata bulanan per kategori.
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
