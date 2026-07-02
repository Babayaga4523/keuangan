'use client';

import { useChat, Message } from 'ai/react';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

export default function AiChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, error } = useChat({
    api: '/api/chat',
    initialMessages: []
  });

  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/chat/history');
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          } else {
            // Show welcome message if no history
            setMessages([
              {
                id: 'welcome',
                role: 'assistant',
                content: 'Halo! Saya Opin, asisten AI keuangan Anda. Data saldo dan rencana Anda sudah saya baca dengan aman di latar belakang. Ada yang ingin Anda tanyakan atau hitung hari ini?'
              }
            ]);
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    fetchHistory();
  }, [setMessages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {isInitializing ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Memuat riwayat obrolan...</p>
        </div>
      ) : (
        <>
          {/* Chat History Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message: Message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div className={`p-2 rounded-full flex-shrink-0 ${
              message.role === 'user' ? 'bg-black text-white' : 'bg-blue-600 text-white'
            }`}>
              {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl p-4 text-sm ${
                message.role === 'user'
                  ? 'bg-black text-white rounded-tr-sm'
                  : 'bg-white border border-[#e2e8f0] text-slate-800 rounded-tl-sm shadow-sm'
              }`}
            >
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="prose prose-sm prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:text-slate-800 max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full flex-shrink-0 bg-blue-600 text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-2xl rounded-tl-sm p-4 shadow-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-xs text-slate-500 font-medium">Berpikir...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">
            {error.message.includes('Quota exceeded') || error.message.includes('429') 
              ? 'Batas penggunaan AI gratis (Google Quota) Anda telah habis karena terlalu banyak request. Mohon tunggu sekitar 1 menit sebelum bertanya lagi.' 
              : 'Terjadi gangguan koneksi ke server AI. Silakan coba beberapa saat lagi.'}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-[#e2e8f0]">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) handleSubmit(e);
          }} 
          className="flex items-end gap-2"
        >
          <div className="relative flex-1">
            <textarea
              className="w-full min-h-[50px] max-h-[150px] resize-none rounded-xl border border-[#e2e8f0] bg-slate-50 p-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
              placeholder="Tanya soal saldo, target nabung, atau tips hemat..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) handleSubmit(e as any);
                }
              }}
              rows={1}
            />
          </div>
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="h-[50px] px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
          <p className="text-[10px] text-center text-slate-400 mt-2">
            AI dapat melakukan kesalahan. Selalu periksa kembali perhitungan manual jika menyangkut keputusan besar.
          </p>
        </div>
        </>
      )}
    </div>
  );
}
