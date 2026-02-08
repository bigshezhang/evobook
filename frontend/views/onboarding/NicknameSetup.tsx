import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { updateProfile } from '../../utils/api';
import { getSelectedCharacter } from '../../utils/mascotUtils';

const NicknameSetup: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取 email 前缀作为默认值提示
  const getDefaultNickname = (): string => {
    if (!user?.email) return '';
    const atIndex = user.email.indexOf('@');
    return atIndex > 0 ? user.email.substring(0, atIndex) : user.email;
  };

  // 获取吉祥物头像
  const getMascotAvatar = (): string => {
    const character = getSelectedCharacter();
    const mascotMap: Record<string, string> = {
      oliver: '/compressed_output/processed_image_profile/owl_profile.jpg',
      luna: '/compressed_output/processed_image_profile/bee_profile.jpg',
      bolt: '/compressed_output/processed_image_profile/sheep_profile.jpg',
    };
    return mascotMap[character] || mascotMap.oliver;
  };

  // 验证昵称
  const validateNickname = (value: string): boolean => {
    if (value.trim().length < 2) {
      setError('Nickname must be at least 2 characters');
      return false;
    }
    if (value.trim().length > 20) {
      setError('Nickname must be no more than 20 characters');
      return false;
    }
    setError(null);
    return true;
  };

  // 处理完成
  const handleComplete = async () => {
    const trimmedNickname = nickname.trim();
    
    if (!trimmedNickname) {
      setError('Please enter a nickname');
      return;
    }

    if (!validateNickname(trimmedNickname)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateProfile({ display_name: trimmedNickname });
      // 保存成功后跳转到伴侣选择页面
      navigate('/companion');
    } catch (err) {
      console.error('Failed to update nickname:', err);
      setError('Failed to save, please try again');
    } finally {
      setLoading(false);
    }
  };

  // 处理跳过
  const handleSkip = () => {
    // 直接跳转到伴侣选择页面，不保存昵称
    navigate('/companion');
  };

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNickname(value);
    if (error && value.trim().length >= 2 && value.trim().length <= 20) {
      setError(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] font-display">
      {/* Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {/* Mascot Avatar */}
        <div className="relative mb-8">
          <div className="w-32 h-32 bg-white rounded-[2.5rem] flex items-center justify-center relative z-10 shadow-2xl border-4 border-white overflow-hidden">
            <img
              src={getMascotAvatar()}
              alt="Mascot"
              className="w-full h-full object-cover"
            />
          </div>
          {/* Floating badge */}
          <div className="absolute -right-2 -top-2 w-10 h-10 bg-primary rounded-xl shadow-xl flex items-center justify-center rotate-12 z-20 border-2 border-white">
            <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              badge
            </span>
          </div>
          {/* Glow effect */}
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl -z-10 scale-125"></div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-black text-center text-slate-900 mb-3 tracking-tight">
          Choose Your Nickname!
        </h1>
        
        {/* Subtitle */}
        <p className="text-center text-slate-500 font-bold text-sm mb-8 max-w-xs">
          This will be your unique identity on EvoBook
        </p>

        {/* Input Area */}
        <div className="w-full max-w-sm space-y-4">
          {/* Input Field */}
          <div className="relative">
            <input
              type="text"
              value={nickname}
              onChange={handleInputChange}
              placeholder={getDefaultNickname() || 'Enter your nickname'}
              maxLength={20}
              disabled={loading}
              className={`w-full h-16 px-6 rounded-[1.5rem] border-2 text-lg font-bold placeholder:text-slate-300 transition-all shadow-lg focus:shadow-xl focus:scale-[1.02] disabled:opacity-50 ${
                error 
                  ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-400' 
                  : 'border-slate-200 bg-white text-slate-900 focus:border-primary'
              }`}
            />
            {/* Character counter */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className={`text-xs font-black ${nickname.length > 20 ? 'text-red-400' : 'text-slate-300'}`}>
                {nickname.length}/20
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl">
              <span className="material-symbols-outlined text-red-500 text-sm">error</span>
              <span className="text-xs font-bold text-red-700">{error}</span>
            </div>
          )}

          {/* Helper Text */}
          {!error && (
            <p className="text-xs font-bold text-slate-400 text-center">
              Suggestion: 2-20 characters, letters, numbers and symbols
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-sm mt-10 space-y-3">
          {/* Complete Button */}
          <button
            onClick={handleComplete}
            disabled={loading || !nickname.trim()}
            className={`w-full h-14 rounded-full font-black text-lg shadow-xl transition-all ${
              loading || !nickname.trim()
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-charcoal text-white active:scale-95 hover:shadow-2xl'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                <span>Saving...</span>
              </div>
            ) : (
              'Complete'
            )}
          </button>

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            disabled={loading}
            className="w-full h-12 rounded-full font-bold text-sm text-slate-600 bg-white border-2 border-slate-200 active:scale-95 transition-all shadow-sm disabled:opacity-50"
          >
            Skip, Set Up Later →
          </button>
        </div>
      </div>

      {/* Bottom decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-100/30 to-transparent pointer-events-none"></div>
    </div>
  );
};

export default NicknameSetup;
