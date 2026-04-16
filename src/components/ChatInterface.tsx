import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Message as MessageType, LearnedPreference, Task, Reminder } from '@/types';
import { processUserMessage, extractPreferences } from '@/services/gemini';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User as UserIcon, Loader2, ThumbsUp, ThumbsDown, Brain, Mic, Paperclip, X as CloseIcon, FileText, Image as ImageIcon, Copy, Forward, Check, Trash2, Search, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { VoiceChat } from './VoiceChat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const ChatInterface: React.FC = () => {
  const { user, preferences, updatePreferences, runLearning } = useAuth();
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceChatOpen, setIsVoiceChatOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const messagesRef = collection(db, 'users', user.uid, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MessageType[];
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/messages`);
    });

    // Also fetch tasks and reminders for learning context
    const unsubTasks = onSnapshot(collection(db, 'users', user.uid, 'tasks'), (s) => {
      setTasks(s.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    });
    const unsubReminders = onSnapshot(collection(db, 'users', user.uid, 'reminders'), (s) => {
      setReminders(s.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
    });

    return () => {
      unsubscribe();
      unsubTasks();
      unsubReminders();
    };
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Periodically extract preferences (e.g., every 10 messages)
  useEffect(() => {
    if (messages.length > 0 && messages.length % 10 === 0) {
      handlePreferenceExtraction();
    }
  }, [messages.length]);

  const handlePreferenceExtraction = async () => {
    if (!user || !preferences) return;
    
    try {
      const newPrefs = await runLearning(messages, tasks, reminders);
      if (newPrefs && newPrefs.length > 0) {
        toast.info(`Linh đã học được ${newPrefs.length} sở thích mới của bạn!`, {
          icon: <Brain size={16} className="text-tg-primary" />
        });
      }
    } catch (error) {
      console.error("Learning failed:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const supportedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf', 'text/plain', 'text/csv', 'text/html', 'text/markdown'
    ];

    if (!supportedTypes.some(type => file.type === type || (type.startsWith('image/') && file.type.startsWith('image/')))) {
      toast.error("Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh, PDF hoặc tệp văn bản thuần túy.");
      return;
    }

    if (file.size > 700 * 1024) {
      toast.error("Tệp quá lớn. Vui lòng chọn tệp dưới 700KB để đảm bảo lưu trữ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      setAttachedFile({
        name: file.name,
        type: file.type,
        data: base64
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || !user) return;

    const userMessage = input.trim();
    const currentFile = attachedFile;
    
    setInput('');
    setAttachedFile(null);
    setIsTyping(true);

    const messagesRef = collection(db, 'users', user.uid, 'messages');

    try {
      // Save user message
      await addDoc(messagesRef, {
        uid: user.uid,
        role: 'user',
        content: userMessage || (currentFile ? `Đã gửi tệp: ${currentFile.name}` : ""),
        timestamp: new Date().toISOString(),
        ...(currentFile ? { file: currentFile } : {})
      });

      // Get AI response with learned preferences and file context
      const context = messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n');
      const aiResponse = await processUserMessage(
        userMessage || "Hãy phân tích tệp đính kèm này.", 
        context, 
        preferences?.learnedPreferences || [],
        currentFile || undefined
      );

      // Save AI message
      await addDoc(messagesRef, {
        uid: user.uid,
        role: 'assistant',
        content: aiResponse.text,
        timestamp: new Date().toISOString()
      });

      // Handle actions if any
      if (aiResponse.action) {
        const { type, data } = aiResponse.action;
        
        try {
          if (type === 'create_reminder' && data.title && data.time) {
            const remindersRef = collection(db, 'users', user.uid, 'reminders');
            await addDoc(remindersRef, {
              uid: user.uid,
              title: data.title,
              time: data.time,
              completed: false,
              createdAt: new Date().toISOString()
            });
            toast.success(`Đã tạo nhắc nhở: ${data.title}`);
          } else if (type === 'create_task' && data.title && data.date) {
            const tasksRef = collection(db, 'users', user.uid, 'tasks');
            await addDoc(tasksRef, {
              uid: user.uid,
              title: data.title,
              description: data.description || '',
              date: data.date,
              startTime: data.startTime || '',
              completed: false,
              createdAt: new Date().toISOString()
            });
            toast.success(`Đã thêm lịch trình: ${data.title}`);
          }
        } catch (actionError) {
          console.error("Action execution failed:", actionError);
          toast.error("Không thể thực hiện yêu cầu tự động.");
        }
      }

    } catch (error: any) {
      console.error("Chat error:", error);
      
      // Handle Gemini API Quota/Rate Limit errors
      if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        toast.error("Linh đang hơi bận vì nhận được quá nhiều yêu cầu. Bạn vui lòng đợi 1-2 phút rồi thử lại nhé!");
      } else {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/messages`);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'positive' | 'negative') => {
    if (!user) return;
    const msgRef = doc(db, 'users', user.uid, 'messages', messageId);
    try {
      await updateDoc(msgRef, { feedback });
      toast.success("Cảm ơn bạn đã phản hồi!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/messages/${messageId}`);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!user) return;
    try {
      const msgRef = doc(db, 'users', user.uid, 'messages', id);
      await deleteDoc(msgRef);
      toast.success("Đã xóa tin nhắn");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/messages/${id}`);
    }
  };

  const filteredMessages = messages.filter(msg => 
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Đã sao chép tin nhắn");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleForward = (text: string) => {
    setInput(text);
    toast.info("Đã chuyển tiếp tin nhắn vào ô nhập liệu");
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between bg-tg-secondary-bg/50">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-tg-hint" />
          <input
            type="text"
            placeholder="Tìm kiếm tin nhắn, lịch trình..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-sm text-tg-text focus:ring-0 placeholder:text-tg-hint w-full"
          />
        </div>
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-tg-hint hover:text-tg-text">
            <CloseIcon size={14} />
          </button>
        )}
      </div>

      <ScrollArea className="flex-1 p-4 bg-transparent overflow-y-auto">
        <div className="space-y-6">
          {searchQuery && filteredTasks.length > 0 && (
            <div className="mb-8 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-tg-primary px-2">Lịch trình tìm thấy</h3>
              {filteredTasks.map(task => (
                <div key={task.id} className="p-3 bg-tg-card rounded-lg border border-tg-primary/20 shadow-sm">
                  <p className="text-sm font-bold">{task.title}</p>
                  <p className="text-[10px] text-tg-hint">{task.date} {task.startTime}</p>
                </div>
              ))}
            </div>
          )}

          {(searchQuery ? filteredMessages : messages).map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-tg-primary text-white' : 'bg-tg-card text-tg-primary border border-white/5'}`}>
                  {msg.role === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
                </div>
                <div className="flex flex-col gap-2">
                  <div className={`p-4 shadow-xl ${msg.role === 'user' ? 'tg-message-user' : 'tg-message-bot'}`}>
                    {msg.file && (
                      <div className="mb-3 p-2 rounded bg-black/10 border border-white/5 flex items-center gap-3">
                        {msg.file.type.startsWith('image/') ? (
                          <div className="w-10 h-10 rounded overflow-hidden bg-tg-bg">
                            <img src={`data:${msg.file.type};base64,${msg.file.data}`} alt={msg.file.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <FileText className="w-6 h-6 text-tg-primary" />
                        )}
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[11px] font-bold truncate">{msg.file.name}</p>
                          <p className="text-[9px] opacity-50 uppercase">{msg.file.type.split('/')[1]}</p>
                        </div>
                      </div>
                    )}
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 px-1">
                    <span className="text-[9px] text-tg-hint opacity-50">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    
                    <div className="flex items-center gap-1 ml-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-6 w-6 text-tg-hint hover:text-tg-primary" />}>
                          <MoreVertical size={12} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={msg.role === 'user' ? 'end' : 'start'} className="bg-tg-card border-white/5 text-tg-text">
                          <DropdownMenuItem onClick={() => handleCopy(msg.content, msg.id)} className="gap-2 text-xs">
                            <Copy size={14} /> Sao chép
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleForward(msg.content)} className="gap-2 text-xs">
                            <Forward size={14} /> Chuyển tiếp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteMessage(msg.id)} className="gap-2 text-xs text-destructive focus:text-destructive">
                            <Trash2 size={14} /> Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {msg.role === 'assistant' && (
                        <>
                          <Tooltip>
                            <TooltipTrigger render={
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={`h-6 w-6 ${msg.feedback === 'positive' ? 'text-tg-success' : 'text-tg-hint'}`}
                                onClick={() => handleFeedback(msg.id, 'positive')}
                              />
                            }>
                              <ThumbsUp size={12} />
                            </TooltipTrigger>
                            <TooltipContent>Hữu ích</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger render={
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={`h-6 w-6 ${msg.feedback === 'negative' ? 'text-destructive' : 'text-tg-hint'}`}
                                onClick={() => handleFeedback(msg.id, 'negative')}
                              />
                            }>
                              <ThumbsDown size={12} />
                            </TooltipTrigger>
                            <TooltipContent>Không hữu ích</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-3 items-center bg-tg-card p-4 rounded-[20px_20px_20px_4px] border border-white/5 shadow-xl">
                <Loader2 className="w-4 h-4 animate-spin text-tg-primary" />
                <span className="text-xs text-tg-hint font-medium">Linh đang suy nghĩ...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      
      <div className="p-4 bg-transparent flex flex-col gap-2">
        <AnimatePresence>
          {attachedFile && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mx-2 p-2 bg-tg-card border border-tg-primary/20 rounded-lg flex items-center gap-3"
            >
              {attachedFile.type.startsWith('image/') ? (
                <div className="w-8 h-8 rounded overflow-hidden">
                  <img src={`data:${attachedFile.type};base64,${attachedFile.data}`} alt="preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <FileText className="w-5 h-5 text-tg-primary" />
              )}
              <span className="text-xs font-medium flex-1 truncate">{attachedFile.name}</span>
              <button onClick={() => setAttachedFile(null)} className="text-tg-hint hover:text-destructive p-1">
                <CloseIcon size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*,application/pdf,text/plain,text/csv,text/html,text/markdown"
          />
          <Button 
            onClick={() => setIsVoiceChatOpen(true)}
            variant="outline"
            className="h-12 w-12 p-0 flex items-center justify-center border-white/5 bg-tg-card hover:bg-white/5 text-tg-primary"
          >
            <Mic size={20} />
          </Button>
          <Button 
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="h-12 w-12 p-0 flex items-center justify-center border-white/5 bg-tg-card hover:bg-white/5 text-tg-hint"
          >
            <Paperclip size={20} />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={attachedFile ? "Thêm ghi chú cho tệp..." : "Nhắn tin cho Linh..."}
            className="flex-1 h-12 bg-tg-card border-white/5 text-tg-text rounded-card focus-visible:ring-tg-primary shadow-inner"
          />
          <Button onClick={handleSend} disabled={(!input.trim() && !attachedFile) || isTyping} className="tg-button h-12 w-12 p-0 flex items-center justify-center">
            <Send size={18} />
          </Button>
        </div>
      </div>

      <VoiceChat isOpen={isVoiceChatOpen} onClose={() => setIsVoiceChatOpen(false)} />
    </div>
  );
}
