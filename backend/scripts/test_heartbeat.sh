#!/bin/bash
# 测试心跳包功能

# 设置颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== EvoBook Heartbeat API Test ===${NC}\n"

# 检查环境变量
if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}错误: 请设置 AUTH_TOKEN 环境变量${NC}"
  echo "示例: export AUTH_TOKEN='your_jwt_token'"
  exit 1
fi

if [ -z "$COURSE_MAP_ID" ]; then
  echo -e "${RED}错误: 请设置 COURSE_MAP_ID 环境变量${NC}"
  echo "示例: export COURSE_MAP_ID='your_course_id'"
  exit 1
fi

NODE_ID=${NODE_ID:-1}
API_BASE_URL=${API_BASE_URL:-"http://localhost:8000"}

echo -e "${GREEN}配置:${NC}"
echo "API Base URL: $API_BASE_URL"
echo "Course Map ID: $COURSE_MAP_ID"
echo "Node ID: $NODE_ID"
echo ""

# 1. 发送心跳
echo -e "${YELLOW}1. 发送心跳包...${NC}"
HEARTBEAT_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/learning/heartbeat" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"course_map_id\": \"$COURSE_MAP_ID\",
    \"node_id\": $NODE_ID,
    \"client_timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }")

echo "$HEARTBEAT_RESPONSE" | python3 -m json.tool
echo ""

# 提取 total_study_seconds
TOTAL_SECONDS=$(echo "$HEARTBEAT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('total_study_seconds', 0))" 2>/dev/null)

if [ ! -z "$TOTAL_SECONDS" ] && [ "$TOTAL_SECONDS" -gt 0 ]; then
  echo -e "${GREEN}✓ 心跳发送成功，当前总学习时长: ${TOTAL_SECONDS} 秒${NC}"
else
  echo -e "${RED}✗ 心跳发送失败或返回数据异常${NC}"
fi

echo ""

# 2. 获取统计数据
echo -e "${YELLOW}2. 获取用户统计数据...${NC}"
STATS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/v1/profile/stats" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "$STATS_RESPONSE" | python3 -m json.tool
echo ""

# 提取关键统计数据
STUDY_HOURS=$(echo "$STATS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('total_study_hours', 0))" 2>/dev/null)
COMPLETED_COURSES=$(echo "$STATS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('completed_courses_count', 0))" 2>/dev/null)
GLOBAL_RANK=$(echo "$STATS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('global_rank', 'N/A'))" 2>/dev/null)

if [ ! -z "$STUDY_HOURS" ]; then
  echo -e "${GREEN}✓ 统计数据获取成功${NC}"
  echo "  - 总学习时长: $STUDY_HOURS 小时"
  echo "  - 已完成课程数: $COMPLETED_COURSES"
  echo "  - 全局排名: $GLOBAL_RANK"
else
  echo -e "${RED}✗ 统计数据获取失败${NC}"
fi

echo ""
echo -e "${YELLOW}=== 测试完成 ===${NC}"
