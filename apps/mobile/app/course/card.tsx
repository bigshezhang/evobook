import { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { trpc } from '../../utils/trpc';

const PAGE_BREAK = '<EVOBK_PAGE_BREAK />';

export default function KnowledgeCardScreen() {
  const router = useRouter();
  const { cid, nid } = useLocalSearchParams<{ cid: string; nid: string }>();
  const nodeId = Number(nid);
  const { width } = useWindowDimensions();

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

  // 获取当前节点信息
  const currentNode = ((courseData as any)?.nodes ?? []).find((n: any) => n.id === nodeId);
  const mapMeta = (courseData as any)?.mapMeta;

  useEffect(() => {
    if (hasLoaded.current || !cid || !currentNode || !mapMeta) return;
    hasLoaded.current = true;

    const loadCard = async () => {
      try {
        // 标记节点为学习中
        await updateProgress.mutateAsync({
          courseMapId: cid,
          nodeId,
          status: 'in_progress',
        });

        const result = await getCardMutation.mutateAsync({
          language: 'zh',
          courseMapId: cid,
          course: {
            courseName: mapMeta.course_name || '',
            courseContext: mapMeta.strategy_rationale || '',
            topic: (courseData as any)?.topic || '',
            level: (courseData as any)?.level || 'Beginner',
            mode: (courseData as any)?.mode || 'Fast',
          },
          node: {
            id: nodeId,
            title: currentNode.title,
            description: currentNode.description,
            type: 'learn',
            estimatedMinutes: currentNode.estimated_minutes ?? 15,
          },
        });

        const markdown = (result as any).markdown || '';
        const split = markdown.split(PAGE_BREAK).map((s: string) => s.trim()).filter(Boolean);
        setPages(split.length > 0 ? split : [markdown]);
      } catch (err: any) {
        setError(err.message || '加载失败');
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
      // invalidate 相关缓存，返回后自动 refetch
      await Promise.all([
        utils.nodeProgress.get.invalidate({ courseMapId: cid! }),
        utils.courseMap.list.invalidate(),
      ]);
      router.back();
    } catch (err: any) {
      console.error('Failed to complete node:', err);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ color: '#6B7280', marginTop: 12 }}>正在加载知识卡片...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ color: '#EF4444', fontSize: 16 }}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#4F46E5' }}>返回</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isLastPage = currentPage === pages.length - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* 顶栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#4F46E5', fontSize: 16 }}>← 返回</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{currentNode?.title ?? ''}</Text>
          <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{currentPage + 1} / {pages.length}</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      {/* 内容 */}
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <Markdown style={{
          body: { fontSize: 16, lineHeight: 26, color: '#1F2937' },
          heading2: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginTop: 16, marginBottom: 8 },
          heading3: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 },
          code_inline: { backgroundColor: '#F3F4F6', paddingHorizontal: 4, borderRadius: 4 },
          fence: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, overflow: 'hidden' },
          bullet_list: { marginLeft: 8 },
        }}>
          {pages[currentPage] ?? ''}
        </Markdown>
      </ScrollView>

      {/* 底部导航 */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB',
        paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 34,
        flexDirection: 'row', gap: 12,
      }}>
        {currentPage > 0 && (
          <TouchableOpacity
            onPress={() => setCurrentPage(currentPage - 1)}
            style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#374151', fontWeight: '600' }}>上一页</Text>
          </TouchableOpacity>
        )}

        {isLastPage ? (
          <TouchableOpacity
            onPress={handleComplete}
            style={{ flex: 1, backgroundColor: '#4F46E5', borderRadius: 12, padding: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>完成学习 ✓</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setCurrentPage(currentPage + 1)}
            style={{ flex: 1, backgroundColor: '#4F46E5', borderRadius: 12, padding: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>下一页 →</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
