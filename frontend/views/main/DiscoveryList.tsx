
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';
import { getDiscoveryCourses, startDiscoveryCourse, type DiscoveryCourse } from '../../utils/api';
import { ROUTES } from '../../utils/routes';
import { useThemeColor, PAGE_THEME_COLORS } from '../../utils/themeColor';

const DiscoveryList: React.FC = () => {
  const navigate = useNavigate();
  const { category } = useParams<{ category: string }>();
  // 设置页面主题色（状态栏颜色）
  useThemeColor(PAGE_THEME_COLORS.WHITE);

  const [courses, setCourses] = useState<DiscoveryCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const titleMap: Record<string, string> = {
    recommended: 'Recommended',
    popular: 'Popular Courses'
  };

  useEffect(() => {
    const loadCourses = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getDiscoveryCourses(category);
        setCourses(data.courses);
      } catch (err) {
        console.error('Failed to load discovery courses:', err);
        setError('Failed to load courses');
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, [category]);

  const handleBack = () => {
    navigate(`${ROUTES.COURSES}?tab=discovery`);
  };

  const handleAddCourse = async (presetId: string) => {
    try {
      // 调用后端 API 记录启动统计
      await startDiscoveryCourse(presetId);
    } catch (err) {
      console.error('Failed to start discovery course:', err);
      // 即使失败也继续跳转
    }

    // 跳转到 onboarding（assessment）并传递 preset_id
    navigate(`${ROUTES.ASSESSMENT}?preset=${presetId}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white pb-32">
      <header className="px-6 pt-12 pb-4 sticky top-0 bg-white/90 backdrop-blur-lg z-40">
        <div className="flex flex-col gap-4">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 border border-slate-100 active:scale-90 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-slate-900">arrow_back</span>
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight text-black">{titleMap[category || ''] || 'Discovery'}</h1>
        </div>
      </header>

      <main className="px-6 mt-2">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-slate-400">Loading courses...</div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-red-500">{error}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {courses.map(item => (
              <div key={item.id} className="flex flex-col gap-2.5">
                <div className="aspect-[4/3] clay-img overflow-hidden relative group">
                  <img alt={item.title} className="w-full h-full object-cover opacity-95 mix-blend-multiply" src={item.image_url || ''} loading="lazy"/>
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100/30 to-transparent"></div>
                </div>
                <div className="flex justify-between items-start gap-1">
                  <div className="flex-1">
                    <h4 className="font-bold text-[14px] leading-[1.3] text-black line-clamp-2">{item.title}</h4>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="material-symbols-rounded text-[14px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-[12px] font-bold text-slate-500">{item.rating}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddCourse(item.preset_id)}
                    className="w-8 h-8 min-w-[32px] bg-black rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer"
                  >
                    <span className="material-symbols-rounded text-white text-[20px]">add</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav activeTab="courses" />
    </div>
  );
};

export default DiscoveryList;
