import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, spacing, radii, nodeStatusColors } from '../../utils/theme';
import { Badge } from '../ui';

interface NodeCardProps {
  title: string;
  type: 'learn' | 'quiz';
  status: string;
  estimatedMinutes: number;
  isWide: boolean;
  onPress: () => void;
}

type NodeStatus = keyof typeof nodeStatusColors;

export function NodeCard({ title, type, status, estimatedMinutes, isWide, onPress }: NodeCardProps) {
  const statusColor = nodeStatusColors[status as NodeStatus] || nodeStatusColors.locked;
  const isClickable = status !== 'locked' && status !== 'generating';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!isClickable}
      style={{
        backgroundColor: statusColor.bg,
        borderWidth: 2,
        borderColor: statusColor.border,
        borderRadius: radii.lg,
        padding: spacing.lg,
        width: isWide ? '80%' : '46%',
        alignItems: 'center',
        opacity: status === 'locked' ? 0.5 : 1,
      }}
    >
      {status === 'generating' ? (
        <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginBottom: spacing.sm }} />
      ) : (
        <Text style={{ fontSize: 18, marginBottom: spacing.xs }}>
          {status === 'completed' ? '✓' : type === 'quiz' ? '📝' : '📖'}
        </Text>
      )}
      <Text
        style={{ color: statusColor.text, fontWeight: '600', fontSize: 13, textAlign: 'center' }}
        numberOfLines={2}
      >
        {title}
      </Text>
      <Badge
        label={status === 'generating' ? '生成中...' : `${estimatedMinutes ?? 0} 分钟`}
        bgColor="transparent"
        textColor={colors.textMuted}
      />
    </TouchableOpacity>
  );
}
