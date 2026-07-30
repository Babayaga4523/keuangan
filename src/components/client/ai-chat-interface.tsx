'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat, Message } from 'ai/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Send, User, Bot, Loader2, RefreshCw, Plus, Trash2, Menu, MessageSquare, ChevronDown, Camera, Image as ImageIcon } from 'lucide-react';
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

const compressImageBase64 = (base64Str: string, maxWidth = 1024, maxHeight = 1024, quality = 0.65): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Maintain aspect ratio while scaling down
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

const ReceiptDraftCard = ({ 
  toolInvocation, 
  categories, 
  onSave 
}: { 
  toolInvocation: any; 
  categories: any[]; 
  onSave: (toolCallId: string, data: any, imageHash: string) => Promise<boolean> 
}) => {
  const result = toolInvocation.result;
  const draft = result?.draft;

  const [merchant, setMerchant] = useState(draft?.merchant || '');
  const [amount, setAmount] = useState(draft?.amount || 0);
  const [category, setCategory] = useState(draft?.category || 'Belanja');
  const [date, setDate] = useState(draft?.date || new Date().toISOString().split('T')[0]);
  
  // Local active accounts state to fetch live balances
  const [localAccounts, setLocalAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Sync draft data when loaded/changed
  useEffect(() => {
    if (draft) {
      setMerchant(draft.merchant || '');
      setAmount(draft.amount || 0);
      setCategory(draft.category || 'Belanja');
      setDate(draft.date || new Date().toISOString().split('T')[0]);
    }
  }, [draft]);

  // Fetch live accounts and balances on card mount
  useEffect(() => {
    async function loadAccounts() {
      setIsLoadingBalances(true);
      try {
        const res = await fetch('/api/accounts');
        if (!res.ok) throw new Error('Gagal mengambil data rekening dari server.');
        const resultData = await res.json();
        const data = resultData.accounts || [];
        
        setLocalAccounts(data);
        setLocalAccounts(data);
        // Smart Account Selection: match accountName from OCR draft if available, else default to CASH or first account
        let matchedAccount = null;
        if (draft?.accountName) {
          const search = draft.accountName.toLowerCase();
          matchedAccount = data.find((a: any) => a.name.toLowerCase().includes(search) || search.includes(a.name.toLowerCase()));
        }
        const defaultAcc = matchedAccount || data.find((a: any) => a.type === 'CASH') || data[0];
        if (defaultAcc) {
          setSelectedAccount(defaultAcc.id);
        }
      } catch (err: any) {
        console.error('Failed to load accounts for receipt draft card:', err?.message || err);
      } finally {
        setIsLoadingBalances(false);
      }
    }
    
    if (toolInvocation.state === 'result' && draft) {
      loadAccounts();
    }
  }, [toolInvocation.state, draft]);

  if (toolInvocation.state !== 'result' || !result) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-500 max-w-sm w-full">
        <Loader2 className="h-4 w-4 animate-spin text-black" />
        <span>Mengekstrak data struk...</span>
      </div>
    );
  }

  if (result.isDuplicate) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs max-w-sm w-full space-y-1">
        <p className="font-bold flex items-center gap-1">⚠️ Duplikat Terdeteksi</p>
        <p>Struk belanja ini sepertinya sudah pernah dicatat sebelumnya di sistem.</p>
      </div>
    );
  }

  if (!draft) return null;

  const handleConfirm = async () => {
    setIsSaving(true);
    setSaveError('');
    try {
      const success = await onSave(toolInvocation.toolCallId, {
        merchant,
        amount: Number(amount),
        category,
        date,
        accountId: selectedAccount,
        items: draft.items || [],
        receiptUrl: draft.receiptUrl
      }, draft.imageHash);
      if (success) {
        setIsSaved(true);
      }
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan transaksi.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isSaved) {
    return (
      <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs max-w-sm w-full space-y-1">
        <p className="font-bold">✅ Transaksi Tersimpan</p>
        <p className="font-semibold">{merchant} • Rp {amount.toLocaleString('id-ID')} ({category})</p>
      </div>
    );
  }

  const isLowConfidence = draft.confidence === 'low';
  const categoryOptions = categories && categories.length > 0
    ? categories.filter((c: any) => c.type === 'EXPENSE').map((c: any) => c.name)
    : ['Makanan & Minuman', 'Transportasi', 'Belanja Bulanan', 'Kesehatan', 'Hiburan', 'Tagihan & Utilitas', 'Lainnya'];

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs text-xs space-y-3.5 min-w-[300px] sm:min-w-[340px] max-w-sm w-full mt-2 text-slate-800">
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
        <span className="font-bold text-black text-sm">📋 Konfirmasi Draf Struk</span>
        {isLowConfidence && (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[9px] border border-amber-200">
            ⚠️ Cek Ulang (Gambar Buram)
          </span>
        )}
      </div>

      {saveError && (
        <div className="p-2 bg-red-50 text-red-800 rounded-lg text-[10px] border border-red-100">
          {saveError}
        </div>
      )}

      <div className="space-y-2.5">
        {/* Merchant */}
        <div className="flex flex-col gap-0.5">
          <label className="font-semibold text-slate-500 uppercase text-[9px]">Merchant / Toko</label>
          <input 
            type="text" 
            value={merchant} 
            onChange={e => setMerchant(e.target.value)}
            className="w-full px-2.5 py-1 border border-slate-200 rounded-lg focus:outline-none focus:border-black text-black bg-slate-50"
          />
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-0.5">
          <label className="font-semibold text-slate-500 uppercase text-[9px]">Nominal (Rupiah)</label>
          <input 
            type="number" 
            value={amount} 
            onChange={e => setAmount(Number(e.target.value))}
            className="w-full px-2.5 py-1 border border-slate-200 rounded-lg focus:outline-none focus:border-black font-semibold text-black bg-slate-50"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Category */}
          <div className="flex flex-col gap-0.5">
            <label className="font-semibold text-slate-500 uppercase text-[9px]">Kategori</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:border-black text-black bg-slate-50"
            >
              {categoryOptions.map((cat: string) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-0.5">
            <label className="font-semibold text-slate-500 uppercase text-[9px]">Tanggal</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="w-full px-2 py-0.5 border border-slate-200 rounded-lg focus:outline-none focus:border-black text-black bg-slate-50"
            />
          </div>
        </div>

        {/* Account Dropdown */}
        <div className="flex flex-col gap-0.5">
          <label className="font-semibold text-slate-500 uppercase text-[9px]">Pilih Rekening</label>
          {isLoadingBalances ? (
            <div className="h-8 border border-slate-200 rounded-lg flex items-center justify-center bg-slate-50">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
            </div>
          ) : (
            <select
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className="w-full px-2.5 py-1 border border-slate-200 rounded-lg focus:outline-none focus:border-black text-black bg-slate-50"
            >
              {localAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} (Rp {parseFloat(acc.balance).toLocaleString('id-ID')})</option>
              ))}
            </select>
          )}
        </div>

        {/* Item List Breakdown */}
        {draft.items && draft.items.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <label className="font-semibold text-slate-500 uppercase text-[9px] block mb-1">Rincian Barang</label>
            <div className="bg-slate-50/50 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1 border border-slate-100">
              {draft.items.map((item: any, idx: number) => {
                const hasItemDiscount = item.discount && item.discount > 0;
                const originalTotal = item.price * (item.qty || 1);
                const finalTotal = hasItemDiscount ? (item.finalPrice || originalTotal - item.discount) : originalTotal;
                return (
                  <div key={idx} className="text-[10px] text-slate-600 font-medium">
                    <div className="flex justify-between">
                      <span className="truncate pr-2">{item.name} {(item.qty || 1) > 1 ? `x${item.qty}` : ''}</span>
                      <span className={`font-mono shrink-0 ${hasItemDiscount ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        Rp {originalTotal.toLocaleString('id-ID')}
                      </span>
                    </div>
                    {hasItemDiscount && (
                      <div className="flex justify-between text-emerald-600">
                        <span className="text-[9px] pl-2">↳ Diskon item</span>
                        <span className="font-mono text-[10px]">Rp {finalTotal.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Financial Summary: Subtotal → Discount → Tax → Total */}
        {(draft.discount > 0 || draft.tax > 0 || draft.subtotal > 0) && (
          <div className="mt-2 pt-2 border-t border-dashed border-slate-200 space-y-1">
            <label className="font-semibold text-slate-500 uppercase text-[9px] block mb-1">Ringkasan</label>
            
            {draft.subtotal > 0 && (
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono">Rp {draft.subtotal.toLocaleString('id-ID')}</span>
              </div>
            )}

            {draft.discount > 0 && (
              <div className="flex justify-between text-[10px] text-emerald-600 font-semibold">
                <span className="flex items-center gap-1">
                  🏷️ {draft.discountLabel || 'Diskon'}
                </span>
                <span className="font-mono">- Rp {draft.discount.toLocaleString('id-ID')}</span>
              </div>
            )}

            {draft.tax > 0 && (
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>PPN / Pajak</span>
                <span className="font-mono">+ Rp {draft.tax.toLocaleString('id-ID')}</span>
              </div>
            )}

            <div className="flex justify-between text-xs text-black font-bold pt-1 border-t border-slate-200">
              <span>Total Bayar</span>
              <span className="font-mono">Rp {amount.toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}

        {/* Payment Method Badge */}
        {draft.paymentMethod && draft.paymentMethod !== 'LAINNYA' && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9px] font-semibold text-slate-500 uppercase">Pembayaran:</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[9px] border border-blue-200">
              {draft.paymentMethod === 'TUNAI' ? '💵 Tunai' :
               draft.paymentMethod === 'DEBIT' ? '💳 Debit' :
               draft.paymentMethod === 'KREDIT' ? '💳 Kredit' :
               draft.paymentMethod === 'E-WALLET' ? '📱 E-Wallet' :
               draft.paymentMethod === 'QRIS' ? '📲 QRIS' :
               draft.paymentMethod === 'TRANSFER' ? '🏦 Transfer' : draft.paymentMethod}
              {draft.accountName ? ` (${draft.accountName})` : ''}
            </span>
          </div>
        )}
      </div>

      <div className="pt-1.5 flex gap-2">
        <button
          type="button"
          disabled={isSaving || !selectedAccount}
          onClick={handleConfirm}
          className="flex-1 py-1.5 px-3 bg-black hover:bg-black/90 text-white font-bold rounded-lg text-center transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-98"
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin text-white" /> : null}
          <span>Simpan Transaksi</span>
        </button>
      </div>
    </div>
  );
};

const TransactionSuccessCard = ({ toolInvocation }: { toolInvocation: any }) => {
  const { args, result } = toolInvocation;
  if (!result || !result.success) return null;

  return (
    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs max-w-sm w-full space-y-1 mt-2 shadow-xs">
      <p className="font-bold flex items-center gap-1.5">
        <span className="text-sm">✅</span> 
        Berhasil Dicatat
      </p>
      <div className="pl-5 space-y-0.5 mt-1 text-[11px]">
        <p><span className="font-semibold text-slate-500 uppercase text-[9px] mr-1">Deskripsi:</span> {args.description}</p>
        <p><span className="font-semibold text-slate-500 uppercase text-[9px] mr-1">Nominal:</span> Rp {Number(args.amount).toLocaleString('id-ID')}</p>
        <p><span className="font-semibold text-slate-500 uppercase text-[9px] mr-1">Kategori:</span> {args.category}</p>
      </div>
    </div>
  );
};

const MemoizedMessageBubble = React.memo(({ 
  message, 
  isStreaming,
  categories,
  onSaveTransaction
}: { 
  message: Message; 
  isStreaming?: boolean;
  categories: any[];
  onSaveTransaction: (toolCallId: string, draftData: any, imageHash: string) => Promise<boolean>;
}) => {
  const isUser = message.role === 'user';
  const timeLabel = isUser ? 'You • Baru saja' : 'Opin AI • Baru saja';
  const toolInvocations = (message as any).toolInvocations || [];

  return (
    <div className={`flex gap-2.5 sm:gap-4 group ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar with status indicator */}
      <div className="relative shrink-0 mt-1">
        <div className={`w-7.5 h-7.5 sm:w-8 h-8 rounded-full flex items-center justify-center shadow-xs ${
          isUser ? 'bg-gradient-to-tr from-slate-200 to-[#d0e1fb] text-[#0b1c30]' : 'bg-black text-white'
        }`}>
          {isUser ? <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
        </div>
        {!isUser && (
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white bg-emerald-500" />
        )}
      </div>

      {/* Bubble Container */}
      <div className={`flex-1 flex flex-col min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-xl p-3.5 sm:p-5 text-[13px] sm:text-[14px] leading-relaxed w-full max-w-[94%] sm:max-w-[85%] min-w-0 transition-all ${
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
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
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

        {/* Custom tool card below the assistant bubble */}
        {!isUser && toolInvocations.length > 0 && (
          <div className="w-full flex flex-col items-start mt-2">
            {toolInvocations.map((toolInv: any) => {
              if (toolInv.toolName === 'extract_receipt_data') {
                return (
                  <ReceiptDraftCard 
                    key={toolInv.toolCallId}
                    toolInvocation={toolInv} 
                    categories={categories}
                    onSave={onSaveTransaction}
                  />
                );
              } else if (toolInv.toolName === 'add_transaction') {
                return (
                  <TransactionSuccessCard 
                    key={toolInv.toolCallId}
                    toolInvocation={toolInv} 
                  />
                );
              }
              return null;
            })}
          </div>
        )}

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
MemoizedMessageBubble.displayName = 'MemoizedMessageBubble';

export default function AiChatInterface() {
  const [currentSessionId, setCurrentSessionId] = useState<string>('default');
  const [sessions, setSessionsList] = useState<Array<{ id: string; title: string }>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false); // start closed by default
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    async function loadInitData() {
      try {
        const res = await fetch('/api/accounts');
        if (res.ok) {
          const result = await res.json();
          if (result.categories) setCategories(result.categories);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    }
    loadInitData();
  }, []);

  const handleSaveReceiptTransaction = async (toolCallId: string, draftData: any, imageHash: string) => {
    try {
      // Find category ID that matches category name
      let categoryId = '';
      if (categories.length > 0) {
        const catNameLower = (draftData.category || '').toLowerCase();
        const matchedCat = categories.find((c: any) => 
          c.type === 'EXPENSE' && 
          (c.name.toLowerCase().includes(catNameLower) || catNameLower.includes(c.name.toLowerCase()))
        ) || categories.find((c: any) => c.type === 'EXPENSE');
        if (matchedCat) categoryId = matchedCat.id;
      }

      // 1. Call actionCreateTransaction server action
      const { actionCreateTransaction } = await import('@/lib/actions');
      
      const descItems = draftData.items && draftData.items.length > 0
        ? draftData.items.map((i: any) => `${i.name} (x${i.qty || 1})`).join(', ')
        : '';
      const description = `[OCR] ${draftData.merchant}${descItems ? `: ${descItems}` : ''}`;

      // Fallback: If server tool result didn't include receiptUrl (e.g. stripped due to size limit), 
      // grab the image from the user's latest chat message attachments directly on the client.
      let finalReceiptUrl = draftData.receiptUrl;
      if (!finalReceiptUrl) {
        const lastUserMsg = messages.slice().reverse().find(m => m.role === 'user' && m.experimental_attachments && m.experimental_attachments.length > 0);
        if (lastUserMsg && lastUserMsg.experimental_attachments) {
          const imgAtt = lastUserMsg.experimental_attachments.find((att: any) => att.contentType?.startsWith('image/'));
          if (imgAtt) {
            finalReceiptUrl = imgAtt.url;
            console.log('Using client-side image attachment for receiptUrl');
          }
        }
      }

      console.log('Saving transaction with receiptUrl length:', finalReceiptUrl?.length || 0);

      const res = await actionCreateTransaction({
        accountId: draftData.accountId,
        categoryId: categoryId || undefined,
        amount: draftData.amount,
        type: 'EXPENSE',
        description,
        date: draftData.date,
        receiptUrl: finalReceiptUrl || undefined,
        tags: 'ocr, struk'
      });

      if (!res.success) {
        throw new Error(res.error || 'Gagal menyimpan transaksi.');
      }

      // 2. Insert receipt log to database using backend API
      try {
        await fetch('/api/receipts/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageHash,
            transactionId: res.data?.id,
            merchant: draftData.merchant,
            amount: draftData.amount,
            category: draftData.category,
            date: draftData.date,
            items: draftData.items || []
          })
        });
      } catch (logErr) {
        console.warn('Failed to insert receipt log:', logErr);
      }

      // Notify Opin via append
      append({
        role: 'user',
        content: `Saya telah menyetujui draf struk dari ${draftData.merchant} sebesar Rp ${draftData.amount.toLocaleString('id-ID')} kategori ${draftData.category} untuk dicatat.`
      });
      
      return true;
    } catch (err: any) {
      console.error('Error saving receipt transaction:', err);
      alert(err.message || 'Terjadi kesalahan saat menyimpan transaksi.');
      return false;
    }
  };

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, error, setInput, append } = useChat({
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);

  const scrollToBottom = () => {
    if (chatCanvasRef.current) {
      chatCanvasRef.current.scrollTop = chatCanvasRef.current.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  };
  const recognitionRef = useRef<any>(null);

  const messagesRef = useRef(messages);
  const isLoadingRef = useRef(isLoading);
  const currentSessionIdRef = useRef(currentSessionId);

  useEffect(() => {
    messagesRef.current = messages;
    isLoadingRef.current = isLoading;
    currentSessionIdRef.current = currentSessionId;
  }, [messages, isLoading, currentSessionId]);

  useEffect(() => {
    return () => {
      if (isLoadingRef.current) {
        const msgs = messagesRef.current;
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content.trim() !== '') {
          fetch('/api/chat/save-partial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: lastMsg.content,
              sessionId: currentSessionIdRef.current || 'default'
            }),
            keepalive: true
          }).catch(err => console.error('Failed to save partial message on unmount:', err));
        }
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        alert(`Berkas ${file.name} bukan gambar.`);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert(`Berkas ${file.name} terlalu besar (maksimal 10MB).`);
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const compressedBase64 = await compressImageBase64(base64);
          setAttachments(prev => [...prev, {
            url: compressedBase64,
            name: file.name,
            contentType: 'image/jpeg'
          }]);
        } catch (err) {
          console.error('Compression failed, using original:', err);
          setAttachments(prev => [...prev, {
            url: base64,
            name: file.name,
            contentType: file.type
          }]);
        }
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

        if (file.size > 10 * 1024 * 1024) {
          alert(`Berkas ${file.name} terlalu besar (maksimal 10MB).`);
          continue;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          try {
            const compressedBase64 = await compressImageBase64(base64);
            setAttachments(prev => [...prev, {
              url: compressedBase64,
              name: file.name || `Pasted_Image_${Date.now()}.png`,
              contentType: 'image/jpeg'
            }]);
          } catch (err) {
            console.error('Compression failed, using original:', err);
            setAttachments(prev => [...prev, {
              url: base64,
              name: file.name || `Pasted_Image_${Date.now()}.png`,
              contentType: file.type
            }]);
          }
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
    
    if (attachments.length > 0 && !input.trim()) {
      // Use append directly when there's no input text to avoid state sync issues
      append({
        role: 'user',
        content: 'Tolong periksa dan analisis struk belanja ini.',
        experimental_attachments: attachments as any
      });
      setInput('');
    } else {
      handleSubmit(e, {
        experimental_attachments: attachments.length > 0 ? (attachments as any) : undefined
      });
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
        setTimeout(scrollToBottom, 50);
        setTimeout(scrollToBottom, 150);
        setTimeout(scrollToBottom, 350);
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
            setTimeout(scrollToBottom, 50);
            setTimeout(scrollToBottom, 150);
            setTimeout(scrollToBottom, 350);
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
            <section ref={chatCanvasRef} onScroll={handleScroll} className="flex-1 overflow-y-auto w-full min-w-0 p-3.5 sm:p-6 bg-white scrollbar-hide flex flex-col justify-start">
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
                      categories={categories}
                      onSaveTransaction={handleSaveReceiptTransaction}
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
            <footer className="p-3 sm:p-6 border-t border-[#c6c6cd] bg-white shrink-0">
              <div className="max-w-4xl mx-auto">
                <form 
                  onSubmit={handleFormSubmit}
                  className="flex flex-col gap-1.5 p-2 sm:p-3 border border-[#c6c6cd] rounded-xl bg-[#f7f9fb] focus-within:bg-white focus-within:border-black focus-within:ring-1 focus-within:ring-black transition-all shadow-sm"
                >
                  <input 
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                  />

                  {/* Hidden File Input for Camera Direct Capture */}
                  <input 
                    type="file"
                    ref={cameraInputRef}
                    className="hidden"
                    accept="image/*"
                    capture="environment"
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
                            <svg xmlns="http://www.w3.org/2008/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-3 w-full">
                    {/* Attachment Popover Trigger */}
                    <div className="relative shrink-0">
                      <button 
                        type="button" 
                        onClick={() => setAttachMenuOpen(!attachMenuOpen)}
                        className={`p-2 rounded-lg transition-all shrink-0 flex items-center justify-center ${
                          attachMenuOpen ? 'bg-black text-white' : 'text-[#76777d] hover:text-black hover:bg-slate-100'
                        }`}
                        title="Lampirkan Foto atau Struk"
                      >
                        <Plus className={`w-5 h-5 transition-transform duration-200 ${attachMenuOpen ? 'rotate-45' : ''}`} />
                      </button>

                      {/* Attachment Popover Options Menu */}
                      {attachMenuOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-20" 
                            onClick={() => setAttachMenuOpen(false)} 
                          />
                          <div className="absolute bottom-12 left-0 z-30 w-52 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
                            <button
                              type="button"
                              onClick={() => {
                                cameraInputRef.current?.click();
                                setAttachMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-left"
                            >
                              <Camera className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>Ambil Foto (Kamera)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                fileInputRef.current?.click();
                                setAttachMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors text-left"
                            >
                              <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Pilih dari Galeri</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    
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
