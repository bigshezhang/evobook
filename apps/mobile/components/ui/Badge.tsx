import { View, Text } from 'react-native';
import { spacing, radii } from '../../utils/theme';

interface BadgeProps {
  label: string;
  bgColor: string;
  textColor: string;
}

export function Badge({ label, bgColor, textColor }: BadgeProps) {
  return (
    <View style={{ backgroundColor: bgColor, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.sm }}>
      <Text style={{ color: textColor, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
