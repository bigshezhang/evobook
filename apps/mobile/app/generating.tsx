import { useEffect, useState, useRef } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { trpc } from '../utils/trpc';
import { useOnboardingStore } from '../utils/stores/onboardingStore';
import { colors, spacing, typography } from '../utils/theme';
import { LoadingScreen, ErrorScreen } from '../components/ui';

export default function GeneratingScreen() {
  const router = useRouter();
  const finishData = useOnboardingStore((s) => s.finishData);
  const utils = trpc.useUtils();
  const generateMutation = trpc.courseMap.generate.useMutation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const generate = async () => {
      try {
        if (!finishData) {
          setStatus('error');
          setErrorMsg('缺少 onboarding 数据');
          return;
        }

        const result = await generateMutation.mutateAsync({
          topic: finishData.topic,
          level: finishData.level || 'Beginner',
          focus: finishData.focus || '',
          verifiedConcept: finishData.verifiedConcept || finishData.topic || 'General',
          mode: finishData.mode || 'Fast',
          totalCommitmentMinutes: 60,
        });

        setStatus('success');
        // 生成完毕，清除 store 数据
        useOnboardingStore.getState().clear();
        const courseId = result.courseMapId;
        // invalidate 课程列表缓存，首页返回时自动刷新
        await utils.courseMap.list.invalidate();
        setTimeout(() => {
          router.replace(`/course/${courseId}`);
        }, 800);
      } catch (err: unknown) {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : '生成失败');
      }
    };

    generate();
  }, []);

  if (status === 'loading') {
    return <LoadingScreen message="正在生成课程..." />;
  }

  if (status === 'error') {
    return <ErrorScreen message={errorMsg || '生成失败'} />;
  }

  // 成功状态 — 短暂展示后自动跳转
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>✓</Text>
      <Text style={{ ...typography.h3, color: colors.success }}>课程生成完成！</Text>
    </SafeAreaView>
  );
}
