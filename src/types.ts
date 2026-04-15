export interface Reminder {
  id: string;
  userId: string;
  title: string;
  time: string; // ISO string
  completed: boolean;
  notified?: boolean;
  createdAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  completed: boolean;
  notified?: boolean;
  createdAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'telegram';
  language: string;
  notificationsEnabled: boolean;
  notificationSound?: string;
  learnedPreferences?: LearnedPreference[];
  profile?: UserProfile;
}

export interface UserProfile {
  name?: string;
  address?: string;
  occupation?: string;
  birthday?: string;
  importantDates?: { label: string; date: string }[];
  bio?: string;
}

export interface LearnedPreference {
  id: string;
  category: 'schedule' | 'communication' | 'interests' | 'personal_info' | 'work' | 'location' | 'general';
  content: string;
  confidence: number; // 0 to 1
  source: string; // e.g., "extracted from chat"
  updatedAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  feedback?: 'positive' | 'negative';
  file?: {
    name: string;
    type: string;
    data: string; // base64
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
        };
      };
    };
  }
}
