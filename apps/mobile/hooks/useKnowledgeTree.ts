import { useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { trpc } from '../utils/trpc';

// 后端 tRPC 推断的类型：
// courseData.nodes: DAGNodeJson[]
// courseData.mapMeta: MapMetaJson
// progressData: { progress: NodeProgressItem[] }
// genData: GenerationProgressResult（含 nodesStatus: NodeGenerationStatus[]）

export function useKnowledgeTree(courseMapId: string | undefined) {
  const utils = trpc.useUtils();

  // 屏幕获得焦点时刷新进度
  useFocusEffect(
    useCallback(() => {
      if (courseMapId) utils.nodeProgress.get.invalidate({ courseMapId });
    }, [courseMapId]),
  );

  const { data: courseData, isLoading } = trpc.courseMap.getDetail.useQuery(
    { courseMapId: courseMapId! },
    { enabled: !!courseMapId },
  );

  const { data: progressData } = trpc.nodeProgress.get.useQuery(
    { courseMapId: courseMapId! },
    { enabled: !!courseMapId },
  );

  const { data: genData } = trpc.courseMap.getGenerationProgress.useQuery(
    { courseMapId: courseMapId! },
    { enabled: !!courseMapId, refetchInterval: 3000 },
  );

  // 节点列表（tRPC 推断为 DAGNodeJson[]）
  const nodes = courseData?.nodes ?? [];
  const mapMeta = courseData?.mapMeta;

  // 进度 map（tRPC 推断：{ progress: NodeProgressItem[] }）
  const progressMap = useMemo(() => {
    const map: Record<number, string> = {};
    const items = progressData?.progress ?? [];
    items.forEach((p) => { map[p.nodeId] = p.status; });
    return map;
  }, [progressData]);

  // 生成状态 map（tRPC 推断：GenerationProgressResult）
  const genStatusMap = useMemo(() => {
    const map: Record<number, string> = {};
    const statuses = genData?.nodesStatus ?? [];
    statuses.forEach((n) => { map[n.nodeId] = n.status; });
    return map;
  }, [genData]);

  // 按 layer 分组
  const layers = useMemo(() => {
    const grouped: Record<number, typeof nodes> = {};
    nodes.forEach((n) => {
      const layer = n.layer ?? 0;
      if (!grouped[layer]) grouped[layer] = [];
      grouped[layer].push(n);
    });
    return Object.keys(grouped).map(Number).sort((a, b) => a - b).map((layer) => ({ layer, nodes: grouped[layer] }));
  }, [nodes]);

  // 前端实时计算节点状态（DAG 依赖关系）
  const computedStatusMap = useMemo(() => {
    const result: Record<number, string> = {};
    for (const node of nodes) {
      const dbStatus = progressMap[node.id];
      if (dbStatus === 'completed' || dbStatus === 'in_progress') {
        result[node.id] = dbStatus;
        continue;
      }
      if (node.type !== 'quiz') {
        const genStatus = genStatusMap[node.id];
        if (genStatus === 'generating' || genStatus === 'pending') {
          result[node.id] = 'generating';
          continue;
        }
      }
      const prereqs = node.pre_requisites ?? [];
      if (prereqs.length === 0) {
        result[node.id] = dbStatus || 'unlocked';
      } else {
        const allDone = prereqs.every((pid) => progressMap[pid] === 'completed');
        result[node.id] = allDone ? (dbStatus || 'unlocked') : 'locked';
      }
    }
    return result;
  }, [nodes, progressMap, genStatusMap]);

  const getNodeStatus = (nodeId: number) => computedStatusMap[nodeId] || 'locked';

  // 进度统计
  const completedCount = nodes.filter((n) => progressMap[n.id] === 'completed').length;
  const progressPercent = nodes.length > 0 ? Math.round((completedCount / nodes.length) * 100) : 0;

  return {
    courseData,
    nodes,
    mapMeta,
    layers,
    getNodeStatus,
    progressPercent,
    isLoading,
    courseName: mapMeta?.course_name || courseData?.topic || '课程',
  };
}
