import { useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { trpc } from '../utils/trpc';

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const onboardingMutation = trpc.onboarding.next.useMutation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [concepts, setConcepts] = useState<{ list: string[]; selected: Set<string> } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [finishData, setFinishData] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  // 初始化对话
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

      // 添加 AI 消息
      setMessages((prev) => [...prev, { role: 'assistant', content: response.message }]);

      if (response.type === 'chat') {
        setOptions(response.options ?? []);
      } else if (response.type === 'concept_list_check') {
        setConcepts({ list: (response as any).concepts ?? [], selected: new Set() });
      } else if (response.type === 'finish') {
        setFinishData((response as any).data);
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `出错了：${err.message}` }]);
    }
    setLoading(false);
  };

  const handleOptionSelect = (option: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: option }]);
    sendMessage({ userChoice: option });
  };

  const handleTextSend = () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    sendMessage({ userMessage: text });
  };

  const handleConceptConfirm = () => {
    if (!concepts) return;
    const selected = Array.from(concepts.selected);
    setMessages((prev) => [...prev, { role: 'user', content: `已选择 ${selected.length} 个概念` }]);
    sendMessage({ userMessage: JSON.stringify({ interested_concepts: selected }) });
  };

  const toggleConcept = (concept: string) => {
    if (!concepts) return;
    const newSelected = new Set(concepts.selected);
    if (newSelected.has(concept)) newSelected.delete(concept);
    else newSelected.add(concept);
    setConcepts({ ...concepts, selected: newSelected });
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={{
      alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
      backgroundColor: item.role === 'user' ? '#4F46E5' : '#F3F4F6',
      borderRadius: 16,
      padding: 14,
      marginVertical: 4,
      maxWidth: '85%',
    }}>
      <Text style={{ color: item.role === 'user' ? '#fff' : '#1F2937', fontSize: 15, lineHeight: 22 }}>
        {item.content}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 16, color: '#4F46E5' }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' }}>创建新课程</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        {loading && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            <ActivityIndicator color="#4F46E5" />
          </View>
        )}

        {/* 选项按钮 */}
        {options.length > 0 && !loading && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
            {options.map((opt, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => handleOptionSelect(opt)}
                style={{ borderWidth: 1, borderColor: '#4F46E5', borderRadius: 12, padding: 14 }}
              >
                <Text style={{ color: '#4F46E5', fontSize: 15, textAlign: 'center' }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 概念选择 */}
        {concepts && !loading && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {concepts.list.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => toggleConcept(c)}
                  style={{
                    borderWidth: 1,
                    borderColor: concepts.selected.has(c) ? '#4F46E5' : '#D1D5DB',
                    backgroundColor: concepts.selected.has(c) ? '#EEF2FF' : '#fff',
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: concepts.selected.has(c) ? '#4F46E5' : '#6B7280' }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={handleConceptConfirm}
              style={{ backgroundColor: '#4F46E5', borderRadius: 12, padding: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>确认选择</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 完成按钮 */}
        {finishData && !loading && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <TouchableOpacity
              onPress={() => router.replace({ pathname: '/generating', params: { data: JSON.stringify(finishData) } })}
              style={{ backgroundColor: '#4F46E5', borderRadius: 12, padding: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>开始生成课程 →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 自由输入（当没有选项时） */}
        {options.length === 0 && !concepts && !finishData && !loading && messages.length > 0 && (
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="输入你的回答..."
              style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 12, fontSize: 15 }}
              onSubmitEditing={handleTextSend}
            />
            <TouchableOpacity onPress={handleTextSend} style={{ backgroundColor: '#4F46E5', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>发送</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
