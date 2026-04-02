import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../utils/auth';
import { colors, spacing, radii, typography } from '../utils/theme';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
          {/* 品牌区 */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xxxxl }}>
            <Text style={{ fontSize: 36, fontWeight: '800', color: colors.primary }}>EvoBook</Text>
            <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>
              AI 驱动的个性化学习
            </Text>
          </View>

          {/* 表单 */}
          <View style={{ gap: spacing.lg }}>
            <TextInput
              placeholder="邮箱"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                borderWidth: 1,
                borderColor: colors.borderLight,
                borderRadius: radii.md,
                padding: spacing.lg,
                ...typography.body,
              }}
            />
            <TextInput
              placeholder="密码"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{
                borderWidth: 1,
                borderColor: colors.borderLight,
                borderRadius: radii.md,
                padding: spacing.lg,
                ...typography.body,
              }}
            />

            {error ? <Text style={{ color: colors.error, textAlign: 'center' }}>{error}</Text> : null}
            {success ? <Text style={{ color: colors.success, textAlign: 'center' }}>{success}</Text> : null}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radii.md,
                padding: spacing.lg,
                alignItems: 'center',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={{ color: colors.surface, ...typography.h3 }}>
                  {isSignUp ? '注册' : '登录'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}>
              <Text style={{ textAlign: 'center', color: colors.primary, ...typography.bodySmall }}>
                {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
