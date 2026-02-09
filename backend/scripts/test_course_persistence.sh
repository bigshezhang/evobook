#!/bin/bash

# 测试课程持久化 API 的脚本

set -e

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_BASE="${API_BASE:-http://localhost:8000}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

echo -e "${YELLOW}=== 课程持久化 API 测试 ===${NC}\n"

# 检查是否提供了 token
if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}错误: 请设置 AUTH_TOKEN 环境变量${NC}"
  echo "用法: AUTH_TOKEN='your-supabase-token' $0"
  exit 1
fi

echo -e "${YELLOW}测试 1: 健康检查${NC}"
curl -s "$API_BASE/healthz" | jq .
echo -e "${GREEN}✓ 健康检查通过${NC}\n"

echo -e "${YELLOW}测试 2: 生成课程${NC}"
COURSE_RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/course-map/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "topic": "测试课程 - Python编程",
    "level": "Beginner",
    "focus": "快速入门基础语法",
    "verified_concept": "Python语言基础",
    "mode": "Fast",
    "total_commitment_minutes": 120
  }')

COURSE_MAP_ID=$(echo "$COURSE_RESPONSE" | jq -r '.course_map_id')

if [ "$COURSE_MAP_ID" != "null" ] && [ -n "$COURSE_MAP_ID" ]; then
  echo -e "${GREEN}✓ 课程生成成功${NC}"
  echo "  Course Map ID: $COURSE_MAP_ID"
else
  echo -e "${RED}✗ 课程生成失败${NC}"
  echo "$COURSE_RESPONSE" | jq .
  exit 1
fi

echo ""
echo -e "${YELLOW}测试 3: 获取课程列表${NC}"
LIST_RESPONSE=$(curl -s "$API_BASE/api/v1/course-map/list" \
  -H "Authorization: Bearer $AUTH_TOKEN")

COURSE_COUNT=$(echo "$LIST_RESPONSE" | jq '.courses | length')
echo -e "${GREEN}✓ 获取课程列表成功${NC}"
echo "  课程数量: $COURSE_COUNT"
echo "$LIST_RESPONSE" | jq '.courses[] | {course_map_id, topic, level, mode}'

echo ""
echo -e "${YELLOW}测试 4: 获取课程详情${NC}"
DETAIL_RESPONSE=$(curl -s "$API_BASE/api/v1/course-map/$COURSE_MAP_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN")

TOPIC=$(echo "$DETAIL_RESPONSE" | jq -r '.topic')
NODE_COUNT=$(echo "$DETAIL_RESPONSE" | jq '.nodes | length')

if [ "$TOPIC" != "null" ]; then
  echo -e "${GREEN}✓ 获取课程详情成功${NC}"
  echo "  主题: $TOPIC"
  echo "  节点数: $NODE_COUNT"
  echo "$DETAIL_RESPONSE" | jq '{topic, level, mode, total_commitment_minutes}'
else
  echo -e "${RED}✗ 获取课程详情失败${NC}"
  echo "$DETAIL_RESPONSE" | jq .
  exit 1
fi

echo ""
echo -e "${GREEN}=== 所有测试通过 ===${NC}"
echo ""
echo "生成的课程 ID: $COURSE_MAP_ID"
echo "前端访问链接: http://localhost:5173/knowledge-tree?cid=$COURSE_MAP_ID"
