#!/bin/bash
# Test script for content generation recovery

set -e

BASE_URL="${BASE_URL:-http://localhost:8000}"
API_URL="${BASE_URL}/api/v1"

echo "=========================================="
echo "Testing Content Generation Recovery"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${YELLOW}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Create a course map
print_step "Step 1: Creating a course map..."
RESPONSE=$(curl -s -X POST "${API_URL}/course-map/generate" \
    -H "Content-Type: application/json" \
    -d '{
        "topic": "Python Async Programming",
        "level": "Intermediate",
        "focus": "Building async web applications",
        "verified_concept": "Basic understanding of async/await",
        "mode": "Fast",
        "total_commitment_minutes": 60
    }')

COURSE_MAP_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['course_map_id'])" 2>/dev/null || echo "")

if [ -z "$COURSE_MAP_ID" ]; then
    print_error "Failed to create course map"
    echo "$RESPONSE"
    exit 1
fi

print_success "Course map created: $COURSE_MAP_ID"
echo ""

# Step 2: Wait a bit for generation to start
print_step "Step 2: Waiting 5 seconds for generation to start..."
sleep 5
print_success "Wait completed"
echo ""

# Step 3: Check generation progress (should be generating or pending)
print_step "Step 3: Checking generation progress..."
PROGRESS=$(curl -s -X GET "${API_URL}/course-map/${COURSE_MAP_ID}/progress")
echo "$PROGRESS" | python3 -m json.tool

OVERALL_STATUS=$(echo "$PROGRESS" | python3 -c "import sys, json; print(json.load(sys.stdin)['overall_status'])" 2>/dev/null || echo "")
print_success "Current status: $OVERALL_STATUS"
echo ""

# Step 4: Simulate server restart by calling manual recovery endpoint
print_step "Step 4: Simulating server restart by calling manual recovery..."
echo "In production, this would be triggered automatically on startup."
echo "Calling manual recovery endpoint..."

RECOVERY_RESPONSE=$(curl -s -X POST "${API_URL}/course-map/admin/recover-tasks")
echo "$RECOVERY_RESPONSE" | python3 -m json.tool

COURSES_FOUND=$(echo "$RECOVERY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['stats']['courses_found'])" 2>/dev/null || echo "0")
NODES_RESET=$(echo "$RECOVERY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['stats']['nodes_reset'])" 2>/dev/null || echo "0")
TASKS_RESTARTED=$(echo "$RECOVERY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['stats']['tasks_restarted'])" 2>/dev/null || echo "0")

print_success "Recovery stats:"
echo "  - Courses found: $COURSES_FOUND"
echo "  - Nodes reset: $NODES_RESET"
echo "  - Tasks restarted: $TASKS_RESTARTED"
echo ""

# Step 5: Wait for generation to complete
print_step "Step 5: Waiting for generation to complete (max 120 seconds)..."
MAX_WAIT=120
ELAPSED=0
POLL_INTERVAL=5

while [ $ELAPSED -lt $MAX_WAIT ]; do
    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
    
    PROGRESS=$(curl -s -X GET "${API_URL}/course-map/${COURSE_MAP_ID}/progress")
    OVERALL_STATUS=$(echo "$PROGRESS" | python3 -c "import sys, json; print(json.load(sys.stdin)['overall_status'])" 2>/dev/null || echo "unknown")
    LEARN_PROGRESS=$(echo "$PROGRESS" | python3 -c "import sys, json; print(json.load(sys.stdin)['learn_progress'])" 2>/dev/null || echo "0")
    
    echo "  [$ELAPSED s] Status: $OVERALL_STATUS, Progress: $(python3 -c "print(f'{float('$LEARN_PROGRESS') * 100:.1f}%')")"
    
    if [ "$OVERALL_STATUS" = "completed" ]; then
        print_success "Generation completed!"
        break
    fi
    
    if [ "$OVERALL_STATUS" = "partial_failed" ]; then
        print_error "Generation partially failed"
        break
    fi
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    print_error "Timeout waiting for generation to complete"
fi
echo ""

# Step 6: Final progress check
print_step "Step 6: Final progress check..."
PROGRESS=$(curl -s -X GET "${API_URL}/course-map/${COURSE_MAP_ID}/progress")
echo "$PROGRESS" | python3 -m json.tool
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Course Map ID: $COURSE_MAP_ID"
echo "Final Status: $OVERALL_STATUS"
echo "Recovery Stats:"
echo "  - Courses found: $COURSES_FOUND"
echo "  - Nodes reset: $NODES_RESET"
echo "  - Tasks restarted: $TASKS_RESTARTED"
echo ""
echo "✓ Test completed"
echo ""
echo "To test real recovery on startup:"
echo "  1. Create a course map"
echo "  2. Kill the server (Ctrl+C) while generation is in progress"
echo "  3. Restart the server"
echo "  4. Check logs for recovery messages"
echo "  5. Verify generation continues"
