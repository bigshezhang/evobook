import { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { trpc } from '../../utils/trpc';
import { colors, spacing, radii, typography } from '../../utils/theme';
import { BackButton, LoadingScreen, ErrorScreen } from '../../components/ui';

const PAGE_BREAK = '<EVOBK_PAGE_BREAK />';

export default function KnowledgeCardScreen() {
  const router = useRouter();
  const { cid, nid } = useLocalSearchParams<{ cid: string; nid: string }>();
  const nodeId = Number(nid);

  const utils = trpc.useUtils();
  const getCardMutation = trpc.nodeContent.getKnowledgeCard.useMutation();
  const updateProgress = trpc.nodeProgress.update.useMutation();

  const { data: courseData } = trpc.courseMap.getDetail.useQuery(
    { courseMapId: cid! },
    { enabled: !!cid },
  );

  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasLoaded = useRef(false);

  // 后端已返回正确类型，直接使用
  const allNodes = courseData?.nodes ?? [];
  const currentNode = allNodes.find((n) => n.id === nodeId);
  const mapMeta = courseData?.mapMeta;

  useEffect(() => {
    if (hasLoaded.current || !cid || !currentNode || !mapMeta) return;
    hasLoaded.current = true;

    const loadCard = async () => {
      try {
        await updateProgress.mutateAsync({
          courseMapId: cid,
          nodeId,
          status: 'in_progress',
        });

        const result = await getCardMutation.mutateAsync({
          language: 'zh',
          courseMapId: cid,
          course: {
            courseName: mapMeta?.course_name || '',
            courseContext: mapMeta?.strategy_rationale || '',
            topic: courseData?.topic || '',
            level: courseData?.level || 'Beginner',
            mode: courseData?.mode || 'Fast',
          },
          node: {
            id: nodeId,
            title: currentNode.title,
            description: currentNode.description,
            type: 'learn',
            estimatedMinutes: currentNode.estimated_minutes ?? 15,
          },
        });

        const markdown = (result as Record<string, string>)?.markdown || '';
        const split = markdown.split(PAGE_BREAK).map((s: string) => s.trim()).filter(Boolean);
        setPages(split.length > 0 ? split : [markdown]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '加载失败';
        setError(message);
      }
      setLoading(false);
    };

    loadCard();
  }, [cid, currentNode, mapMeta]);

  const handleComplete = async () => {
    try {
      await updateProgress.mutateAsync({
        courseMapId: cid!,
        nodeId,
        status: 'completed',
      });
      await Promise.all([
        utils.nodeProgress.get.invalidate({ courseMapId: cid! }),
        utils.courseMap.list.invalidate(),
      ]);
      router.back();
    } catch (err: unknown) {
      console.warn('Failed to complete node:', err);
    }
  };

  if (loading) {
    return <LoadingScreen message="正在加载知识卡片..." />;
  }

  if (error) {
    return <ErrorScreen message={error} />;
  }

  const isLastPage = currentPage === pages.length - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* 顶栏 */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <BackButton />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontWeight: '600', ...typography.bodySmall }} numberOfLines={1}>
            {currentNode?.title ?? ''}
          </Text>
          <Text style={{ color: colors.textMuted, ...typography.caption }}>
            {currentPage + 1} / {pages.length}
          </Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      {/* 内容 */}
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Markdown style={{
          body: { ...typography.body, lineHeight: 26, color: colors.textPrimary },
          heading2: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
          heading3: { ...typography.h3, color: '#374151', marginTop: spacing.md, marginBottom: spacing.sm },
          code_inline: { backgroundColor: '#F3F4F6', paddingHorizontal: spacing.xs, borderRadius: spacing.xs },
          fence: { backgroundColor: '#F3F4F6', padding: spacing.md, borderRadius: radii.sm, overflow: 'hidden' },
          bullet_list: { marginLeft: spacing.sm },
        }}>
          {pages[currentPage] ?? ''}
        </Markdown>
      </ScrollView>

      {/* 底部导航 */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        paddingBottom: 34,
        flexDirection: 'row',
        gap: spacing.md,
      }}>
        {currentPage > 0 && (
          <TouchableOpacity
            onPress={() => setCurrentPage(currentPage - 1)}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.borderLight,
              borderRadius: radii.md,
              padding: spacing.lg,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>上一页</Text>
          </TouchableOpacity>
        )}

        {isLastPage ? (
          <TouchableOpacity
            onPress={handleComplete}
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              borderRadius: radii.md,
              padding: spacing.lg,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.surface, fontWeight: '700', ...typography.body }}>完成学习 ✓</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setCurrentPage(currentPage + 1)}
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              borderRadius: radii.md,
              padding: spacing.lg,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.surface, fontWeight: '600' }}>下一页 →</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
