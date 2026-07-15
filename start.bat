@echo off
echo Starting Shift SaaS System...

echo.
echo [1/2] Starting API Server on port 4000...
start "API Server" cmd /c "cd /d %~dp0apps\api && set DATABASE_URL=postgresql://postgres:123321@localhost:5432/shift_saas && set JWT_SECRET=shift-saas-jwt-secret-key-2026-secure-32chars && set JWT_REFRESH_SECRET=shift-saas-refresh-secret-key-2026-secure && npm run dev"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Web Server on port 3000...
start "Web Server" cmd /c "cd /d %~dp0apps\web && npm run dev"

echo.
echo ============================================
echo  System Started!
echo  Web:  http://localhost:3000
echo  API:  http://localhost:4000
echo  Login: admin@shift.com / Admin@123456
echo ============================================
