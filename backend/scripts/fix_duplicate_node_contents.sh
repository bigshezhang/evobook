#!/bin/bash
# 清理所有课程的重复 node_contents 记录
# 保留每个 (course_map_id, node_id, content_type, question_key) 组合中最新的一条记录

set -e

echo "=== 清理重复的 node_contents 记录 ==="

psql "postgresql://postgres:postgres@localhost:5432/evobook" <<'EOF'
-- 显示清理前的统计
SELECT
    '清理前' as stage,
    COUNT(*) as total_records,
    COUNT(DISTINCT (course_map_id, node_id, content_type, COALESCE(question_key, ''))) as unique_combinations,
    COUNT(*) - COUNT(DISTINCT (course_map_id, node_id, content_type, COALESCE(question_key, ''))) as duplicates
FROM node_contents;

-- 清理重复记录（保留最新的）
WITH ranked_contents AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY course_map_id, node_id, content_type, COALESCE(question_key, '')
      ORDER BY
        -- 优先保留有内容的记录
        CASE WHEN content_json IS NOT NULL AND content_json != '{}' THEN 0 ELSE 1 END,
        -- 然后按时间排序
        created_at DESC
    ) as rn
  FROM node_contents
)
DELETE FROM node_contents
WHERE id IN (
  SELECT id FROM ranked_contents WHERE rn > 1
);

-- 显示清理后的统计
SELECT
    '清理后' as stage,
    COUNT(*) as total_records,
    COUNT(DISTINCT (course_map_id, node_id, content_type, COALESCE(question_key, ''))) as unique_combinations,
    0 as duplicates
FROM node_contents;

-- 显示各课程的内容统计
SELECT
    cm.id::text as course_id,
    cm.topic,
    COUNT(*) as content_count,
    SUM(CASE WHEN nc.generation_status = 'completed' THEN 1 ELSE 0 END) as completed_count,
    SUM(CASE WHEN nc.generation_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
    SUM(CASE WHEN nc.generation_status = 'generating' THEN 1 ELSE 0 END) as generating_count,
    SUM(CASE WHEN nc.generation_status = 'failed' THEN 1 ELSE 0 END) as failed_count
FROM course_maps cm
LEFT JOIN node_contents nc ON nc.course_map_id = cm.id
WHERE cm.created_at > NOW() - INTERVAL '7 days'
GROUP BY cm.id, cm.topic
ORDER BY cm.created_at DESC
LIMIT 10;
EOF

echo ""
echo "=== 清理完成 ==="
