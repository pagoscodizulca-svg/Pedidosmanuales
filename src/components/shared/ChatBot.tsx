import { apiFetch } from '../../utils/api';
import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '../../store/index';

export const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: '¡¡Hola! Soy Codibot. ¿Qué pedido necesitas buscar hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { orders } = useAppStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userText = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userText
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'bot', text: data.response }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Ocurrió un error de conexión al consultar el asistente.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón Flotante */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 rounded-full shadow-2xl transition-transform transform hover:scale-110 z-50 overflow-hidden border-2 border-codizulca-cyan hover:border-cyan-400 bg-slate-900 ${isOpen ? 'hidden' : 'flex items-center justify-center'}`}
      >
        <img src="/codibot.png" alt="Codibot" className="w-[60px] h-[60px] object-cover hover:opacity-90 transition-opacity" />
      </button>

      {/* Ventana de Chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[550px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-slate-200 flex flex-col">
          {/* Header */}
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 p-0.5 rounded-full border-2 border-codizulca-cyan">
                <img src="/codibot.png" alt="Codibot" className="w-8 h-8 rounded-full object-cover" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Codibot</h3>
                <p className="text-[10px] text-slate-300">Consulta toda la data del sistema</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${m.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-transparent border border-slate-200 shadow-sm'}`}>
                  {m.role === 'user' ? <User size={16} /> : <img src="/codibot.png" alt="Codibot" className="w-full h-full object-cover" />}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${m.role === 'user' ? 'bg-codizulca-cyan text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'}`}>
    {m.role === 'user' ? (
      m.text
    ) : (
      <ReactMarkdown 
        components={{
          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2" {...props} />,
          li: ({node, ...props}) => <li className="mb-1" {...props} />,
          strong: ({node, ...props}) => <strong className="font-bold text-slate-900" {...props} />
        }}
      >
        {m.text}
      </ReactMarkdown>
    )}
  </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 flex-row">
                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-cyan-100 text-cyan-700">
                  <Loader2 size={16} className="animate-spin" />
                </div>
                <div className="max-w-[75%] bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-tl-none px-4 py-2.5 text-sm shadow-sm">
                  Pensando...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Pregunta sobre algún pedido..."
              className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-codizulca-cyan/30"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-codizulca-cyan hover:bg-cyan-600 text-white p-2.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={18} className="ml-1" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
