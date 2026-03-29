import { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { trpc } from '../../utils/trpc';

// 节点状态颜色
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  locked: { bg: '#F3F4F6', text: '#9CA3AF', border: '#D1D5DB' },
  unlocked: { bg: '#EEF2FF', text: '#4F46E5', border: '#A5B4FC' },
  in_progress: { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D' },
  completed: { bg: '#D1FAE5', text: '#059669', border: '#6EE7B7' },
  generating: { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
};

export default function KnowledgeTreeScreen() {
  const router = useRouter();
  const { id: courseMapId } = useLocalSearchParams<{ id: string }>();

  const utils = trpc.useUtils();

  // 从卡片页返回时自动刷新进度数据
  useFocusEffect(
    useCallback(() => {
      if (courseMapId) {
        utils.nodeProgress.get.invalidate({ courseMapId });
      }
    }, [courseMapId]),
  );

  const { data: courseData, isLoading: courseLoading } = trpc.courseMap.getDetail.useQuery(
    { courseMapId: courseMapId! },
    { enabled: !!courseMapId },
  );

  const { data: progressData } = trpc.nodeProgress.get.useQuery(
    { courseMapId: courseMapId! },
    { enabled: !!courseMapId, refetchOnMount: 'always' },
  );

  const { data: genData } = trpc.courseMap.getGenerationProgress.useQuery(
    { courseMapId: courseMapId! },
    { enabled: !!courseMapId, refetchInterval: 3000 },
  );

  // 构建进度 map
  const progressMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (progressData) {
      const items = (progressData as any).progress ?? progressData;
      if (Array.isArray(items)) {
        items.forEach((p: any) => { map[p.nodeId] = p.status; });
      }
    }
    return map;
  }, [progressData]);

  // 构建生成状态 map
  const genStatusMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (genData) {
      const nodes = (genData as any).nodesStatus ?? [];
      nodes.forEach((n: any) => { map[n.nodeId ?? n.node_id] = n.status; });
    }
    return map;
  }, [genData]);

  // 按 layer 分组
  const layers = useMemo(() => {
    if (!courseData) return [];
    const nodes = (courseData as any).nodes ?? [];
    const grouped: Record<number, any[]> = {};
    nodes.forEach((n: any) => {
      const layer = n.layer ?? 0;
      if (!grouped[layer]) grouped[layer] = [];
      grouped[layer].push(n);
    });
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map((layer) => ({ layer, nodes: grouped[layer] }));
  }, [courseData]);

  // 前端实时计算节点状态（基于 DAG 依赖关系）
  const computedStatusMap = useMemo(() => {
    const result: Record<number, string> = {};
    const allNodes = (courseData as any)?.nodes ?? [];

    for (const node of allNodes) {
      const dbStatus = progressMap[node.id];

      // 已完成或进行中的节点，直接用 DB 状态
      if (dbStatus === 'completed' || dbStatus === 'in_progress') {
        result[node.id] = dbStatus;
        continue;
      }

      // learn 节点检查生成状态
      if (node.type !== 'quiz') {
        const genStatus = genStatusMap[node.id];
        if (genStatus === 'generating' || genStatus === 'pending') {
          result[node.id] = 'generating';
          continue;
        }
      }

      // 根据前置依赖判断是否应该解锁
      const prereqs = (node.pre_requisites ?? []) as number[];
      if (prereqs.length === 0) {
        // 无前置依赖 → 解锁
        result[node.id] = dbStatus || 'unlocked';
      } else {
        // 所有前置都完成 → 解锁
        const allPrereqsDone = prereqs.every((pid: number) => progressMap[pid] === 'completed');
        result[node.id] = allPrereqsDone ? (dbStatus || 'unlocked') : 'locked';
      }
    }
    return result;
  }, [courseData, progressMap, genStatusMap]);

  const getNodeStatus = (nodeId: number) => {
    return computedStatusMap[nodeId] || 'locked';
  };

  const handleNodePress = (node: any) => {
    const status = getNodeStatus(node.id);
    if (status === 'locked' || status === 'generating') return;
    router.push({ pathname: '/course/card', params: { cid: courseMapId, nid: String(node.id) } });
  };

  if (courseLoading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </SafeAreaView>
    );
  }

  const mapMeta = (courseData as any)?.mapMeta;
  const courseName = mapMeta?.course_name || (courseData as any)?.topic || '课程';

  // 计算进度
  const allNodes = (courseData as any)?.nodes ?? [];
  const completedCount = allNodes.filter((n: any) => progressMap[n.id] === 'completed').length;
  const progressPercent = allNodes.length > 0 ? Math.round((completedCount / allNodes.length) * 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* 头部 */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#4F46E5' }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Text style={{ color: '#C7D2FE', fontSize: 15 }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 8 }} numberOfLines={2}>{courseName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
          <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 }}>
            <View style={{ height: '100%', backgroundColor: '#fff', borderRadius: 2, width: `${progressPercent}%` as any }} />
          </View>
          <Text style={{ color: '#C7D2FE', fontSize: 12 }}>{progressPercent}%</Text>
        </View>
      </View>

      {/* 节点树 */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {layers.map(({ layer, nodes }) => (
          <View key={layer} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              {nodes.map((node: any) => {
                const status = getNodeStatus(node.id);
                const colors = STATUS_COLORS[status] || STATUS_COLORS.locked;
                const isClickable = status !== 'locked' && status !== 'generating';

                return (
                  <TouchableOpacity
                    key={node.id}
                    onPress={() => handleNodePress(node)}
                    disabled={!isClickable}
                    style={{
                      backgroundColor: colors.bg,
                      borderWidth: 2,
                      borderColor: colors.border,
                      borderRadius: 14,
                      padding: 14,
                      width: nodes.length > 1 ? '46%' : '80%',
                      alignItems: 'center',
                      opacity: status === 'locked' ? 0.5 : 1,
                    }}
                  >
                    {status === 'generating' ? (
                      <ActivityIndicator size="small" color="#6B7280" style={{ marginBottom: 6 }} />
                    ) : (
                      <Text style={{ fontSize: 18, marginBottom: 4 }}>
                        {status === 'completed' ? '✓' : node.type === 'quiz' ? '📝' : '📖'}
                      </Text>
                    )}
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13, textAlign: 'center' }} numberOfLines={2}>
                      {node.title}
                    </Text>
                    <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>
                      {status === 'generating' ? '生成中...' : `${node.estimated_minutes ?? 0} 分钟`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* 连接线 */}
            {layer < layers.length && (
              <View style={{ alignItems: 'center', marginVertical: 4 }}>
                <View style={{ width: 2, height: 20, backgroundColor: '#D1D5DB' }} />
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
