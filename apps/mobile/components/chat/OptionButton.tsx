import { Text, TouchableOpacity } from 'react-native';
import { colors, spacing, radii, typography } from '../../utils/theme';

interface OptionButtonProps {
  label: string;
  onPress: () => void;
}

export function OptionButton({ label, onPress }: OptionButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: radii.md,
        padding: spacing.lg,
      }}
    >
      <Text style={{ color: colors.primary, ...typography.bodySmall, textAlign: 'center' }}>{label}</Text>
    </TouchableOpacity>
  );
}
