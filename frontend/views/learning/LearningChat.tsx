
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Message {
  id: number;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

const LearningChat: React.FC = () => {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSharePreview, setShowSharePreview] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: 'ai',
      text: "I see you're studying Neural Networks Architecture. Do you have any specific questions about layers, weights, or how data flows? I'm here to help! 🦉",
      time: '10:24 AM'
    }
  ]);

  const suggestions = [
    "Explain backpropagation simply",
    "Difference between CNN and RNN",
    "What is a learning rate?"
  ];

  // Auto-scroll to bottom whenever messages or typing state changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = (text: string = inputValue) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now(),
      sender: 'user',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMsg: Message = {
        id: Date.now() + 1,
        sender: 'ai',
        text: `That's a great question about "${text}". In the context of Neural Networks, this refers to how the model optimizes its parameters. Would you like a deep dive or a summary?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  };

  const handleSuggestionClick = (s: string) => {
    setInputValue(s);
  };

  const POSTER_MASCOT = "https://lh3.googleusercontent.com/aida-public/AB6AXuBufi6vIupd79iwaMItI7pa065WbcFVQYd5Eb83gyp9Uu72dPsWgYGV6uhObIyOffgBUNsGns6F_BOXaFKsFFgmw1fKdqyqaJMe6665WGqw7KHwGVPLF2gZmkzMBPOPMf4vehRlyltv0HV6CCpxW_cWDoaqsNvsmcFd8UiG0z6dPvs4PdToxv50Lba_48fdo8EXhWPFsCPBbwQafVJHbAc2DPeOth4efr8KWT7Uin3IM_6luU4WxD_OKNYTsGnVR0FxlGov9KUMfl6U";

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] font-display relative overflow-hidden">
      {/* High-Fidelity Header */}
      <header className="sticky top-0 z-30 bg-background-light/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm active:scale-90 transition-transform"
          >
            <span className="material-symbols-rounded text-slate-400 text-xl">arrow_back_ios_new</span>
          </button>
          <div className="relative w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center border-2 border-white overflow-hidden">
            <img 
              alt="Athena" 
              src={POSTER_MASCOT} 
            />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#1a1b23]">Athena AI</h2>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-black/40 uppercase tracking-tight">
                Active Learning
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowSharePreview(true)}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-primary active:scale-90 transition-transform"
        >
          <span className="material-symbols-rounded font-bold">share</span>
        </button>
      </header>

      {/* Chat Content */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6 no-scrollbar scroll-smooth"
      >
        <div className="flex justify-center">
          <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest">Today • {messages[0]?.time}</span>
        </div>

        {/* AI Suggested Questions Card */}
        <div className="relative bg-white p-6 rounded-bubble shadow-soft flex flex-col gap-4 border border-white/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Suggested topics</span>
            <div className="w-6 h-6 rounded-full three-d-element"></div>
          </div>
          <p className="text-[15px] font-bold text-[#1a1b23]">What would you like to dive deeper into?</p>
          <div className="flex flex-col gap-2">
            {suggestions.map((q, idx) => (
              <button 
                key={idx}
                onClick={() => handleSuggestionClick(q)}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-100 text-sm font-bold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex flex-col gap-2 max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.sender === 'user' ? 'self-end' : 'self-start'}`}
          >
            <div className={`p-5 rounded-bubble shadow-soft relative ${
              msg.sender === 'user' 
                ? 'bg-charcoal text-white rounded-tr-none shadow-xl' 
                : 'bg-white border border-white/50 text-[#1a1b23]/80 rounded-tl-none'
            }`}>
              <p className="text-[15px] font-semibold leading-relaxed">
                {msg.text}
              </p>
              
              {msg.sender === 'ai' && (
                <>
                  <div className="absolute -right-2 -bottom-2 w-6 h-6 rounded-full three-d-element opacity-80"></div>
                  <div className="absolute -left-1 -bottom-3 w-4 h-4 rounded-full three-d-element opacity-40"></div>
                </>
              )}
            </div>
            <span className={`text-[10px] font-bold text-slate-300 ${msg.sender === 'user' ? 'text-right mr-1' : 'ml-1'}`}>
              {msg.sender === 'ai' ? 'Athena' : 'You'} • {msg.time}
            </span>
          </div>
        ))}

        {isTyping && (
          <div className="flex flex-col gap-2 self-start opacity-60 animate-in fade-in duration-300">
            <div className="bg-white px-4 py-3 rounded-bubble rounded-tl-none flex gap-1 shadow-soft border border-white/50">
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </main>

      {/* Input Area */}
      <div className="p-6 bg-background-light/95 backdrop-blur-xl border-t border-gray-100">
        <div className="relative flex items-center">
          <input 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="w-full bg-white h-[60px] pl-6 pr-16 rounded-input border-none shadow-soft text-[15px] placeholder:text-black/20 font-medium focus:ring-2 focus:ring-primary/20 transition-all" 
            placeholder="Type your answer..." 
            type="text"
          />
          <button 
            onClick={() => handleSend()}
            disabled={!inputValue.trim()}
            className={`absolute right-2 w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-90 ${
              inputValue.trim() ? 'bg-charcoal text-white hover:bg-black' : 'bg-slate-100 text-slate-300'
            }`}
          >
            <span className="material-symbols-rounded font-bold text-xl">arrow_upward</span>
          </button>
        </div>
        
        <div className="mt-4 flex justify-center gap-6">
          <button className="text-[10px] font-bold text-black/40 uppercase tracking-widest flex items-center gap-1 hover:text-black transition-colors">
            <span className="material-symbols-rounded text-sm">mic</span> Speak
          </button>
          <button className="text-[10px] font-bold text-black/40 uppercase tracking-widest flex items-center gap-1 hover:text-black transition-colors">
            <span className="material-symbols-rounded text-sm">image</span> Attach
          </button>
        </div>
      </div>

      {/* LONG IMAGE EXPORT OVERLAY */}
      {showSharePreview && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          
          {/* Close Button Top Right */}
          <button 
            onClick={() => setShowSharePreview(false)}
            className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center z-[110] bg-white/10 rounded-full backdrop-blur-md active:scale-90"
          >
            <span className="material-symbols-rounded text-white text-[28px] font-bold">close</span>
          </button>

          {/* Poster Scrollable Container */}
          <div className="w-full max-w-[340px] max-h-[80vh] overflow-y-auto no-scrollbar bg-vibrant-gradient rounded-[3rem] shadow-2xl relative flex flex-col animate-in zoom-in duration-400">
            
            {/* Poster Header */}
            <div className="p-8 pb-4 flex flex-col items-center border-b border-black/[0.03]">
              <div className="w-16 h-16 rounded-3xl bg-white shadow-xl flex items-center justify-center mb-4 border-2 border-white overflow-hidden p-1">
                 <img alt="Athena" src={POSTER_MASCOT} className="w-full h-full object-contain" />
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">EvoBook Intelligence</h1>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary mt-1">Deep Learning Module</p>
            </div>

            {/* Poster Conversation Stream */}
            <div className="p-8 flex flex-col gap-6">
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex flex-col gap-1.5 max-w-[95%] ${msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  <div className={`p-4 rounded-bubble shadow-sm relative text-[13px] font-bold leading-relaxed ${
                    msg.sender === 'user' 
                      ? 'bg-charcoal text-white rounded-tr-none' 
                      : 'bg-white border border-white/50 text-[#1a1b23]/80 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[9px] font-black text-slate-400 opacity-60">
                    {msg.sender === 'ai' ? 'ATHENA' : 'YOU'} • {msg.time}
                  </span>
                </div>
              ))}
            </div>

            {/* Poster Footer (QR & Branding) */}
            <div className="bg-white rounded-t-[3rem] p-10 mt-auto flex flex-col items-center border-t border-slate-50">
              <div className="text-center mb-6">
                <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">Join the Journey</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Unlock Personalized Learning</p>
              </div>

              {/* QR Code Grid */}
              <div className="w-20 h-20 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mb-6">
                 <div className="grid grid-cols-5 gap-1.5 w-full h-full">
                    {[...Array(25)].map((_, i) => (
                      <div key={i} className={`w-full h-full rounded-[1px] ${(i % 3 === 0 || i % 5 === 0) ? 'bg-slate-800' : 'bg-transparent'}`}></div>
                    ))}
                 </div>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-300">USER_ID: ATHENA_OWL_99</span>
              </div>
            </div>

            {/* Background Glows (Poster Internal) */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[50px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none"></div>
          </div>

          {/* Floating Action Button at Bottom */}
          <div className="w-full max-w-[340px] mt-8 animate-in slide-in-from-bottom-6 duration-500">
            <button className="w-full bg-white py-5 rounded-[2.5rem] font-black text-slate-900 shadow-2xl active:scale-[0.97] transition-all flex items-center justify-center gap-3">
              <span className="material-symbols-rounded text-slate-900 font-bold">download</span>
              <span className="text-[16px] tracking-tight">Save Long Image</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

export default LearningChat;
