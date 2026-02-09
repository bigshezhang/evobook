#!/bin/bash
# EvoBook 生产环境一键启动脚本
# 使用 screen 管理前后端进程，通过脚本统一指定端口
#
# 用法:
#   ./scripts/start.sh          启动所有服务
#   ./scripts/start.sh stop     停止所有服务
#   ./scripts/start.sh restart  重启所有服务
#   ./scripts/start.sh status   查看服务状态
#   ./scripts/start.sh logs     查看日志 (附加到 screen)

set -euo pipefail

# ============================================================
# 配置区域 — 只改这里即可
# ============================================================
BACKEND_PORT=8001
FRONTEND_PORT=3002
BACKEND_WORKERS=1

# ============================================================
# 路径 (自动推导，一般不用改)
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$(dirname "$BACKEND_DIR")/evobook"

SCREEN_BACKEND="evobook-be"
SCREEN_FRONTEND="evobook-fe"
DOCKER_PG_CONTAINER="evobook-postgres"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ============================================================
# 工具函数
# ============================================================
log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "${CYAN}[STEP]${NC}  $*"; }

require_cmd() {
    if ! command -v "$1" &>/dev/null; then
        log_error "Required command not found: $1"
        exit 1
    fi
}

check_port() {
    local port=$1
    local pid
    pid=$(ss -tlnp 2>/dev/null | grep ":${port} " | grep -oP 'pid=\K[0-9]+' | head -1)
    if [ -n "$pid" ]; then
        echo "$pid"
    fi
}

wait_for_service() {
    local url=$1
    local name=$2
    local max_wait=${3:-30}
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -sf "$url" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    log_error "$name failed to start within ${max_wait}s"
    return 1
}

# ============================================================
# 启动
# ============================================================
do_start() {
    log_info "${BOLD}EvoBook Production Startup${NC}"
    echo ""

    # 前置检查
    require_cmd screen
    require_cmd docker
    require_cmd node
    require_cmd npm

    # 确保 uv 在 PATH 中
    if ! command -v uv &>/dev/null; then
        source /root/.local/bin/env 2>/dev/null || true
    fi
    require_cmd uv

    # 检查 .env
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        log_error "Backend .env not found: $BACKEND_DIR/.env"
        exit 1
    fi
    if [ ! -f "$FRONTEND_DIR/.env" ]; then
        log_error "Frontend .env not found: $FRONTEND_DIR/.env"
        exit 1
    fi

    # 如果已有 screen session 或端口被占用，先清理
    if screen -ls 2>/dev/null | grep -qE "(${SCREEN_BACKEND}|${SCREEN_FRONTEND})"; then
        log_warn "Detected existing EvoBook sessions, stopping first..."
        do_stop
        sleep 1
    fi

    # 1. 确保 PostgreSQL 容器运行
    log_step "Checking PostgreSQL container..."
    if docker ps --format '{{.Names}}' | grep -q "^${DOCKER_PG_CONTAINER}$"; then
        log_info "PostgreSQL container is running"
    elif docker ps -a --format '{{.Names}}' | grep -q "^${DOCKER_PG_CONTAINER}$"; then
        log_warn "PostgreSQL container exists but stopped, starting..."
        docker start "$DOCKER_PG_CONTAINER"
        sleep 3
    else
        log_error "PostgreSQL container '$DOCKER_PG_CONTAINER' not found"
        log_error "Create it with:"
        echo "  docker run -d --name $DOCKER_PG_CONTAINER \\"
        echo "    -e POSTGRES_USER=postgres \\"
        echo "    -e POSTGRES_PASSWORD=remember1984 \\"
        echo "    -e POSTGRES_DB=evobook \\"
        echo "    -p 5432:5432 \\"
        echo "    --restart unless-stopped \\"
        echo "    postgres:16-alpine"
        exit 1
    fi

    local pg_ready=0
    for i in $(seq 1 10); do
        if docker exec "$DOCKER_PG_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
            pg_ready=1
            break
        fi
        sleep 1
    done
    if [ $pg_ready -eq 0 ]; then
        log_error "PostgreSQL is not ready after 10s"
        exit 1
    fi
    log_info "PostgreSQL is ready"

    # 2. 运行数据库迁移
    log_step "Running database migrations..."
    cd "$BACKEND_DIR"
    if .venv/bin/alembic upgrade head 2>&1 | tail -3; then
        log_info "Database migrations completed"
    else
        log_warn "Migration may have issues, check logs"
    fi

    # 2.1 Seed shop items (idempotent — skips existing items)
    log_step "Seeding shop items..."
    if .venv/bin/python3 scripts/seed_shop_items.py 2>&1 | tail -3; then
        log_info "Shop items seeding completed"
    else
        log_warn "Shop items seeding may have issues, check logs"
    fi
    echo ""

    # 3. 检查端口冲突
    local be_pid
    be_pid=$(check_port $BACKEND_PORT)
    if [ -n "$be_pid" ]; then
        log_error "Port $BACKEND_PORT is already in use by PID $be_pid"
        exit 1
    fi
    local fe_pid
    fe_pid=$(check_port $FRONTEND_PORT)
    if [ -n "$fe_pid" ]; then
        log_error "Port $FRONTEND_PORT is already in use by PID $fe_pid"
        exit 1
    fi

    # 4. 检查并安装前端依赖（必须在构建前完成）
    log_step "Checking frontend dependencies..."
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        log_warn "node_modules not found, installing dependencies..."
        (
            export PATH="/root/.nvm/versions/node/v22.15.0/bin:$PATH"
            cd "$FRONTEND_DIR"
            npm install
        )
        log_info "Dependencies installed"
    elif [ "$FRONTEND_DIR/package.json" -nt "$FRONTEND_DIR/node_modules" ]; then
        log_warn "package.json changed, updating dependencies..."
        (
            export PATH="/root/.nvm/versions/node/v22.15.0/bin:$PATH"
            cd "$FRONTEND_DIR"
            npm install
        )
        log_info "Dependencies updated"
    else
        log_info "Dependencies up to date"
    fi

    # 5. 并行启动：后端 + 前端构建
    log_step "Starting services in parallel..."
    
    # 5.1 启动后端（后台）
    log_info "Launching backend..."
    screen -dmS "$SCREEN_BACKEND" bash -c "
        cd $BACKEND_DIR
        exec .venv/bin/uvicorn app.main:app \
            --host 0.0.0.0 \
            --port $BACKEND_PORT \
            --workers $BACKEND_WORKERS \
            --log-level info \
            --access-log
    "

    # 5.2 构建前端（并行，始终全量构建）
    log_info "Building frontend (in parallel)..."
    (
        export PATH="/root/.nvm/versions/node/v22.15.0/bin:$PATH"
        export BACKEND_URL="http://localhost:${BACKEND_PORT}"
        cd "$FRONTEND_DIR"
        npx vite build 2>&1 | tail -5
    ) &
    BUILD_PID=$!

    # 5.3 等待构建完成
    wait $BUILD_PID
    log_info "Frontend build completed"

    # 6. 启动前端服务
    log_info "Launching frontend..."
    screen -dmS "$SCREEN_FRONTEND" bash -c "
        export PATH=\"/root/.nvm/versions/node/v22.15.0/bin:\$PATH\"
        export BACKEND_URL=\"http://localhost:${BACKEND_PORT}\"
        cd $FRONTEND_DIR
        exec npx vite preview --host 0.0.0.0 --port $FRONTEND_PORT
    "

    # 7. 并行等待服务就绪
    log_step "Waiting for services to be ready..."
    
    # 并行等待
    wait_for_service "http://localhost:${BACKEND_PORT}/healthz" "Backend" 30 &
    BE_WAIT_PID=$!
    wait_for_service "http://localhost:${FRONTEND_PORT}/" "Frontend" 15 &
    FE_WAIT_PID=$!

    # 等待两个服务都就绪
    local be_ok=0
    local fe_ok=0
    
    if wait $BE_WAIT_PID; then
        be_ok=1
        log_info "Backend is running on port $BACKEND_PORT"
    else
        log_error "Backend failed to start. Check: screen -r $SCREEN_BACKEND"
    fi

    if wait $FE_WAIT_PID; then
        fe_ok=1
        log_info "Frontend is running on port $FRONTEND_PORT"
    else
        log_error "Frontend failed to start. Check: screen -r $SCREEN_FRONTEND"
    fi

    if [ $be_ok -eq 0 ] || [ $fe_ok -eq 0 ]; then
        exit 1
    fi

    # 8. 打印摘要
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}${BOLD}  EvoBook is running!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  Frontend:  ${CYAN}http://localhost:${FRONTEND_PORT}${NC}"
    echo -e "  Backend:   ${CYAN}http://localhost:${BACKEND_PORT}${NC}"
    echo -e "  API Docs:  ${CYAN}http://localhost:${BACKEND_PORT}/docs${NC}"
    echo -e "  Health:    ${CYAN}http://localhost:${BACKEND_PORT}/healthz${NC}"
    echo ""
    echo -e "  ${BOLD}Screen sessions:${NC}"
    echo -e "    Backend:  ${YELLOW}screen -r $SCREEN_BACKEND${NC}"
    echo -e "    Frontend: ${YELLOW}screen -r $SCREEN_FRONTEND${NC}"
    echo ""
    echo -e "  ${BOLD}Management:${NC}"
    echo -e "    Stop:     ${YELLOW}$0 stop${NC}"
    echo -e "    Restart:  ${YELLOW}$0 restart${NC}"
    echo -e "    Status:   ${YELLOW}$0 status${NC}"
    echo -e "${GREEN}========================================${NC}"
}

# ============================================================
# 停止
# ============================================================
do_stop() {
    log_info "${BOLD}Stopping EvoBook services...${NC}"

    local stopped=0

    if screen -ls 2>/dev/null | grep -q "$SCREEN_BACKEND"; then
        screen -S "$SCREEN_BACKEND" -X quit 2>/dev/null || true
        log_info "Backend screen session '$SCREEN_BACKEND' stopped"
        stopped=$((stopped + 1))
    else
        log_warn "Backend screen session '$SCREEN_BACKEND' not found"
    fi

    if screen -ls 2>/dev/null | grep -q "$SCREEN_FRONTEND"; then
        screen -S "$SCREEN_FRONTEND" -X quit 2>/dev/null || true
        log_info "Frontend screen session '$SCREEN_FRONTEND' stopped"
        stopped=$((stopped + 1))
    else
        log_warn "Frontend screen session '$SCREEN_FRONTEND' not found"
    fi

    sleep 2

    # 确认端口释放，残留进程强杀
    local be_pid
    be_pid=$(check_port $BACKEND_PORT)
    if [ -n "$be_pid" ]; then
        log_warn "Port $BACKEND_PORT still in use (PID $be_pid), killing..."
        kill "$be_pid" 2>/dev/null || true
        sleep 1
        kill -9 "$be_pid" 2>/dev/null || true
    fi

    local fe_pid
    fe_pid=$(check_port $FRONTEND_PORT)
    if [ -n "$fe_pid" ]; then
        log_warn "Port $FRONTEND_PORT still in use (PID $fe_pid), killing..."
        kill "$fe_pid" 2>/dev/null || true
        sleep 1
        kill -9 "$fe_pid" 2>/dev/null || true
    fi

    if [ $stopped -gt 0 ]; then
        log_info "All EvoBook services stopped"
    else
        log_warn "No running services found"
    fi
}

# ============================================================
# 状态
# ============================================================
do_status() {
    echo -e "${BOLD}EvoBook Service Status${NC}"
    echo ""

    echo -n "  PostgreSQL:  "
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DOCKER_PG_CONTAINER}$"; then
        echo -e "${GREEN}running${NC}"
    else
        echo -e "${RED}stopped${NC}"
    fi

    echo -n "  Backend:     "
    if screen -ls 2>/dev/null | grep -q "$SCREEN_BACKEND"; then
        if curl -sf "http://localhost:${BACKEND_PORT}/healthz" >/dev/null 2>&1; then
            echo -e "${GREEN}running${NC} (port $BACKEND_PORT)"
        else
            echo -e "${YELLOW}screen active, but not responding${NC}"
        fi
    else
        echo -e "${RED}stopped${NC}"
    fi

    echo -n "  Frontend:    "
    if screen -ls 2>/dev/null | grep -q "$SCREEN_FRONTEND"; then
        if curl -sf "http://localhost:${FRONTEND_PORT}/" >/dev/null 2>&1; then
            echo -e "${GREEN}running${NC} (port $FRONTEND_PORT)"
        else
            echo -e "${YELLOW}screen active, but not responding${NC}"
        fi
    else
        echo -e "${RED}stopped${NC}"
    fi

    echo ""
    echo -e "  ${BOLD}Screen sessions:${NC}"
    screen -ls 2>/dev/null | grep -E "(evobook)" || echo "    (none)"
    echo ""
}

# ============================================================
# 日志
# ============================================================
do_logs() {
    echo -e "${BOLD}Available screen sessions:${NC}"
    echo -e "  1) Backend:  ${YELLOW}screen -r $SCREEN_BACKEND${NC}"
    echo -e "  2) Frontend: ${YELLOW}screen -r $SCREEN_FRONTEND${NC}"
    echo ""
    echo -e "Tip: Press ${CYAN}Ctrl+A, D${NC} to detach from screen"
    echo ""

    read -rp "Attach to which session? [1/2]: " choice
    case "$choice" in
        1) screen -r "$SCREEN_BACKEND" ;;
        2) screen -r "$SCREEN_FRONTEND" ;;
        *) echo "Invalid choice" ;;
    esac
}

# ============================================================
# 主入口
# ============================================================
ACTION="${1:-start}"

case "$ACTION" in
    start)   do_start ;;
    stop)    do_stop ;;
    restart) do_stop; sleep 2; do_start ;;
    status)  do_status ;;
    logs)    do_logs ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
