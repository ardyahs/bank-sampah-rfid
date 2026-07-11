package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	ctxUserID        contextKey = "user_id"
	ctxRole          contextKey = "role"
	ctxRumahTanggaID contextKey = "rumah_tangga_id"
)

type Claims struct {
	UserID        string `json:"user_id"`
	Role          string `json:"role"`
	RumahTanggaID string `json:"rumah_tangga_id,omitempty"`
	jwt.RegisteredClaims
}

// GenerateToken membuat JWT untuk pengguna yang berhasil login.
func GenerateToken(secret, userID, role, rumahTanggaID string) (string, error) {
	claims := Claims{
		UserID:        userID,
		Role:          role,
		RumahTanggaID: rumahTanggaID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// Auth adalah middleware yang memvalidasi JWT dari header Authorization: Bearer <token>.
func Auth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" || !strings.HasPrefix(header, "Bearer ") {
				http.Error(w, `{"error":"token tidak ditemukan"}`, http.StatusUnauthorized)
				return
			}
			tokenStr := strings.TrimPrefix(header, "Bearer ")

			claims := &Claims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, `{"error":"token tidak valid"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ctxUserID, claims.UserID)
			ctx = context.WithValue(ctx, ctxRole, claims.Role)
			ctx = context.WithValue(ctx, ctxRumahTanggaID, claims.RumahTanggaID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole membatasi akses hanya untuk role tertentu (mis. "admin").
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool)
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, _ := r.Context().Value(ctxRole).(string)
			if !allowed[role] {
				http.Error(w, `{"error":"akses ditolak untuk role ini"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// DeviceKey memvalidasi header X-Device-Key untuk endpoint yang dipanggil ESP32
// (alat tidak melakukan login JWT biasa, cukup kunci statis per perangkat).
func DeviceKey(expectedKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("X-Device-Key")
			if key == "" || key != expectedKey {
				http.Error(w, `{"error":"device key tidak valid"}`, http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func UserIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(ctxUserID).(string)
	return v
}

func RoleFromContext(ctx context.Context) string {
	v, _ := ctx.Value(ctxRole).(string)
	return v
}

func RumahTanggaIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(ctxRumahTanggaID).(string)
	return v
}
