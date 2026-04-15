import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Volume2, Shield, User as UserIcon, MapPin, Briefcase, Cake, Info, Palette, Moon, Sun, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

export const Settings: React.FC = () => {
  const { user, preferences, updatePreferences } = useAuth();

  if (!preferences) return null;

  const handleThemeChange = async (value: 'light' | 'dark' | 'telegram') => {
    try {
      await updatePreferences({ theme: value });
      toast.success(`Đã chuyển sang chủ đề: ${value === 'light' ? 'Sáng' : value === 'dark' ? 'Tối' : 'Telegram'}`);
    } catch (error) {
      toast.error("Không thể cập nhật chủ đề");
    }
  };

  const handleToggleNotifications = async (checked: boolean) => {
    try {
      await updatePreferences({ notificationsEnabled: checked });
      toast.success(checked ? "Đã bật thông báo" : "Đã tắt thông báo");
    } catch (error) {
      toast.error("Không thể cập nhật cài đặt");
    }
  };

  const handleSoundChange = async (value: string) => {
    try {
      await updatePreferences({ notificationSound: value });
      toast.success(`Đã đổi âm báo thành: ${value}`);
    } catch (error) {
      toast.error("Không thể cập nhật âm báo");
    }
  };

  return (
    <div className="space-y-6 p-6 pb-24">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-widest text-tg-hint font-bold">Cài đặt</span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Profile Section */}
        <Card className="tg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
              <UserIcon className="text-tg-primary w-4 h-4" />
              Tài khoản
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-tg-bg flex items-center justify-center overflow-hidden border border-white/5">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold">{user?.displayName?.charAt(0)}</span>
                )}
              </div>
              <div>
                <p className="font-bold">{preferences.profile?.name || user?.displayName}</p>
                <p className="text-xs text-tg-hint">{user?.email}</p>
              </div>
            </div>

            {/* Learned Profile Info */}
            {(preferences.profile?.occupation || preferences.profile?.address || preferences.profile?.birthday || preferences.profile?.bio) && (
              <div className="pt-4 border-t border-white/5 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-tg-hint mb-2">Thông tin Linh đã biết</p>
                
                {preferences.profile?.occupation && (
                  <div className="flex items-center gap-3 text-sm">
                    <Briefcase className="w-4 h-4 text-tg-primary opacity-70" />
                    <span>{preferences.profile.occupation}</span>
                  </div>
                )}
                
                {preferences.profile?.address && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-tg-primary opacity-70" />
                    <span>{preferences.profile.address}</span>
                  </div>
                )}

                {preferences.profile?.birthday && (
                  <div className="flex items-center gap-3 text-sm">
                    <Cake className="w-4 h-4 text-tg-primary opacity-70" />
                    <span>{preferences.profile.birthday}</span>
                  </div>
                )}

                {preferences.profile?.bio && (
                  <div className="flex items-start gap-3 text-sm">
                    <Info className="w-4 h-4 text-tg-primary opacity-70 mt-0.5" />
                    <span className="text-tg-hint italic">"{preferences.profile.bio}"</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card className="tg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
              <Palette className="text-tg-primary w-4 h-4" />
              Giao diện
            </CardTitle>
            <CardDescription className="text-[11px] text-tg-hint">
              Tùy chỉnh màu sắc hiển thị của Linh
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  preferences.theme === 'light' 
                    ? 'bg-tg-primary/10 border-tg-primary text-tg-primary' 
                    : 'bg-tg-bg border-white/5 text-tg-hint hover:bg-white/5'
                }`}
              >
                <Sun size={20} />
                <span className="text-[10px] font-bold uppercase">Sáng</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  preferences.theme === 'dark' 
                    ? 'bg-tg-primary/10 border-tg-primary text-tg-primary' 
                    : 'bg-tg-bg border-white/5 text-tg-hint hover:bg-white/5'
                }`}
              >
                <Moon size={20} />
                <span className="text-[10px] font-bold uppercase">Tối</span>
              </button>
              <button
                onClick={() => handleThemeChange('telegram')}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  preferences.theme === 'telegram' 
                    ? 'bg-tg-primary/10 border-tg-primary text-tg-primary' 
                    : 'bg-tg-bg border-white/5 text-tg-hint hover:bg-white/5'
                }`}
              >
                <Smartphone size={20} />
                <span className="text-[10px] font-bold uppercase">Telegram</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="tg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
              <Bell className="text-tg-primary w-4 h-4" />
              Thông báo
            </CardTitle>
            <CardDescription className="text-[11px] text-tg-hint">
              Quản lý cách Linh liên lạc với bạn
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications" className="text-sm font-semibold">Bật thông báo</Label>
                <p className="text-xs text-tg-hint">Nhận nhắc nhở và cập nhật từ Linh</p>
              </div>
              <Switch 
                id="notifications" 
                checked={preferences.notificationsEnabled}
                onCheckedChange={handleToggleNotifications}
                className="data-[state=checked]:bg-tg-primary"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-tg-hint" />
                <Label className="text-sm font-semibold">Âm thanh thông báo</Label>
              </div>
              <Select 
                disabled={!preferences.notificationsEnabled}
                value={preferences.notificationSound || 'default'} 
                onValueChange={handleSoundChange}
              >
                <SelectTrigger className="w-full bg-tg-bg border-white/5 rounded-card text-sm h-10">
                  <SelectValue placeholder="Chọn âm thanh" />
                </SelectTrigger>
                <SelectContent className="bg-tg-card border-white/5 text-tg-text">
                  <SelectItem value="default">Mặc định (Crystal)</SelectItem>
                  <SelectItem value="minimal">Tối giản (Pop)</SelectItem>
                  <SelectItem value="tech">Công nghệ (Pulse)</SelectItem>
                  <SelectItem value="gentle">Nhẹ nhàng (Chime)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Section */}
        <Card className="tg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
              <Shield className="text-tg-primary w-4 h-4" />
              Quyền riêng tư
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-tg-hint leading-relaxed">
              Dữ liệu của bạn được mã hóa và bảo mật. Linh chỉ học từ các cuộc trò chuyện của bạn để cung cấp trải nghiệm tốt hơn.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
