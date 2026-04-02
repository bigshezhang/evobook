import { View } from 'react-native';
import { colors, radii } from '../../utils/theme';

interface ProgressBarProps {
  percent: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
}

export function ProgressBar({
  percent,
  height = 6,
  trackColor = colors.border,
  fillColor = colors.primary,
}: ProgressBarProps) {
  return (
    <View style={{ height, backgroundColor: trackColor, borderRadius: radii.sm, overflow: 'hidden' }}>
      <View style={{ height: '100%', backgroundColor: fillColor, borderRadius: radii.sm, width: `${Math.min(100, Math.max(0, percent))}%` as any }} />
    </View>
  );
}
