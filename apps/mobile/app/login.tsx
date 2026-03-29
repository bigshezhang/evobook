import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../utils/auth';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    if (isSignUp) {
      const result = await signUp(email, password);
      if (result.error) setError(result.error);
      else if (result.needsConfirmation) setSuccess('注册成功！请查看邮箱确认链接');
    } else {
      const result = await signIn(email, password);
      if (result.error) setError(result.error);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
          {/* 品牌区 */}
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <Text style={{ fontSize: 36, fontWeight: '800', color: '#4F46E5' }}>EvoBook</Text>
            <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 8 }}>AI 驱动的个性化学习</Text>
          </View>

          {/* 表单 */}
          <View style={{ gap: 16 }}>
            <TextInput
              placeholder="邮箱"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 16 }}
            />
            <TextInput
              placeholder="密码"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 16 }}
            />

            {error ? <Text style={{ color: '#EF4444', textAlign: 'center' }}>{error}</Text> : null}
            {success ? <Text style={{ color: '#10B981', textAlign: 'center' }}>{success}</Text> : null}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={{
                backgroundColor: '#4F46E5',
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
                  {isSignUp ? '注册' : '登录'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}>
              <Text style={{ textAlign: 'center', color: '#4F46E5', fontSize: 15 }}>
                {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
