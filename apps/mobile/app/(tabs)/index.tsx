import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { trpc } from '../../utils/trpc';
import { useAuth } from '../../utils/auth';
import { colors, spacing, radii, typography } from '../../utils/theme';
import { LoadingScreen } from '../../components/ui';
import { CourseCard } from '../../components/course/CourseCard';

export default function CoursesScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { data, isLoading, error } = trpc.courseMap.list.useQuery(undefined, {
    refetchOnMount: 'always',
  });

  const courses = data?.courses;

  if (isLoading) {
    return <LoadingScreen message="加载课程列表..." />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
          <Text style={{ ...typography.h1, color: colors.textPrimary }}>我的课程</Text>
          <TouchableOpacity onPress={() => router.push('/onboarding')}>
            <View style={{ backgroundColor: colors.primary, borderRadius: radii.xxl, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
              <Text style={{ color: colors.surface, fontWeight: '600' }}>+ 新课程</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xxxxl }}>
          <Text style={{ color: colors.error, textAlign: 'center' }}>加载失败：{error.message}</Text>
        </View>
      ) : !courses || courses.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xxxxl }}>
          <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>🎓</Text>
          <Text style={{ ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm }}>还没有课程</Text>
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xxl }}>
            开始你的第一段学习旅程
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/onboarding')}
            style={{ backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md }}
          >
            <Text style={{ color: colors.surface, fontWeight: '600', ...typography.body }}>创建课程</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.courseMapId}
          renderItem={({ item }) => (
            <CourseCard
              courseName={item.mapMeta?.course_name ?? ''}
              topic={item.topic}
              level={item.level}
              mode={item.mode}
              progressPercentage={item.progressPercentage}
              onPress={() => router.push(`/course/${item.courseMapId}`)}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
        />
      )}

      {/* 登出按钮（临时） */}
      <TouchableOpacity onPress={signOut} style={{ padding: spacing.lg, alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted }}>退出登录</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
