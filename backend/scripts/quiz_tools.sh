#!/bin/bash
# Quiz Answer Validation Tools
# 
# This script provides convenient access to quiz validation tools

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$BACKEND_DIR"

case "$1" in
  check)
    echo "Checking database for quiz attempts with missing answers..."
    python3 scripts/check_quiz_missing_answers.py
    ;;
  test)
    echo "Running quiz answer validation tests..."
    python3 scripts/test_quiz_answer_validation.py
    ;;
  *)
    echo "Quiz Answer Validation Tools"
    echo ""
    echo "Usage: $0 {check|test}"
    echo ""
    echo "Commands:"
    echo "  check    - Check database for quiz attempts with missing answers"
    echo "  test     - Run quiz answer validation tests"
    echo ""
    echo "Examples:"
    echo "  $0 check    # Check database"
    echo "  $0 test     # Run tests"
    exit 1
    ;;
esac
