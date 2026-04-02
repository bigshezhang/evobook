import { useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { trpc } from '../utils/trpc';
import { useOnboardingStore, OnboardingFinishData } from '../utils/stores/onboardingStore';
import { colors, spacing, radii, typography } from '../utils/theme';
import { BackButton } from '../components/ui';
import { MessageBubble } from '../components/chat/MessageBubble';
import { OptionButton } from '../components/chat/OptionButton';
import { ConceptPicker } from '../components/chat/ConceptPicker';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

const generateId = () => Date.now().toString() + Math.random().toString(36).slice(2);

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const onboardingMutation = trpc.onboarding.next.useMutation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [concepts, setConcepts] = useState<{ list: string[]; selected: Set<string> } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const finishData = useOnboardingStore((s) => s.finishData);

  useEffect(() => {
    sendMessage({});
  }, []);

  const sendMessage = async (extra: Record<string, string | undefined>) => {
    setLoading(true);
    setOptions([]);
    setConcepts(null);
    try {
      const response = await onboardingMutation.mutateAsync({
        sessionId: sessionId ?? undefined,
        ...extra,
      });

      setSessionId(response.sessionId);
      setMessages((prev) => [...prev, { id: generateId(), role: 'assistant', content: response.message }]);

      if (response.type === 'chat') {
        setOptions(response.options ?? []);
      } else if (response.type === 'concept_list_check') {
        const conceptList = 'concepts' in response ? (response.concepts as string[]) : [];
        setConcepts({ list: conceptList, selected: new Set() });
      } else if (response.type === 'finish') {
        const data = 'data' in response ? (response.data as OnboardingFinishData) : null;
        if (data) {
          useOnboardingStore.getState().setFinishData(data);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [...prev, { id: generateId(), role: 'assistant', content: `出错了：${message}` }]);
    }
    setLoading(false);
  };

  const handleOptionSelect = (option: string) => {
    setMessages((prev) => [...prev, { id: generateId(), role: 'user', content: option }]);
    sendMessage({ userChoice: option });
  };

  const handleTextSend = () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    setMessages((prev) => [...prev, { id: generateId(), role: 'user', content: text }]);
    sendMessage({ userMessage: text });
  };

  const handleConceptConfirm = () => {
    if (!concepts) return;
    const selected = Array.from(concepts.selected);
    setMessages((prev) => [...prev, { id: generateId(), role: 'user', content: `已选择 ${selected.length} 个概念` }]);
    sendMessage({ userMessage: JSON.stringify({ interested_concepts: selected }) });
  };

  const toggleConcept = (concept: string) => {
    if (!concepts) return;
    const newSelected = new Set(concepts.selected);
    if (newSelected.has(concept)) newSelected.delete(concept);
    else newSelected.add(concept);
    setConcepts({ ...concepts, selected: newSelected });
  };

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
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' }}>创建新课程</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => <MessageBubble role={item.role} content={item.content} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.sm }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        {loading && (
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {/* 选项按钮 */}
        {options.length > 0 && !loading && (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
            {options.map((opt, i) => (
              <OptionButton key={i} label={opt} onPress={() => handleOptionSelect(opt)} />
            ))}
          </View>
        )}

        {/* 概念选择 */}
        {concepts && !loading && (
          <ConceptPicker
            concepts={concepts.list}
            selected={concepts.selected}
            onToggle={toggleConcept}
            onConfirm={handleConceptConfirm}
          />
        )}

        {/* 完成按钮 — 跳转到生成页（数据已存入 store） */}
        {finishData && !loading && (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
            <TouchableOpacity
              onPress={() => router.replace('/generating')}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radii.md,
                padding: spacing.lg,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.surface, ...typography.h3 }}>开始生成课程 →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 自由输入（当没有选项时） */}
        {options.length === 0 && !concepts && !finishData && !loading && messages.length > 0 && (
          <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm }}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="输入你的回答..."
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.borderLight,
                borderRadius: radii.md,
                padding: spacing.md,
                ...typography.bodySmall,
              }}
              onSubmitEditing={handleTextSend}
            />
            <TouchableOpacity
              onPress={handleTextSend}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radii.md,
                paddingHorizontal: spacing.lg,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.surface, fontWeight: '600' }}>发送</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
