import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../utils/theme';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = '加载中...' }: LoadingScreenProps) {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ color: colors.textSecondary, marginTop: spacing.md, ...typography.body }}>{message}</Text>
    </SafeAreaView>
  );
}
