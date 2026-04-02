import { View, Text, TouchableOpacity } from 'react-native';
import { colors, spacing, radii } from '../../utils/theme';

interface ConceptPickerProps {
  concepts: string[];
  selected: Set<string>;
  onToggle: (concept: string) => void;
  onConfirm: () => void;
}

export function ConceptPicker({ concepts, selected, onToggle, onConfirm }: ConceptPickerProps) {
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
        {concepts.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => onToggle(c)}
            style={{
              borderWidth: 1,
              borderColor: selected.has(c) ? colors.primary : colors.borderLight,
              backgroundColor: selected.has(c) ? colors.primaryLight : colors.surface,
              borderRadius: radii.full,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
            }}
          >
            <Text style={{ color: selected.has(c) ? colors.primary : colors.textSecondary }}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        onPress={onConfirm}
        style={{
          backgroundColor: colors.primary,
          borderRadius: radii.md,
          padding: spacing.lg,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.surface, fontWeight: '600' }}>确认选择</Text>
      </TouchableOpacity>
    </View>
  );
}
