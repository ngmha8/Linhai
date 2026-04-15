/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ChatInterface } from '@/components/ChatInterface';
import { Dashboard } from '@/components/Dashboard';
import { Settings } from '@/components/Settings';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, LogOut, MessageSquare, LayoutDashboard, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { Toaster } from 'sonner';
import { motion } from 'motion/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProactiveReminderManager } from '@/components/ProactiveReminderManager';

function AppContent() {
  const { user, loading, preferences, login, logout } = useAuth();
  const [showForceStart, setShowForceStart] = React.useState(false);

  React.useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowForceStart(true), 6000);
      return () => clearTimeout(timer);
    } else {
      setShowForceStart(false);
    }
  }, [loading]);

  React.useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // If user hasn't set a theme yet, try to match Telegram's theme
      if (!preferences?.theme) {
        const tgTheme = tg.colorScheme === 'dark' ? 'dark' : 'light';
        document.documentElement.classList.add(tgTheme);
      }
    }

    if (preferences?.theme) {
      document.documentElement.classList.remove('light', 'dark', 'telegram');
      document.documentElement.classList.add(preferences.theme);
    } else if (!window.Telegram?.WebApp) {
      document.documentElement.classList.add('dark'); // Default for non-TG
    }
  }, [preferences?.theme]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tg-bg">
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-4">
            <Sparkles className="w-12 h-12 text-tg-primary animate-pulse" />
            <p className="text-tg-hint font-medium">Đang khởi động Linh...</p>
          </div>
          
          {showForceStart && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2"
            >
              <p className="text-[10px] text-tg-hint max-w-[200px] text-center">
                Có vẻ như quá trình khởi động đang mất nhiều thời gian hơn dự kiến.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.reload()}
                className="text-xs border-white/10 hover:bg-white/5"
              >
                Tải lại trang
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tg-bg p-4">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="space-y-2">
            <div className="w-20 h-20 bg-tg-primary rounded-3xl mx-auto flex items-center justify-center shadow-lg">
              <Sparkles className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Linh AI</h1>
            <p className="text-tg-hint">Trợ lý cá nhân thông minh của bạn trên Telegram</p>
          </div>
          
          <div className="bg-tg-card p-6 rounded-tg shadow-sm space-y-6 border border-white/5">
            <p className="text-sm text-tg-text">
              Đăng nhập để bắt đầu quản lý lịch trình, nhắc nhở và tự động hóa tác vụ cùng Linh.
            </p>
            <div className="space-y-3">
              <Button onClick={login} className="w-full tg-button flex items-center justify-center gap-2 py-6 text-lg">
                <LogIn size={20} />
                Đăng nhập với Google
              </Button>
              
              {window.Telegram?.WebApp && (
                <p className="text-[10px] text-tg-hint text-center px-4">
                  Nếu gặp lỗi 403, hãy nhấn vào dấu 3 chấm ở góc trên bên phải và chọn <b>"Open in Browser"</b> (Mở trong trình duyệt) để đăng nhập.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-tg-bg flex items-center justify-center p-0 sm:p-4">
        <ProactiveReminderManager />
        <div className="w-full max-w-[420px] h-full sm:h-[720px] bg-tg-secondary-bg sm:rounded-container shadow-2xl border border-white/5 flex flex-col relative overflow-hidden">
          <header className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-tg-primary to-[#5bc0de] flex items-center justify-center font-bold text-xl shadow-[0_0_15px_rgba(36,129,204,0.2)]">
              {user.displayName?.charAt(0) || 'A'}
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold">Chào, {user.displayName?.split(' ')[0]} 👋</h1>
              <p className="text-xs text-tg-hint">Linh AI đang sẵn sàng hỗ trợ</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="text-tg-hint hover:text-destructive">
              <LogOut size={18} />
            </Button>
          </header>

          <main className="flex-1 flex flex-col overflow-hidden">
            <Tabs defaultValue="chat" className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <TabsContent value="chat" className="h-full m-0 outline-none">
                  <ChatInterface />
                </TabsContent>
                <TabsContent value="dashboard" className="h-full m-0 outline-none overflow-y-auto">
                  <Dashboard />
                </TabsContent>
                <TabsContent value="settings" className="h-full m-0 outline-none overflow-y-auto">
                  <Settings />
                </TabsContent>
              </div>

              <div className="h-[72px] bg-tg-card border-t border-white/5 flex justify-around items-center px-4">
                <TabsList className="grid grid-cols-3 w-full bg-transparent gap-0">
                  <TabsTrigger value="chat" className="flex flex-col gap-1 data-[state=active]:text-tg-primary data-[state=active]:bg-transparent opacity-60 data-[state=active]:opacity-100 transition-opacity">
                    <MessageSquare size={20} />
                    <span className="text-[10px] font-bold">Trang chủ</span>
                  </TabsTrigger>
                  <TabsTrigger value="dashboard" className="flex flex-col gap-1 data-[state=active]:text-tg-primary data-[state=active]:bg-transparent opacity-60 data-[state=active]:opacity-100 transition-opacity">
                    <LayoutDashboard size={20} />
                    <span className="text-[10px] font-bold">Phân tích</span>
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="flex flex-col gap-1 data-[state=active]:text-tg-primary data-[state=active]:bg-transparent opacity-60 data-[state=active]:opacity-100 transition-opacity">
                    <SettingsIcon size={20} />
                    <span className="text-[10px] font-bold">Cài đặt</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </Tabs>
          </main>
        </div>
        <Toaster position="top-center" theme={preferences?.theme === 'light' ? 'light' : 'dark'} />
      </div>
    </TooltipProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
