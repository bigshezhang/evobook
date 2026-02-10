# restart.ps1 — 杀死所有前后端进程，然后重新启动
# 用法: .\restart.ps1

$ErrorActionPreference = "SilentlyContinue"

$ports = @(3000, 3001, 8001, 8002)

Write-Host "`n=== 停止所有前后端进程 ===" -ForegroundColor Yellow

foreach ($port in $ports) {
    $connections = netstat -ano | Select-String "TCP\s+\S+:$port\s.*LISTENING" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique

    foreach ($pid in $connections) {
        if ($pid -and $pid -ne "0") {
            $procName = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName
            Write-Host "  Kill port $port -> PID $pid ($procName)" -ForegroundColor Red
            taskkill /F /PID $pid 2>$null | Out-Null
        }
    }
}

# 额外清理: 杀死所有 node 和 uvicorn 相关进程
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Kill node process -> PID $($_.Id)" -ForegroundColor Red
    Stop-Process -Id $_.Id -Force
}
Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*uvicorn*"
} -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Kill uvicorn process -> PID $($_.Id)" -ForegroundColor Red
    Stop-Process -Id $_.Id -Force
}

Start-Sleep -Seconds 2

Write-Host "`n=== 启动后端 (port 8002) ===" -ForegroundColor Green
$backendJob = Start-Process -FilePath "python" `
    -ArgumentList "-m uvicorn app.main:app --reload --host 0.0.0.0 --port 8002" `
    -WorkingDirectory "$PSScriptRoot\backend" `
    -PassThru -NoNewWindow

Write-Host "  Backend PID: $($backendJob.Id)"

Start-Sleep -Seconds 3

Write-Host "`n=== 启动前端 (port 3000) ===" -ForegroundColor Green
$frontendJob = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c cd /d `"$PSScriptRoot\frontend`" && npm run dev" `
    -PassThru -NoNewWindow

Write-Host "  Frontend PID: $($frontendJob.Id)"

Start-Sleep -Seconds 2

Write-Host "`n=== 启动完成 ===" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000"
Write-Host "  Backend:  http://localhost:8002"
Write-Host "  按 Ctrl+C 停止所有进程`n"

# 等待任意子进程退出
try {
    Wait-Process -Id $backendJob.Id, $frontendJob.Id -ErrorAction Stop
} catch {
    # Ctrl+C 或进程退出
}
