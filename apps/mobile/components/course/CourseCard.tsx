import { View, Text, TouchableOpacity } from 'react-native';
import { colors, spacing, radii, typography } from '../../utils/theme';
import { ProgressBar, Badge } from '../ui';

interface CourseCardProps {
  courseName: string;
  topic: string;
  level: string;
  mode: string;
  progressPercentage: number;
  onPress: () => void;
}

export function CourseCard({ courseName, topic, level, mode, progressPercentage, onPress }: CourseCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        padding: spacing.xl,
        marginBottom: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <Text style={{ ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm }}>
        {courseName || topic}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <Badge label={level} bgColor={colors.primaryLight} textColor={colors.primary} />
        <Badge label={mode} bgColor={colors.successLight} textColor={colors.success} />
      </View>
      <ProgressBar percent={progressPercentage} />
      <Text style={{ color: colors.textMuted, ...typography.caption, marginTop: spacing.xs }}>
        {progressPercentage}% 完成
      </Text>
    </TouchableOpacity>
  );
}
