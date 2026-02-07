#!/bin/bash
# Test script for active course functionality

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
AUTH_TOKEN="${AUTH_TOKEN}"

if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Error: AUTH_TOKEN environment variable not set"
  echo "Usage: AUTH_TOKEN=your_jwt_token ./scripts/test_active_course.sh"
  exit 1
fi

echo "🔍 Testing Active Course API Endpoints"
echo "======================================="
echo ""

# Test 1: Get active course (should return null or a course_map_id)
echo "1️⃣  Testing GET /api/v1/profile/active-course"
response=$(curl -s -X GET "$API_BASE_URL/api/v1/profile/active-course" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json")
echo "Response: $response"
echo ""

# Extract course_map_id from response
course_map_id=$(echo "$response" | grep -o '"course_map_id":"[^"]*"' | cut -d'"' -f4 || echo "null")
echo "Current active course: $course_map_id"
echo ""

# Test 2: Set active course (if we have a course_map_id from user's courses)
if [ "$course_map_id" != "null" ] && [ -n "$course_map_id" ]; then
  echo "2️⃣  Testing PUT /api/v1/profile/active-course"
  set_response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X PUT "$API_BASE_URL/api/v1/profile/active-course" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"course_map_id\":\"$course_map_id\"}")
  
  http_status=$(echo "$set_response" | grep "HTTP_STATUS:" | cut -d: -f2)
  
  if [ "$http_status" = "204" ]; then
    echo "✅ Successfully set active course to: $course_map_id"
  else
    echo "❌ Failed to set active course. HTTP Status: $http_status"
    echo "Response: $set_response"
  fi
  echo ""
fi

# Test 3: Verify active course is returned correctly
echo "3️⃣  Verifying active course after set"
verify_response=$(curl -s -X GET "$API_BASE_URL/api/v1/profile/active-course" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json")
echo "Response: $verify_response"
echo ""

echo "✅ Active course API tests completed!"
