
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/Header';
import SuccessFeedbackPill from '../../components/SuccessFeedbackPill';
import { getCourseDetail, buildLearningPath } from '../../utils/api';
import { STORAGE_KEYS } from '../../utils/constants';
import { ROUTES } from '../../utils/routes';
import { useThemeColor, PAGE_THEME_COLORS } from '../../utils/themeColor';

const CourseDetail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 设置页面主题色（状态栏颜色）
  useThemeColor(PAGE_THEME_COLORS.WHITE);

  const cidFromUrl = searchParams.get('cid');

  const [velocity, setVelocity] = useState<'15m' | '30m' | '45m' | '1h'>('30m');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isMainCourse, setIsMainCourse] = useState(false);

  // Course data from backend
  const [courseName, setCourseName] = useState('Loading...');
  const [topic, setTopic] = useState('');
  const [knowledgeTags, setKnowledgeTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCourseData = async () => {
      if (!cidFromUrl) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getCourseDetail(cidFromUrl);
        setCourseName(data.map_meta.course_name as string);
        setTopic(data.topic);

        // Extract knowledge tags from node titles
        const tags = (data.nodes as any[]).slice(0, 6).map((n: any) => n.title);
        setKnowledgeTags(tags);
      } catch (error) {
        console.error('Failed to load course:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCourseData();
  }, [cidFromUrl]);

  const handleSetMainCourse = () => {
    setIsMainCourse(true);
    // 模拟修改用户数据表中的主页面课程设置
    localStorage.setItem(STORAGE_KEYS.MAIN_COURSE, 'Neural Networks');
    setShowSuccess(true);
  };

  const handleConfirm = () => {
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
    navigate(buildLearningPath(ROUTES.KNOWLEDGE_TREE, { cid: cidFromUrl }));
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans overflow-hidden">
      <Header
        subtitle="Editorial Plan"
        rightAction={
          <button
            onClick={handleSetMainCourse}
            className="w-10 h-10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <span
              className={`material-symbols-outlined text-[24px] transition-colors ${isMainCourse ? 'text-amber-400' : 'text-charcoal'}`}
              style={{ fontVariationSettings: `'FILL' ${isMainCourse ? 1 : 0}` }}
            >
              star
            </span>
          </button>
        }
      />

      <main className="flex-1 px-8 flex flex-col overflow-y-auto no-scrollbar pb-32">
        <section className="flex flex-col items-center pt-4">
          <div className="relative w-44 h-56 bg-[#A28FFF] rounded-[40px] shadow-[0_20px_40px_-15px_rgba(162,143,255,0.5)] flex flex-col items-center justify-center overflow-hidden mb-6">
            <div className="relative z-10 w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
              <span className="material-symbols-outlined text-[64px] text-white">psychology</span>
            </div>
            <div className="absolute bottom-6 left-8 space-y-2">
              <div className="h-2 w-16 bg-white/30 rounded-full"></div>
              <div className="h-2 w-10 bg-white/30 rounded-full"></div>
            </div>
          </div>
          <h2 className="text-[28px] font-black tracking-tight text-center leading-none text-charcoal">{courseName}</h2>
          <p className="mt-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] text-center">{topic}</p>
        </section>

        <section className="mt-5">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Knowledge Graph</h3>
          <div className="flex flex-wrap gap-2.5">
            {knowledgeTags.map(tag => (
              <span key={tag} className="bg-[#F0EFFF] text-charcoal px-4 py-2 rounded-full text-[13px] font-bold border border-black/5">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Daily Velocity</h3>
            <span className="text-[13px] font-black text-charcoal">30M</span>
          </div>
          <div className="bg-[#F3F4F6] p-1.5 rounded-2xl flex gap-1">
            {(['15m', '30m', '45m', '1h'] as const).map(item => (
              <button
                key={item}
                onClick={() => setVelocity(item)}
                className={`flex-1 py-3 text-[14px] font-black rounded-xl transition-all ${velocity === item ? 'bg-charcoal text-white shadow-lg' : 'text-slate-400'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      </main>

      <div className="p-8 bg-white border-t border-slate-50 flex justify-center z-40">
        <div className="max-w-md w-full pointer-events-auto">
          <button
            onClick={handleConfirm}
            className="w-full bg-charcoal text-white py-5 rounded-[24px] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all group"
          >
            <span className="font-black text-[15px] uppercase tracking-[0.15em] ml-4">Confirm & Start</span>
            <span className="material-symbols-outlined text-[22px] font-bold group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
        </div>
      </div>

      <SuccessFeedbackPill
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        message="Added as main course"
      />
    </div>
  );
};

export default CourseDetail;
