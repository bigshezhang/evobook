import { TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography } from '../../utils/theme';

interface BackButtonProps {
  color?: string;
  label?: string;
  fallbackRoute?: string;
}

export function BackButton({ color = colors.primary, label = '← 返回', fallbackRoute = '/' }: BackButtonProps) {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace(fallbackRoute as any)}>
      <Text style={{ color, fontSize: typography.body.fontSize }}>{label}</Text>
    </TouchableOpacity>
  );
}
