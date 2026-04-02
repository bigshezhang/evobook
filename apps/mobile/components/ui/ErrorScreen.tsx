import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, radii } from '../../utils/theme';

interface ErrorScreenProps {
  message: string;
  onRetry?: () => void;
  showBack?: boolean;
}

export function ErrorScreen({ message, onRetry, showBack = true }: ErrorScreenProps) {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: spacing.xxxl }}>
      <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>✗</Text>
      <Text style={{ color: colors.error, ...typography.h3, textAlign: 'center' }}>{message}</Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          style={{ marginTop: spacing.xl, backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md }}
        >
          <Text style={{ color: colors.surface, fontWeight: '600' }}>重试</Text>
        </TouchableOpacity>
      )}
      {showBack && (
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/' as any)} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.primary }}>返回</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
