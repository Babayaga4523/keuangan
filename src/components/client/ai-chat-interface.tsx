'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat, Message } from 'ai/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, User, Bot, Loader2, RefreshCw, Plus, Trash2, Menu, MessageSquare, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';

const generateUUID = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const SUGGESTIONS = [
  { title: '📊 Analisis Arus Kas', desc: 'Cek apakah pemasukan & pengeluaran bulanan kamu sudah seimbang.', prompt: 'Bagaimana analisis cashflow bulanan saya sekarang?' },
  { title: '🛡️ Evaluasi Dana Darurat', desc: 'Hitung apakah tabungan saat ini cukup aman untuk kondisi darurat.', prompt: 'Apakah dana darurat saya sudah aman?' },
  { title: '📱 Rencana Beli iPhone', desc: 'Simulasikan rencana pembelian gadget impian kamu.', prompt: 'Saya berencana beli iPhone 15 Pro, apakah budget saya aman?' },
  { title: '💡 Saran Hemat Pengeluaran', desc: 'Dapatkan tips hemat konkret berdasarkan transaksi terakhir.', prompt: 'Berikan tips hemat berdasarkan pengeluaran saya.' }
];

const MemoizedMessageBubble = React.memo(({ message, isStreaming }: { message: Message; isStreaming?: boolean }) => {
  const isUser = message.role === 'user';
  const timeLabel = isUser ? 'You • Baru saja' : 'Opin AI • Baru saja';

  return (
    <div className={`flex gap-4 group ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar with status indicator */}
      <div className="relative shrink-0 mt-1">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs ${
          isUser ? 'bg-gradient-to-tr from-slate-200 to-[#d0e1fb] text-[#0b1c30]' : 'bg-black text-white'
        }`}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
        {!isUser && (
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white bg-emerald-500" />
        )}
      </div>

      {/* Bubble Container */}
      <div className={`flex-1 flex flex-col min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-xl p-4 sm:p-5 text-[13px] sm:text-[14px] leading-relaxed w-full max-w-[85%] min-w-0 transition-all ${
            isUser
              ? 'bg-black text-white rounded-tr-none hover:shadow-xs'
              : 'bg-[#f8fafc] border border-slate-200/65 text-[#191c1e] rounded-tl-none hover:shadow-xs'
          }`}
        >
          {isUser ? (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.experimental_attachments && message.experimental_attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {message.experimental_attachments.map((att, idx) => (
                    <div key={idx} className="max-w-[200px] rounded-lg overflow-hidden border border-slate-200/20 bg-slate-800/10">
                      <img src={att.url} alt={att.name || 'Attachment'} className="w-full h-auto max-h-40 object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={`markdown-body w-full overflow-hidden min-w-0 ${isStreaming ? 'streaming-caret' : ''}`}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-sm sm:text-base font-bold mb-3 mt-4 text-black first:mt-0 flex items-center gap-2 border-b border-slate-200/60 pb-1.5" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xs sm:text-sm font-bold mb-2.5 mt-3.5 text-black first:mt-0" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-xs font-bold mb-2 mt-3 text-slate-800 first:mt-0" {...props} />,
                  p: ({node, ...props}) => <p className="mb-3 leading-relaxed last:mb-0" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 mb-3" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-1 mb-3" {...props} />,
                  li: ({node, ...props}) => <li className="pl-1 text-slate-700" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold text-black bg-slate-200/40 px-1 rounded" {...props} />,
                  blockquote: ({node, ...props}) => (
                    <div className="bg-black text-white p-4.5 rounded-lg mt-3 border border-slate-800 shadow-xs">
                      <p className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-1">💡 Kesimpulan Penasihat</p>
                      <blockquote className="text-white font-semibold text-xs italic leading-relaxed" {...props} />
                    </div>
                  ),
                  code: ({node, inline, className, children, ...props}: any) => {
                    return inline 
                      ? <code className="bg-white border border-slate-200 text-black px-1 py-0.5 rounded font-mono text-[11px] font-semibold" {...props}>{children}</code>
                      : <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-[11px] my-3.5 shadow-sm border border-slate-800"><code {...props}>{children}</code></pre>;
                  },
                  table: ({node, ...props}) => (
                    <div className="w-full overflow-x-auto my-3 rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse min-w-[500px]" {...props} />
                    </div>
                  ),
                  th: ({node, ...props}) => <th className="bg-slate-50 font-bold p-2.5 text-xs text-black border-b border-slate-200" {...props} />,
                  td: ({node, ...props}) => <td className="p-2.5 text-xs border-b border-slate-100 last:border-0 text-slate-750" {...props} />,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <span className={`text-[10px] text-[#76777d] mt-1 block font-medium ${isUser ? 'mr-1 text-right' : 'ml-1'}`}>
          {timeLabel}
        </span>
      </div>
    </div>
  );
}, (prevProps, nextProps) => 
  prevProps.message.content === nextProps.message.content && 
  prevProps.message.role === nextProps.message.role && 
  prevProps.isStreaming === nextProps.isStreaming &&
  prevProps.message.experimental_attachments?.length === nextProps.message.experimental_attachments?.length
);

export default function AiChatInterface() {
  const [currentSessionId, setCurrentSessionId] = useState<string>('default');
  const [sessions, setSessionsList] = useState<Array<{ id: string; title: string }>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false); // start closed by default
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, error, setInput } = useChat({
    api: '/api/chat',
    body: { sessionId: currentSessionId },
    initialMessages: [],
    maxSteps: 5
  });

  const [isInitializing, setIsInitializing] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ url: string; name: string; contentType: string }>>([]);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatCanvasRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      if (file.size > 4 * 1024 * 1024) {
        alert(`Berkas ${file.name} melebihi batas ukuran 4MB.`);
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setAttachments(prev => [...prev, {
          url: base64,
          name: file.name,
          contentType: file.type
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        if (file.size > 4 * 1024 * 1024) {
          alert(`Berkas ${file.name} melebihi batas ukuran 4MB.`);
          continue;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setAttachments(prev => [...prev, {
            url: base64,
            name: file.name || `Pasted_Image_${Date.now()}.png`,
            contentType: file.type
          }]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== index));
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Browser Anda tidak mendukung Voice Input. Gunakan Chrome atau Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;
    
    if (attachments.length > 0) {
      handleSubmit(e, {
        experimental_attachments: attachments as any
      });
    } else {
      handleSubmit(e);
    }
    setAttachments([]);
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/chat/history?listSessions=true');
      if (res.ok) {
        const data = await res.json();
        setSessionsList(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat/history?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Failed to load session messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    async function fetchHistoryAndSessions() {
      try {
        const res = await fetch('/api/chat/history?sessionId=default');
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
            setTimeout(scrollToBottom, 100);
          } else {
            // Show welcome message if no history
            setMessages([
              {
                id: 'welcome',
                role: 'assistant',
                content: 'Selamat pagi, Yoga. Saya telah menganalisis profil keuangan Anda. Apakah Anda ingin mendiskusikan rencana pembelian aset baru atau melakukan evaluasi terhadap dana darurat Anda hari ini?'
              }
            ]);
          }
        }
        await fetchSessions();
      } catch (err) {
        console.error('Failed to load initial data:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    fetchHistoryAndSessions();
  }, [setMessages]);

  const scrollToBottom = () => {
    if (chatCanvasRef.current) {
      chatCanvasRef.current.scrollTop = chatCanvasRef.current.scrollHeight;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  };

  const handleScroll = () => {
    if (!chatCanvasRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatCanvasRef.current;
    // Show button if user scrolled up by more than 300px from the bottom
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 300;
    setShowScrollButton(!isNearBottom);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Refresh sessions list when AI finishes responding to update title dynamically
  useEffect(() => {
    if (!isLoading && messages.length > 1) {
      fetchSessions();
    }
  }, [isLoading, messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleNewChat = () => {
    const newId = generateUUID();
    setCurrentSessionId(newId);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Selamat pagi, Yoga. Saya telah menganalisis profil keuangan Anda. Apakah Anda ingin mendiskusikan rencana pembelian aset baru atau melakukan evaluasi terhadap dana darurat Anda hari ini?'
      }
    ]);
    setSessionsList(prev => [
      { id: newId, title: 'Obrolan Baru' },
      ...prev.filter(s => s.id !== newId)
    ]);
    // Close sidebar on mobile
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus sesi obrolan ini?')) {
      try {
        const res = await fetch(`/api/chat/history?sessionId=${sessionId}`, { method: 'DELETE' });
        if (res.ok) {
          if (sessionId === currentSessionId) {
            setCurrentSessionId('default');
            await loadSessionMessages('default');
          }
          await fetchSessions();
        }
      } catch (err) {
        console.error('Failed to delete session:', err);
      }
    }
  };

  const showSuggestions = messages.length === 1 && messages[0].id === 'welcome';

  return (
    <div className="flex h-full w-full bg-white relative overflow-hidden">
      {/* Sessions Sidebar */}
      <aside className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        fixed z-20 top-0 left-0 md:left-64 w-64 h-full border-r border-slate-200 bg-[#f7f9fb] transition-transform duration-300 ease-in-out flex flex-col shrink-0
      `}>
        {/* Sidebar Header with Obrolan Baru */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <button 
            onClick={handleNewChat}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-black text-white hover:bg-black/90 active:scale-95 transition-all text-xs font-bold rounded-lg shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Obrolan Baru</span>
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-hide">
          {sessions.map(s => {
            const isActive = s.id === currentSessionId;
            return (
              <div 
                key={s.id}
                onClick={async () => {
                  setCurrentSessionId(s.id);
                  await loadSessionMessages(s.id);
                  if (window.innerWidth < 768) {
                    setSidebarOpen(false);
                  }
                }}
                className={`
                  group flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] transition-all cursor-pointer border-r-2
                  ${isActive 
                    ? 'bg-slate-200/70 text-black border-black font-bold' 
                    : 'hover:bg-slate-200/30 text-slate-500 hover:text-black border-transparent font-medium'}
                `}
              >
                <div className="flex items-center gap-2 truncate flex-1 pr-1">
                  <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-black' : 'text-slate-400'}`} />
                  <span className="truncate">{s.title || 'Obrolan Baru'}</span>
                </div>
                {s.id !== 'default' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:bg-slate-200 p-1 rounded transition-all shrink-0 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Overlay for sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-10 bg-black/10 backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-white relative">
        {/* Top App Bar */}
        <header className="h-16 border-b border-[#c6c6cd] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-10 bg-white/85 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title="Menu Obrolan"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <Bot className="text-black h-5.5 w-5.5" />
              <h2 className="text-base sm:text-lg font-bold text-black tracking-tight">AI Financial Advisor</h2>
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-black transition-colors text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>History</span>
            </button>
            <div className="h-4 w-px bg-slate-300"></div>
            <button className="flex items-center gap-1.5 text-slate-500 hover:text-black transition-colors">
              <svg xmlns="http://www.w3.org/2008/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            </button>
          </div>
        </header>

        {isInitializing || isLoadingMessages ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3 bg-[#f8fafc]">
            <Loader2 className="h-8 w-8 animate-spin text-black" />
            <p className="text-sm text-[#76777d]">
              {isLoadingMessages ? 'Memuat pesan...' : 'Memuat riwayat obrolan...'}
            </p>
          </div>
        ) : (
          <>
            {/* Chat Canvas */}
            <section ref={chatCanvasRef} onScroll={handleScroll} className="flex-1 overflow-y-auto w-full min-w-0 p-6 bg-white scrollbar-hide flex flex-col justify-start">
              {showSuggestions ? (
                /* Centered Welcome Page (ChatGPT Style) */
                <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto px-4 py-8 sm:py-16 w-full my-auto">
                  {/* Bot Icon with Pulse Aura */}
                  <div className="relative mb-5 shrink-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black text-white flex items-center justify-center shadow-md relative z-10">
                      <Bot className="h-6 w-6 sm:h-7 sm:w-7" />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-black/10 animate-ping" />
                  </div>

                  {/* Greetings */}
                  <h3 className="text-xl sm:text-2xl font-bold text-black text-center tracking-tight mb-2">
                    Halo, Yoga 👋
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 text-center max-w-md mb-8 leading-relaxed font-medium">
                    Saya Opin, AI Financial Advisor pribadi kamu. Bagaimana kondisi keuangan kamu hari ini? Silakan tanya apa saja atau pilih saran topik di bawah:
                  </p>

                  {/* Suggestion Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
                    {SUGGESTIONS.map((s, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                          setInput(s.prompt);
                          if (textareaRef.current) textareaRef.current.focus();
                        }}
                        className="p-4 border border-slate-200/80 hover:border-black rounded-xl bg-slate-55 hover:bg-slate-100/50 cursor-pointer transition-all duration-200 group active:scale-[0.98] shadow-xs"
                      >
                        <h4 className="font-bold text-[12px] sm:text-xs text-black transition-colors flex items-center gap-2">
                          <MessageSquare className="h-3.5 w-3.5 text-slate-400 group-hover:text-black transition-colors shrink-0" />
                          {s.title}
                        </h4>
                        <p className="text-[11px] sm:text-[12px] text-slate-500 mt-1.5 leading-relaxed">{s.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Chat Message List */
                <div className="max-w-4xl mx-auto space-y-6 w-full">
                  {messages.map((message: Message, idx: number) => (
                    <MemoizedMessageBubble 
                      key={message.id} 
                      message={message} 
                      isStreaming={isLoading && idx === messages.length - 1 && message.role === 'assistant'}
                    />
                  ))}
                  
                  {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="flex gap-4 group">
                      <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shrink-0 mt-1">
                        <Bot className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1">
                        <div className="bg-[#f8fafc] border border-slate-200/60 rounded-xl p-5 flex items-center gap-2 max-w-[85%]">
                          <Loader2 className="h-4 w-4 animate-spin text-black" />
                          <span className="text-xs text-[#76777d] font-semibold">Menganalisis...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {error && (
                    <div className="p-4 text-sm text-red-750 bg-red-50 border border-red-200 rounded-xl max-w-4xl mx-auto">
                      {error.message.includes('Quota exceeded') || error.message.includes('429') 
                        ? 'Batas penggunaan AI gratis (Google Quota) Anda telah habis karena terlalu banyak request. Mohon tunggu sekitar 1 menit sebelum bertanya lagi.' 
                        : 'Terjadi gangguan koneksi ke server AI. Silakan coba beberapa saat lagi.'}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </section>

            {/* Floating Scroll-to-Bottom Button */}
            {showScrollButton && (
              <button
                type="button"
                onClick={() => {
                  scrollToBottom();
                  setShowScrollButton(false);
                }}
                className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-4 py-2 rounded-full bg-black text-white hover:bg-black/90 active:scale-95 shadow-md border border-slate-800 text-[11px] font-bold tracking-wide transition-all animate-bounce"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Pesan Terbaru</span>
              </button>
            )}

            {/* Message Input Area */}
            <footer className="p-6 border-t border-[#c6c6cd] bg-white shrink-0">
              <div className="max-w-4xl mx-auto">
                <form 
                  onSubmit={handleFormSubmit}
                  className="flex flex-col gap-2 p-2.5 border border-[#c6c6cd] rounded-xl bg-[#f7f9fb] focus-within:bg-white focus-within:border-black focus-within:ring-1 focus-within:ring-black transition-all shadow-sm"
                >
                  {/* File Input */}
                  <input 
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                  />

                  {/* Attachments Preview */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 border-b border-slate-200 w-full mb-2">
                      {attachments.map((att, idx) => (
                        <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group shadow-xs">
                          <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black text-white p-0.5 rounded-full shadow-xs active:scale-90 transition-all flex items-center justify-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-4 w-full">
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-[#76777d] hover:text-black hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                      title="Unggah Gambar/Struk"
                    >
                      <svg xmlns="http://www.w3.org/2008/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    </button>
                    
                    <textarea
                      ref={textareaRef}
                      className="flex-1 py-2 px-0 bg-transparent border-none focus:ring-0 resize-none font-medium text-[13px] sm:text-[14px] max-h-32 min-h-[40px] outline-none scrollbar-hide text-[#191c1e] placeholder-[#76777d]"
                      placeholder="Tanyakan soal saldo, target nabung, atau tips hemat..."
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (input.trim() || attachments.length > 0) {
                            e.currentTarget.form?.requestSubmit();
                          }
                        }
                      }}
                      onPaste={handlePaste}
                      rows={1}
                    />
                    
                    <div className="flex items-center gap-1 px-2 pb-1 shrink-0">
                      <button 
                        type="button" 
                        onClick={toggleListening}
                        className={`p-2 rounded-full transition-all shrink-0 ${
                          isListening 
                            ? 'bg-red-500 text-white animate-pulse shadow-md scale-110' 
                            : 'text-[#76777d] hover:text-black hover:bg-slate-100'
                        }`}
                        title={isListening ? "Sedang merekam (klik untuk selesai)..." : "Masukkan suara (Mic)"}
                      >
                        <svg xmlns="http://www.w3.org/2008/svg" viewBox="0 0 24 24" fill={isListening ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                      </button>
                      <button 
                        type="submit"
                        disabled={isLoading || (!input.trim() && attachments.length === 0)}
                        className="w-10 h-10 bg-black text-white flex items-center justify-center rounded transition-transform active:scale-95 shadow-lg disabled:opacity-50 disabled:active:scale-100"
                      >
                        <Send className="w-4 h-4 ml-0.5" />
                      </button>
                    </div>
                  </div>
                </form>
                <p className="text-center text-[10px] text-[#76777d] mt-4 uppercase tracking-tighter">
                  AI dapat melakukan kesalahan. Selalu periksa kembali perhitungan manual jika menyangkut keputusan besar.
                </p>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
