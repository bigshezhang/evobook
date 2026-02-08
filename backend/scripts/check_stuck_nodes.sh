#!/bin/bash
# Check for stuck nodes in the database

set -e

echo "=========================================="
echo "Checking for Stuck Nodes"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable not set"
    echo "Please set it before running this script:"
    echo "  export DATABASE_URL='postgresql+asyncpg://user:pass@localhost/dbname'"
    exit 1
fi

# Extract connection details from DATABASE_URL
# Format: postgresql+asyncpg://user:pass@host:port/dbname
DB_URL_SYNC=$(echo "$DATABASE_URL" | sed 's/postgresql+asyncpg/postgresql/')

echo "Querying database for stuck nodes..."
echo ""

# Query 1: Count by status
echo "1. Node counts by generation status:"
psql "$DB_URL_SYNC" -c "
SELECT 
    generation_status,
    COUNT(*) as count
FROM node_contents
GROUP BY generation_status
ORDER BY generation_status;
"
echo ""

# Query 2: List stuck nodes
echo "2. Nodes in 'generating' or 'pending' status:"
psql "$DB_URL_SYNC" -c "
SELECT 
    course_map_id,
    node_id,
    generation_status,
    generation_started_at,
    CASE 
        WHEN generation_started_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - generation_started_at)) / 60
        ELSE NULL
    END as minutes_elapsed
FROM node_contents
WHERE generation_status IN ('generating', 'pending')
ORDER BY generation_started_at NULLS LAST;
"
echo ""

# Query 3: Summary by course
echo "3. Summary by course:"
psql "$DB_URL_SYNC" -c "
SELECT 
    course_map_id,
    COUNT(*) as total_nodes,
    SUM(CASE WHEN generation_status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN generation_status = 'generating' THEN 1 ELSE 0 END) as generating,
    SUM(CASE WHEN generation_status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN generation_status = 'failed' THEN 1 ELSE 0 END) as failed
FROM node_contents
GROUP BY course_map_id
ORDER BY course_map_id;
"
echo ""

echo "=========================================="
echo "Done"
echo "=========================================="
