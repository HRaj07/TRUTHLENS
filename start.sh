#!/usr/bin/env bash
# ============================================================
#  TruthLens — Network Ready Launcher
#  Usage:  chmod +x start.sh && ./start.sh
# ============================================================
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"
MY_IP="10.12.118.6"

# ── Colours ────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[TruthLens]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
err()   { echo -e "${RED}[✗]${NC} $*"; }

# ── 1. Fix WebSocket Dependencies ──────────────────────────
info "Fixing WebSocket dependencies (bypassing macOS temp bug)…"
# We create a local tmp for pip to avoid the FileNotFoundError
mkdir -p "$ROOT/.pip_tmp"
export TMPDIR="$ROOT/.pip_tmp"
python3 -m pip install --no-cache-dir websockets uvicorn uvicorn[standard] > /dev/null 2>&1
ok "Backend libraries ready"

# ── 2. Node deps ───────────────────────────────────────────
if [ ! -d "$FRONTEND/node_modules" ]; then
  info "Installing frontend dependencies…"
  (cd "$FRONTEND" && npm install --legacy-peer-deps)
fi

# ── 3. Launch backend ──────────────────────────────────────
info "Starting FastAPI on http://$MY_IP:8000 (Multi-device access enabled)"
(
  cd "$ROOT"
  python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload 2>&1 | sed 's/^/[backend] /'
) &
BACKEND_PID=$!

sleep 2

# ── 4. Launch frontend ─────────────────────────────────────
info "Starting React on http://$MY_IP:3000"
(
  cd "$FRONTEND"
  npm start 2>&1 | sed 's/^/[frontend] /'
) &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  TruthLens Multi-Device Mode Active!${NC}"
echo -e "${GREEN}  Interviewer: http://localhost:3000${NC}"
echo -e "${GREEN}  Candidate  : http://$MY_IP:3000${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

# ── 5. Wait and forward signals ────────────────────────────
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
