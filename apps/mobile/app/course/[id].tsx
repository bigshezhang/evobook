import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography } from '../../utils/theme';
import { BackButton, ProgressBar, LoadingScreen } from '../../components/ui';
import { NodeCard } from '../../components/course/NodeCard';
import { useKnowledgeTree } from '../../hooks/useKnowledgeTree';

export default function KnowledgeTreeScreen() {
  const router = useRouter();
  const { id: courseMapId } = useLocalSearchParams<{ id: string }>();

  const { layers, getNodeStatus, progressPercent, courseName, isLoading } = useKnowledgeTree(courseMapId);

  const handleNodePress = (nodeId: number, status: string) => {
    if (status === 'locked' || status === 'generating') return;
    router.push({ pathname: '/course/card', params: { cid: courseMapId, nid: String(nodeId) } });
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 头部 */}
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.primary }}>
        <BackButton color={colors.primaryMuted} />
        <Text style={{ color: colors.surface, ...typography.h2, marginTop: spacing.sm }} numberOfLines={2}>
          {courseName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <ProgressBar
              percent={progressPercent}
              height={4}
              trackColor="rgba(255,255,255,0.3)"
              fillColor={colors.surface}
            />
          </View>
          <Text style={{ color: colors.primaryMuted, ...typography.caption }}>{progressPercent}%</Text>
        </View>
      </View>

      {/* 节点树 */}
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxxl }}>
        {layers.map(({ layer, nodes }) => (
          <View key={layer} style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
              {nodes.map((node) => {
                const status = getNodeStatus(node.id);
                return (
                  <NodeCard
                    key={node.id}
                    title={node.title}
                    type={node.type}
                    status={status}
                    estimatedMinutes={node.estimated_minutes}
                    isWide={nodes.length === 1}
                    onPress={() => handleNodePress(node.id, status)}
                  />
                );
              })}
            </View>
            {/* 连接线 */}
            {layer < layers.length && (
              <View style={{ alignItems: 'center', marginVertical: spacing.xs }}>
                <View style={{ width: 2, height: 20, backgroundColor: colors.borderLight }} />
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
