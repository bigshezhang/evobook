import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { trpc } from '../../utils/trpc';
import { useAuth } from '../../utils/auth';

interface CourseItem {
  courseMapId: string;
  topic: string;
  level: string;
  mode: string;
  mapMeta: any;
  progressPercentage: number;
}

export default function CoursesScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { data, isLoading, error } = trpc.courseMap.list.useQuery(undefined, {
    refetchOnMount: 'always',
  });

  const courses = (data as any)?.courses as CourseItem[] | undefined;

  const renderCourse = ({ item }: { item: CourseItem }) => (
    <TouchableOpacity
      onPress={() => router.push(`/course/${item.courseMapId}`)}
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 6 }}>
        {(item.mapMeta as any)?.course_name || item.topic}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
          <Text style={{ color: '#4F46E5', fontSize: 12, fontWeight: '600' }}>{item.level}</Text>
        </View>
        <View style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
          <Text style={{ color: '#16A34A', fontSize: 12, fontWeight: '600' }}>{item.mode}</Text>
        </View>
      </View>
      {/* 进度条 */}
      <View style={{ height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ height: '100%', backgroundColor: '#4F46E5', borderRadius: 3, width: `${item.progressPercentage}%` as any }} />
      </View>
      <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>{item.progressPercentage}% 完成</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#1F2937' }}>我的课程</Text>
          <TouchableOpacity onPress={() => router.push('/onboarding')}>
            <View style={{ backgroundColor: '#4F46E5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>+ 新课程</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Text style={{ color: '#EF4444', textAlign: 'center' }}>加载失败：{error.message}</Text>
        </View>
      ) : !courses || courses.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🎓</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 8 }}>还没有课程</Text>
          <Text style={{ color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>开始你的第一段学习旅程</Text>
          <TouchableOpacity
            onPress={() => router.push('/onboarding')}
            style={{ backgroundColor: '#4F46E5', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>创建课程</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.courseMapId}
          renderItem={renderCourse}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        />
      )}

      {/* 登出按钮（临时） */}
      <TouchableOpacity onPress={signOut} style={{ padding: 16, alignItems: 'center' }}>
        <Text style={{ color: '#9CA3AF' }}>退出登录</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
