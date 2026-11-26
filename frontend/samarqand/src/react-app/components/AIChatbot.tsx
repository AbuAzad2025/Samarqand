import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Minimize2, Maximize2, Sparkles, User } from 'lucide-react';
import { apiFetch } from '@/react-app/api/site';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'مرحباً! أنا المساعد الذكي لشركة سمر قند. كيف يمكنني مساعدتك اليوم؟ 🏗️',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isOpen && messages.length > 1) {
      setHasNewMessage(true);
    } else {
      setHasNewMessage(false);
    }
  }, [isOpen, messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) throw new Error('فشل الاتصال بالمساعد الذكي');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  assistantMessage += parsed.text;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = assistantMessage;
                    return newMessages;
                  });
                }
              } catch {
                // Ignore parsing errors
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى أو التواصل معنا مباشرة عبر الواتساب.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    'ما هي خدماتكم؟',
    'كم تكلفة بناء منزل؟',
    'ما هي مدة التنفيذ؟',
    'هل تقدمون استشارات مجانية؟',
  ];

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="فتح المساعد الذكي"
          title="المساعد الذكي"
          className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-r from-sq-green via-sq-black to-sq-red rounded-full shadow-2xl hover:shadow-3xl transition-all hover:scale-110 flex items-center justify-center group"
        >
          <Bot className="text-white" size={28} />
          {hasNewMessage && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
          )}
          <div className="absolute -top-2 -left-2">
            <Sparkles className="text-yellow-400 animate-pulse" size={20} />
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl transition-all ${
            isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
          } flex flex-col`}
          dir="rtl"
        >
          <div className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="text-white" size={20} />
              </div>
              <div>
                <h3 className="text-white font-bold">مساعد سمر قند الذكي</h3>
                <p className="text-white/80 text-xs">مدعوم بالذكاء الاصطناعي 🤖</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                aria-label={isMinimized ? "تكبير المحادثة" : "تصغير المحادثة"}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition"
              >
                {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="إغلاق المحادثة"
                className="text-white hover:bg-white/20 p-2 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === 'user'
                          ? 'bg-gray-200'
                          : 'bg-gradient-to-r from-sq-green via-sq-black to-sq-red'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <User className="text-gray-600" size={16} />
                      ) : (
                        <Bot className="text-white" size={16} />
                      )}
                    </div>
                    <div
                      className={`rounded-2xl p-3 max-w-[75%] ${
                        msg.role === 'user'
                          ? 'bg-sq-green text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-sq-green via-sq-black to-sq-red flex items-center justify-center">
                      <Bot className="text-white" size={16} />
                    </div>
                    <div className="bg-gray-100 rounded-2xl p-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce animation-delay-200" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce animation-delay-400" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Questions */}
              {messages.length === 1 && (
                <div className="px-4 pb-2">
                  <p className="text-xs text-gray-500 mb-2">أسئلة شائعة:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => setInput(q)}
                        className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={sendMessage} className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="اكتب رسالتك هنا..."
                    className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-sq-green"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    aria-label="إرسال الرسالة"
                    disabled={isLoading || !input.trim()}
                    className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white p-2 rounded-full hover:shadow-lg transition disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      <style>{`
        .animation-delay-200 {
          animation-delay: 0.2s;
        }
        .animation-delay-400 {
          animation-delay: 0.4s;
        }
      `}</style>
    </>
  );
}
