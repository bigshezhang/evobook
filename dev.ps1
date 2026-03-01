# evobook 一键启动脚本
# 用法: powershell -ExecutionPolicy Bypass -File dev.ps1

$BACKEND_PORT = 8002
$FRONTEND_PORT = 3000
$ROOT = $PSScriptRoot

function Kill-Port($port) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pid in $pids) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "  [✓] 已杀死占用端口 $port 的进程 (PID $pid)" -ForegroundColor Green
        }
    } else {
        Write-Host "  [–] 端口 $port 无占用进程" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  evobook 开发环境启动" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# 清理端口
Write-Host "[1/3] 清理端口占用..." -ForegroundColor Yellow
Kill-Port $BACKEND_PORT
Kill-Port $FRONTEND_PORT
Start-Sleep -Milliseconds 500

# 启动后端
Write-Host ""
Write-Host "[2/3] 启动后端 (FastAPI :$BACKEND_PORT)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "cd '$ROOT\backend'; `
    Write-Host '--- 后端启动中 ---' -ForegroundColor Cyan; `
    uvicorn app.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT"
Start-Sleep -Seconds 2

# 启动前端
Write-Host "[3/3] 启动前端 (Vite :$FRONTEND_PORT)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "cd '$ROOT\frontend'; `
    Write-Host '--- 前端启动中 ---' -ForegroundColor Cyan; `
    npm run dev"

Write-Host ""
Write-Host "==============================" -ForegroundColor Green
Write-Host "  启动完成！" -ForegroundColor Green
Write-Host "  后端: http://localhost:$BACKEND_PORT" -ForegroundColor Green
Write-Host "  前端: http://localhost:$FRONTEND_PORT
  (前端代理 /api → 后端 :$BACKEND_PORT)" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host ""
