import { View, Text } from 'react-native';
import { colors, spacing, radii, typography } from '../../utils/theme';

interface MessageBubbleProps {
  role: 'assistant' | 'user';
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <View style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      backgroundColor: isUser ? colors.primary : '#F3F4F6',
      borderRadius: radii.xl,
      padding: spacing.lg,
      marginVertical: spacing.xs,
      maxWidth: '85%',
    }}>
      <Text style={{
        color: isUser ? colors.surface : colors.textPrimary,
        ...typography.bodySmall,
      }}>
        {content}
      </Text>
    </View>
  );
}
