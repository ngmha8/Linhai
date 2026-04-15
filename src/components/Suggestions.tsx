import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { learningService } from '@/services/learningService';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, Reminder } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, ArrowRight, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Suggestions: React.FC = () => {
  const { user, preferences } = useAuth();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const tasksQuery = query(
      collection(db, 'users', user.uid, 'tasks'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const remindersQuery = query(
      collection(db, 'users', user.uid, 'reminders'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });
    const unsubReminders = onSnapshot(remindersQuery, (snapshot) => {
      setReminders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder)));
    });

    return () => {
      unsubTasks();
      unsubReminders();
    };
  }, [user]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!preferences?.learnedPreferences || preferences.learnedPreferences.length === 0) return;
      
      setLoading(true);
      try {
        const result = await learningService.generateSuggestions(
          preferences.learnedPreferences,
          tasks,
          reminders
        );
        setSuggestions(result);
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if we have enough data and haven't fetched recently
    if (tasks.length > 0 || reminders.length > 0) {
      const timer = setTimeout(fetchSuggestions, 2000);
      return () => clearTimeout(timer);
    }
  }, [preferences?.learnedPreferences, tasks, reminders]);

  if (suggestions.length === 0 && !loading) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-4 h-4 text-tg-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-tg-hint">Gợi ý từ Linh</span>
      </div>

      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <Card className="tg-card border-dashed border-tg-primary/20 animate-pulse">
              <CardContent className="p-4 h-20 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-tg-primary border-t-transparent rounded-full animate-spin" />
              </CardContent>
            </Card>
          ) : (
            suggestions.map((suggestion, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="tg-card group hover:border-tg-primary/30 transition-colors cursor-pointer overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-tg-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="mt-1 w-6 h-6 rounded-full bg-tg-primary/10 flex items-center justify-center shrink-0">
                      <Lightbulb className="w-3.5 h-3.5 text-tg-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm leading-relaxed">{suggestion}</p>
                      <div className="flex items-center gap-1 text-[10px] text-tg-primary font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                        Thực hiện ngay <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
