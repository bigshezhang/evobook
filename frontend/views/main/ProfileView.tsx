
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';
import { getProfileStats, ProfileStats, getInviteCode, InviteCodeData, getUserCourses, CourseListItem, getProfile, updateProfile, Profile } from '../../utils/api';
import { getSelectedCharacter } from '../../utils/mascotUtils';
import { CHARACTER_MAPPING } from '../../utils/mascotConfig';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';

const ProfileView: React.FC = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<InviteCodeData | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [recentCourses, setRecentCourses] = useState<CourseListItem[]>([]);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({ 
    message: '', 
    type: 'success', 
    visible: false 
  });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showEditNickname, setShowEditNickname] = useState(false);
  const [editingNickname, setEditingNickname] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);

  // 检测屏幕尺寸 - 同时考虑高度和宽度
  useEffect(() => {
    const checkScreenSize = () => {
      // iPhone SE: 375x667, iPhone 12/13/14: 390x844, iPhone 14 Pro: 393x852
      // 如果高度 <= 700 或宽度 <= 400，使用小屏样式
      const isSmall = window.innerHeight <= 700 || window.innerWidth <= 400;
      setIsSmallScreen(isSmall);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Toast 自动隐藏
  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast({ message: '', type: 'success', visible: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  // 显示 toast 提示
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type, visible: true });
  };

  // 获取用户选择的角色头像
  const getProfileAvatar = (): string => {
    const character = getSelectedCharacter();
    const resourceCharacter = CHARACTER_MAPPING[character];
    return `/compressed_output/processed_image_profile/${resourceCharacter}_profile.jpg`;
  };

  // 获取静态图片路径（用于邀请海报）- 使用 processed_image_profile 目录
  const getStaticMascotImage = (): string => {
    const character = getSelectedCharacter();
    const resourceCharacter = CHARACTER_MAPPING[character];
    return `/compressed_output/processed_image_profile/${resourceCharacter}_profile.jpg`;
  };

  // The high-fidelity mascot image for the poster
  const POSTER_MASCOT = "https://lh3.googleusercontent.com/aida-public/AB6AXuA46trIZajUdPDtcb5Mve4AANhBVcFPf7hD1VJlypb0dFYRxS2hXKwdShsNFVNhbqxXKQFSjVVMsE3mxGpTikZ_57rFFad-Wac1TeLu7mkLVUcNcXHe1dMp94PSQWv0zRukZyCVX_0DBZ2YWtZ3z95XJoYIk-kHHf_jOtCXVxwOascf_uy1-xN9B6LDuY7LUnDzKY4Em18_6PP7pnkilqsGpMh1-4xyIUGnBpFdw5egLxog1wDMZwcwvb0tgobqJaobQeIGVn7VCUfO";

  // Get display name - prioritize profile.display_name, fallback to email prefix
  const getDisplayName = (): string => {
    if (profile?.display_name) {
      return profile.display_name;
    }
    if (user?.email) {
      const atIndex = user.email.indexOf('@');
      return atIndex > 0 ? user.email.substring(0, atIndex) : user.email;
    }
    return 'Loading...';
  };

  // Handle edit nickname
  const handleEditNickname = () => {
    setEditingNickname(profile?.display_name || '');
    setShowEditNickname(true);
  };

  // Handle save nickname
  const handleSaveNickname = async () => {
    const trimmedNickname = editingNickname.trim();
    
    if (!trimmedNickname) {
      showToast('Nickname cannot be empty', 'error');
      return;
    }

    if (trimmedNickname.length < 2 || trimmedNickname.length > 20) {
      showToast('Nickname must be 2-20 characters', 'error');
      return;
    }

    setSavingNickname(true);
    try {
      const updatedProfile = await updateProfile({ display_name: trimmedNickname });
      setProfile(updatedProfile);
      setShowEditNickname(false);
      showToast('Nickname updated successfully!');
    } catch (error) {
      console.error('Failed to update nickname:', error);
      showToast('Update failed, please try again', 'error');
    } finally {
      setSavingNickname(false);
    }
  };

  // Generate poster image - 使用 html-to-image，真正的"显示什么样导出什么样"
  const generatePosterBlob = async (): Promise<Blob> => {
    const posterElement = document.getElementById('invite-poster-content');
    
    if (!posterElement) throw new Error('Poster element not found');

    // 使用 filter 选项排除关闭按钮，避免 UI 闪烁
    // pixelRatio: 3 for high quality (3x resolution)
    const dataUrl = await toPng(posterElement, { 
      pixelRatio: 3,
      filter: (node) => {
        // 排除关闭按钮及其子元素
        if (node instanceof HTMLElement) {
          return node.id !== 'invite-close-button';
        }
        return true;
      }
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  // Handle share image
  const handleShare = async () => {
    try {
      const blob = await generatePosterBlob();
      const file = new File([blob], 'evobook-invite.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Join me on EvoBook!',
          text: `Use code ${inviteData?.formatted_code} to get +500 XP!`,
        });
        showToast('Invite shared successfully!');
      } else {
        showToast('Share not supported. Try Download instead.', 'info');
      }
    } catch (error) {
      console.error('Failed to share:', error);
      showToast('Share failed. Please try again.', 'error');
    }
  };

  // Handle download image
  const handleDownload = async () => {
    try {
      const blob = await generatePosterBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evobook-invite-${inviteData?.invite_code || 'poster'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Image downloaded successfully!');
    } catch (error) {
      console.error('Failed to download:', error);
      showToast('Download failed. Please try again.', 'error');
    }
  };

  // Get invite link with configured domain
  const getInviteLinkWithDomain = (): string => {
    if (!inviteData?.invite_url) return '';
    
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    
    try {
      const url = new URL(inviteData.invite_url);
      const configuredUrl = new URL(appUrl);
      
      // Replace protocol and host with configured domain
      url.protocol = configuredUrl.protocol;
      url.host = configuredUrl.host;
      
      return url.toString();
    } catch (error) {
      console.error('Failed to parse invite URL:', error);
      return inviteData.invite_url;
    }
  };

  // Handle copy invite link
  const handleCopyLink = async () => {
    if (!inviteData?.invite_url) return;

    const inviteLink = getInviteLinkWithDomain();

    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast('Invite link copied to clipboard!');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
        showToast('Invite link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Failed to copy link', 'error');
      }
      
      document.body.removeChild(textArea);
    }
  };


  // Load profile stats and invite code from API
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getProfile();
        setProfile(data);
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };

    const loadStats = async () => {
      try {
        const data = await getProfileStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to load profile stats:', error);
      } finally {
        setLoading(false);
      }
    };

    const loadInviteCode = async () => {
      try {
        setLoadingInvite(true);
        const data = await getInviteCode();
        setInviteData(data);
      } catch (error) {
        console.error('Failed to load invite code:', error);
      } finally {
        setLoadingInvite(false);
      }
    };

    const loadCourses = async () => {
      try {
        const data = await getUserCourses();
        // 取前三个课程
        setRecentCourses(data.courses.slice(0, 3));
      } catch (error) {
        console.error('Failed to load courses:', error);
      }
    };

    loadProfile();
    loadStats();
    loadInviteCode();
    loadCourses();

    // Listen for study time updates from heartbeat
    const handleStudyTimeUpdate = (event: CustomEvent) => {
      if (stats) {
        const newSeconds = event.detail.total_study_seconds;
        setStats({
          ...stats,
          total_study_seconds: newSeconds,
          total_study_hours: Math.ceil(newSeconds / 3600),
        });
      }
    };

    window.addEventListener('study-time-updated', handleStudyTimeUpdate as EventListener);

    return () => {
      window.removeEventListener('study-time-updated', handleStudyTimeUpdate as EventListener);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FB] pb-32 overflow-x-hidden font-sans">
      {/* Header with explicit back navigation to dashboard */}
      <Header
        title="Profile"
        onBack={() => navigate('/courses')}
        rightAction={
          <button
            onClick={() => navigate('/assessment')}
            className="flex items-center gap-2 px-4 h-10 rounded-2xl bg-white border border-slate-100 active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>library_add</span>
            <span className="text-xs font-bold text-slate-700">Course</span>
          </button>
        }
      />

      <main className="px-6 space-y-6 mt-4">
        {/* User Profile Header - Square Avatar style */}
        <section className="flex flex-col items-center text-center pt-2">
          <div className="relative mb-6">
            <div className="w-32 h-32 bg-white rounded-[2.5rem] flex items-center justify-center relative z-10 shadow-xl border border-slate-50 overflow-hidden">
              <img
                src={getProfileAvatar()}
                alt="Profile Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Online indicator */}
            <div className="absolute -bottom-1 -right-1 bg-green-500 w-8 h-8 rounded-full border-4 border-[#F8F9FB] z-20"></div>
            {/* Subtle glow background */}
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl -z-10 scale-125"></div>
          </div>

          <div className="flex items-center gap-2 mb-1 justify-center">
            <h2 className="text-2xl font-black text-black uppercase tracking-tight break-all">
              {getDisplayName()}
            </h2>
            <button
              onClick={handleEditNickname}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all"
              aria-label="Edit Nickname"
            >
              <span className="material-symbols-outlined text-slate-600 text-[16px]">edit</span>
            </button>
          </div>
          <p className="text-slate-400 text-sm font-bold opacity-80">
            {loading ? 'Loading...' : (stats?.joined_date ? (() => {
              const date = new Date(stats.joined_date);
              const year = date.getFullYear();
              const month = date.toLocaleDateString('en-US', { month: 'long' });
              return `Joined ${month} ${year}`;
            })() : 'Joined recently')}
          </p>
        </section>

        {/* Stats Grid - Square card style */}
        <section className="grid grid-cols-3 gap-3">
          <div className="bg-white p-5 rounded-[2rem] flex flex-col items-center text-center shadow-sm border border-slate-50">
            <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
              <span className="material-symbols-outlined text-blue-500 text-xl">schedule</span>
            </div>
            <span className="text-xl font-black text-slate-900 leading-none">
              {loading ? '...' : (() => {
                const seconds = stats?.total_study_seconds || 0;
                const minutes = Math.floor(seconds / 60);
                const hours = Math.ceil(seconds / 3600);
                return minutes < 120 ? minutes : hours;
              })()}
            </span>
            <span className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-wider">
              {loading ? 'Study Time' : (() => {
                const seconds = stats?.total_study_seconds || 0;
                const minutes = Math.floor(seconds / 60);
                return minutes < 120 ? 'Study Mins' : 'Study Hrs';
              })()}
            </span>
          </div>
          <div className="bg-white p-5 rounded-[2rem] flex flex-col items-center text-center shadow-sm border border-slate-50">
            <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
              <span className="material-symbols-outlined text-orange-500 text-xl">workspace_premium</span>
            </div>
            <span className="text-xl font-black text-slate-900 leading-none">
              {loading ? '...' : stats?.completed_courses_count || 0}
            </span>
            <span className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-wider">Mastered</span>
          </div>
          <div className="bg-white p-5 rounded-[2rem] flex flex-col items-center text-center shadow-sm border border-slate-50">
            <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
              <span className="material-symbols-outlined text-purple-500 text-xl">leaderboard</span>
            </div>
            <span className="text-xl font-black text-slate-900 leading-none">
              {loading ? '...' : (stats?.global_rank ? `#${stats.global_rank}` : 'N/A')}
            </span>
            <span className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-wider">Global Rank</span>
          </div>
        </section>

        {/* Invite Friends Section - Lavender style */}
        <section className="space-y-3">
          <div className="bg-[#EEF1FF] p-5 rounded-[2rem] border border-primary/10 flex items-center justify-between shadow-sm">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-base font-black tracking-tight text-slate-900">Invite Friends</span>
                <span className="text-[10px] font-black bg-white text-primary border border-primary/20 px-2 py-0.5 rounded-lg">+500 XP</span>
              </div>
              <span className="text-xs font-bold text-slate-500">Code: <span className="text-slate-900 font-black">{loadingInvite ? 'Loading...' : (inviteData?.formatted_code || 'N/A')}</span></span>
            </div>
            <button
              onClick={() => setShowInvite(true)}
              className="h-10 px-6 bg-black text-white rounded-full font-black text-[13px] active:scale-95 transition-all shadow-lg"
            >
              Invite
            </button>
          </div>
        </section>

        {/* Menu Options Section */}
        <section className="pb-10">
          <div className="bg-white p-2 rounded-[2.5rem] shadow-sm border border-slate-50">
            <button className="w-full flex items-center justify-between py-4 px-5 hover:bg-slate-50 rounded-2xl transition-colors">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-slate-400 text-xl">shield</span>
                <span className="text-[15px] font-black text-slate-800">Privacy</span>
              </div>
              <span className="material-symbols-outlined text-slate-300 text-lg">chevron_right</span>
            </button>
            <div className="h-px bg-slate-100/50 mx-5 my-1"></div>
            <button
              onClick={async () => {
                localStorage.clear();
                await signOut();
                navigate('/login', { replace: true });
              }}
              className="w-full flex items-center justify-between py-4 px-5 hover:bg-rose-50 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-rose-500 text-xl">logout</span>
                <span className="text-[15px] font-black text-slate-800">Logout</span>
              </div>
              <span className="material-symbols-outlined text-rose-100 text-xl">logout</span>
            </button>
          </div>
        </section>
      </main>

      {/* Social Invitation Poster Modal Overlay */}
      {showInvite && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">

          {/* Poster Content Card - 横向布局优化，响应式尺寸 */}
          <div 
            id="invite-poster-content" 
            className={`w-full ${isSmallScreen ? 'max-w-[360px]' : 'max-w-[420px]'} bg-gradient-to-br from-purple-50 via-purple-100/80 to-indigo-50 rounded-[3.5rem] shadow-2xl relative overflow-hidden flex flex-col animate-in zoom-in duration-400`}
          >

            {/* Close Button Inside Card (X icon) */}
            <button
              id="invite-close-button"
              onClick={() => setShowInvite(false)}
              className="absolute top-5 right-5 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center z-[110] active:scale-90 shadow-lg border border-slate-100"
            >
              <span className="material-symbols-outlined text-slate-700 text-[22px] font-bold">close</span>
            </button>

            {/* Top Section: 头像在左上角，右边是 INVITED BY + 用户名 + 二维码 */}
            {/* items-stretch 让右侧列自动和头像等高，保证底部对齐 */}
            <div className={`${isSmallScreen ? 'p-5' : 'p-7'} flex ${isSmallScreen ? 'gap-3' : 'gap-4'} items-stretch`}>
              {/* Left: Mascot - 正方形，响应式 */}
              <div className="flex-shrink-0">
                <div className={`relative ${isSmallScreen ? 'w-[110px] h-[110px]' : 'w-[140px] h-[140px]'} bg-[#223344] rounded-2xl overflow-hidden shadow-xl ${isSmallScreen ? 'border-[3px]' : 'border-4'} border-white/20`}>
                  <img
                    alt="Mascot"
                    className="w-full h-full object-cover"
                    src={getStaticMascotImage()}
                  />
                  {/* Floating sparkle icon badge */}
                  <div className={`absolute ${isSmallScreen ? '-right-1.5 -top-1.5 w-9 h-9' : '-right-2 -top-2 w-11 h-11'} bg-white rounded-xl shadow-lg flex items-center justify-center rotate-12 z-20 border border-slate-50`}>
                    <span className={`material-symbols-outlined text-primary ${isSmallScreen ? 'text-lg' : 'text-xl'}`} style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  </div>
                </div>
              </div>

              {/* Right: Info + QR - 通过 items-stretch 自动和头像等高 */}
              <div className="flex-1 flex flex-col min-w-0 justify-between">
                {/* INVITED BY + 用户名 */}
                <div>
                  <p className={`${isSmallScreen ? 'text-[8px]' : 'text-[9px]'} font-black uppercase tracking-[0.4em] text-primary/40 mb-1.5`}>Invited By</p>
                  <h1 className={`${isSmallScreen ? 'text-xl' : 'text-2xl'} font-black text-slate-900 tracking-tight leading-tight truncate`}>
                    {getDisplayName()}
                  </h1>
                </div>

                {/* QR Code - justify-between 自动推到底部，和头像底边对齐 */}
                <div className={`${isSmallScreen ? 'w-[70px] h-[70px] p-1.5' : 'w-[86px] h-[86px] p-2'} bg-white rounded-xl border-2 border-slate-200 flex items-center justify-center shadow-lg`}>
                  {inviteData ? (
                    <QRCodeSVG 
                      value={getInviteLinkWithDomain()}
                      size={isSmallScreen ? 58 : 72}
                      level="H"
                      includeMargin={false}
                    />
                  ) : (
                    <div className="text-slate-300 text-[10px]">...</div>
                  )}
                </div>
              </div>
            </div>

            {/* Reward Pill - 响应式尺寸 */}
            <div className={`${isSmallScreen ? 'px-5 pb-3' : 'px-7 pb-5'}`}>
              <div className={`w-full bg-[#FFFBEB] ${isSmallScreen ? 'rounded-[18px] p-2.5' : 'rounded-[22px] p-4'} flex items-center ${isSmallScreen ? 'gap-2' : 'gap-3'} border border-amber-100/60 shadow-sm`}>
                <div className={`${isSmallScreen ? 'w-8 h-8' : 'w-10 h-10'} bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0`}>
                  <span className={`material-symbols-outlined text-amber-500 ${isSmallScreen ? 'text-lg' : 'text-xl'}`} style={{ fontVariationSettings: "'FILL' 1" }}>card_giftcard</span>
                </div>
                <div className="flex-1 text-left">
                  <p className={`${isSmallScreen ? 'text-[10px]' : 'text-[12px]'} font-bold text-slate-800 leading-snug`}>
                    Help me get <span className="text-amber-500 font-black">+500 EXP</span>, and you'll get it too!
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom: Recent Courses - 响应式行高 */}
            <div className={`bg-white rounded-t-[2.5rem] rounded-b-[3.5rem] ${isSmallScreen ? 'p-5 pb-6' : 'p-7 pb-9'}`}>
              <h3 className={`text-center ${isSmallScreen ? 'text-[11px] mb-3' : 'text-[13px] mb-4'} font-black text-slate-400 uppercase tracking-wider`}>Recent Courses</h3>
              
              {recentCourses.length > 0 ? (
                <div className={isSmallScreen ? 'space-y-2' : 'space-y-3'}>
                  {recentCourses.slice(0, 3).map((course, index) => (
                    <div key={course.course_map_id} className={`flex items-center ${isSmallScreen ? 'gap-2 p-2.5' : 'gap-3 p-3.5'} bg-slate-50/80 rounded-xl border border-slate-100`}>
                      <div className={`${isSmallScreen ? 'w-7 h-7' : 'w-9 h-9'} bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <span className={`${isSmallScreen ? 'text-xs' : 'text-sm'} font-black text-primary`}>#{index + 1}</span>
                      </div>
                      <p className={`${isSmallScreen ? 'text-[12px]' : 'text-[14px]'} font-bold text-slate-700 leading-tight flex-1 overflow-hidden text-ellipsis whitespace-nowrap`}>
                        {course.map_meta.course_name}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-center ${isSmallScreen ? 'text-xs' : 'text-sm'} text-slate-400 font-medium`}>Start your learning journey</p>
              )}
            </div>

            {/* Background Glows */}
            <div id="bg-glow-1" className="absolute top-0 right-0 w-56 h-56 bg-primary/10 rounded-full blur-[90px] pointer-events-none"></div>
            <div id="bg-glow-2" className="absolute bottom-1/4 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[70px] pointer-events-none"></div>
          </div>

          {/* Action Buttons at the bottom */}
          <div className={`w-full ${isSmallScreen ? 'max-w-[360px]' : 'max-w-[420px]'} px-4 mt-6 space-y-3 animate-in slide-in-from-bottom-6 duration-500`}>
            {/* Share Image Button */}
            <button 
              onClick={handleShare}
              className="w-full bg-black py-4 rounded-[2rem] font-black text-white shadow-xl active:scale-[0.97] transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined text-white">share</span>
              <span className="text-[15px] tracking-tight">Share Image</span>
            </button>

            {/* Download and Copy Link Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {/* Download Image Button */}
              <button 
                onClick={handleDownload}
                className="bg-white py-3.5 rounded-[2rem] font-black text-slate-900 shadow-lg active:scale-[0.97] transition-all flex items-center justify-center gap-2 border border-slate-100"
              >
                <span className="material-symbols-outlined text-slate-700">download</span>
                <span className="text-[13px] tracking-tight">Download</span>
              </button>

              {/* Copy Link Button */}
              <button 
                onClick={handleCopyLink}
                className="bg-white py-3.5 rounded-[2rem] font-black text-slate-900 shadow-lg active:scale-[0.97] transition-all flex items-center justify-center gap-2 border border-slate-100"
              >
                <span className="material-symbols-outlined text-slate-700">link</span>
                <span className="text-[13px] tracking-tight">Copy Link</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Edit Nickname Modal */}
      {showEditNickname && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-slate-900 mb-6 text-center">Edit Nickname</h3>
            
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={editingNickname}
                  onChange={(e) => setEditingNickname(e.target.value)}
                  placeholder="Enter new nickname"
                  maxLength={20}
                  disabled={savingNickname}
                  className="w-full h-14 px-5 rounded-2xl border-2 border-slate-200 text-base font-bold placeholder:text-slate-300 focus:border-primary transition-all disabled:opacity-50"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className={`text-xs font-black ${editingNickname.length > 20 ? 'text-red-400' : 'text-slate-300'}`}>
                    {editingNickname.length}/20
                  </span>
                </div>
              </div>

              <p className="text-xs font-bold text-slate-400 text-center">
                2-20 characters, letters, numbers and symbols
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEditNickname(false)}
                  disabled={savingNickname}
                  className="flex-1 h-12 rounded-full font-bold text-slate-600 bg-slate-100 active:scale-95 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNickname}
                  disabled={savingNickname || !editingNickname.trim()}
                  className="flex-1 h-12 rounded-full font-bold text-white bg-charcoal active:scale-95 transition-all disabled:opacity-50 disabled:bg-slate-300"
                >
                  {savingNickname ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700">
            <span 
              className={`material-symbols-outlined text-xl ${
                toast.type === 'success' ? 'text-green-400' : 
                toast.type === 'error' ? 'text-red-400' : 
                'text-blue-400'
              }`} 
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {toast.type === 'success' ? 'check_circle' : 
               toast.type === 'error' ? 'error' : 
               'info'}
            </span>
            <span className="text-sm font-bold">{toast.message}</span>
          </div>
        </div>
      )}

      <BottomNav activeTab="courses" />
    </div>
  );
};

export default ProfileView;
