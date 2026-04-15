import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Loader2, Sparkles, X } from 'lucide-react';
import { float32ToPcm16, arrayBufferToBase64, base64ToArrayBuffer } from '@/lib/audio-utils';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef<number>(0);

  const startSession = async () => {
    try {
      setStatus('connecting');
      setError(null);

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            setStatus('connected');
            startMic();
          },
          onmessage: async (message) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const arrayBuffer = base64ToArrayBuffer(base64Audio);
              const pcmData = new Int16Array(arrayBuffer);
              audioQueueRef.current.push(pcmData);
              schedulePlayback();
            }

            if (message.serverContent?.interrupted) {
              stopPlayback();
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Lỗi kết nối âm thanh. Vui lòng thử lại.");
            setStatus('error');
          },
          onclose: () => {
            setStatus('idle');
            stopMic();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }, // Kore sounds nice for Vietnamese
          },
          systemInstruction: "Bạn là Linh, một trợ lý cá nhân thân thiện. Hãy trò chuyện với người dùng một cách tự nhiên bằng tiếng Việt. Giữ câu trả lời ngắn gọn và súc tích vì đây là cuộc hội thoại bằng giọng nói.",
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to start session:", err);
      setError("Không thể khởi động phiên trò chuyện.");
      setStatus('error');
    }
  };

  const startMic = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }

      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      
      // Using ScriptProcessorNode for simplicity in this environment
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        if (sessionRef.current && status === 'connected') {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = float32ToPcm16(inputData);
          const base64 = arrayBufferToBase64(pcm16.buffer);
          
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
          });
        }
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (err) {
      console.error("Mic access error:", err);
      setError("Không thể truy cập micro. Vui lòng kiểm tra quyền truy cập.");
    }
  };

  const stopMic = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
  };

  const schedulePlayback = () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    playNext();
  };

  const playNext = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    const pcmData = audioQueueRef.current.shift()!;
    
    if (!audioContextRef.current) return;

    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 0x8000;
    }

    const buffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);

    // Precise scheduling for gapless playback
    const now = audioContextRef.current.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now + 0.05; // Small buffer
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;

    source.onended = () => {
      playNext();
    };
  };

  const stopPlayback = () => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
    // In a real app, we'd also stop the current source node, but it's complex with scheduling
  };

  useEffect(() => {
    if (isOpen) {
      startSession();
    } else {
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      stopMic();
      stopPlayback();
      setStatus('idle');
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px] bg-tg-secondary-bg border-white/5 p-0 overflow-hidden rounded-container">
        <div className="p-8 flex flex-col items-center gap-8 min-h-[400px] justify-center relative">
          <div className="absolute top-4 right-4">
            <Button variant="ghost" size="icon" onClick={onClose} className="text-tg-hint hover:bg-white/5">
              <X size={20} />
            </Button>
          </div>

          <DialogHeader className="text-center">
            <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-tg-primary" />
              Trò chuyện với Linh
            </DialogTitle>
            <p className="text-xs text-tg-hint mt-1">Linh đang lắng nghe bạn...</p>
          </DialogHeader>

          <div className="relative flex items-center justify-center w-48 h-48">
            {/* Visualizer Rings */}
            <AnimatePresence>
              {isSpeaking && (
                <>
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 0.2 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full bg-tg-primary"
                  />
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 0.4 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut", delay: 0.5 }}
                    className="absolute inset-0 rounded-full bg-tg-primary"
                  />
                </>
              )}
            </AnimatePresence>

            <div className={`w-32 h-32 rounded-full flex items-center justify-center z-10 transition-all duration-500 ${
              status === 'connected' ? 'bg-tg-primary shadow-[0_0_30px_rgba(36,129,204,0.4)]' : 'bg-tg-card'
            }`}>
              {status === 'connecting' ? (
                <Loader2 className="w-12 h-12 text-white animate-spin" />
              ) : isSpeaking ? (
                <Volume2 className="w-12 h-12 text-white animate-bounce" />
              ) : (
                <Mic className={`w-12 h-12 text-white ${status === 'connected' ? 'animate-pulse' : 'opacity-50'}`} />
              )}
            </div>
          </div>

          <div className="text-center space-y-2">
            {status === 'connected' ? (
              <p className="text-sm font-medium text-tg-primary flex items-center gap-2 justify-center">
                <span className="w-2 h-2 rounded-full bg-tg-primary animate-ping" />
                Đang kết nối trực tiếp
              </p>
            ) : status === 'connecting' ? (
              <p className="text-sm text-tg-hint">Đang thiết lập đường truyền...</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <p className="text-sm text-tg-hint">Nhấn để bắt đầu</p>
            )}
          </div>

          <div className="flex gap-4">
            {status === 'error' && (
              <Button onClick={startSession} className="tg-button">
                Thử lại
              </Button>
            )}
            <Button variant="outline" onClick={onClose} className="border-white/10 hover:bg-white/5">
              Kết thúc
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
