import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { trpc } from '../utils/trpc';

export default function GeneratingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data: string }>();
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
        const onboardingData = params.data ? JSON.parse(params.data) : null;
        if (!onboardingData) {
          setStatus('error');
          setErrorMsg('缺少 onboarding 数据');
          return;
        }

        const result = await generateMutation.mutateAsync({
          topic: onboardingData.topic,
          level: onboardingData.level || 'Beginner',
          focus: onboardingData.focus || '',
          verifiedConcept: onboardingData.verifiedConcept || onboardingData.topic || 'General',
          mode: onboardingData.mode || 'Fast',
          totalCommitmentMinutes: 60,
          interestedConcepts: onboardingData.interestedConcepts,
        });

        setStatus('success');
        const courseId = result.courseMapId;
        // invalidate 课程列表缓存，首页返回时自动刷新
        await utils.courseMap.list.invalidate();
        setTimeout(() => {
          router.replace(`/course/${courseId}`);
        }, 800);
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message || '生成失败');
      }
    };

    generate();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color="#4F46E5" style={{ marginBottom: 24 }} />
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#1F2937' }}>正在生成课程...</Text>
          <Text style={{ color: '#6B7280', marginTop: 8 }}>AI 正在为你定制学习路径</Text>
        </>
      )}
      {status === 'success' && (
        <>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✓</Text>
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#16A34A' }}>课程生成完成！</Text>
        </>
      )}
      {status === 'error' && (
        <>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✗</Text>
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#EF4444' }}>生成失败</Text>
          <Text style={{ color: '#6B7280', marginTop: 8, paddingHorizontal: 40, textAlign: 'center' }}>{errorMsg}</Text>
          <TouchableOpacity
            onPress={() => router.replace('/')}
            style={{ marginTop: 24, backgroundColor: '#4F46E5', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>返回首页</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}
