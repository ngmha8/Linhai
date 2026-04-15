import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Reminder, Task } from '@/types';
import { toast } from 'sonner';
import { isPast, parseISO, isSameMinute, parse } from 'date-fns';

export const ProactiveReminderManager: React.FC = () => {
  const { user, preferences } = useAuth();
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const notifiedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // Listen to incomplete and unnotified reminders
    const remindersRef = collection(db, 'users', user.uid, 'reminders');
    const remindersQuery = query(
      remindersRef, 
      where('completed', '==', false)
    );

    const unsubReminders = onSnapshot(remindersQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder));
      setReminders(items);
    });

    // Listen to incomplete and unnotified tasks
    const tasksRef = collection(db, 'users', user.uid, 'tasks');
    const tasksQuery = query(
      tasksRef, 
      where('completed', '==', false)
    );

    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(items);
    });

    return () => {
      unsubReminders();
      unsubTasks();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const checkReminders = async () => {
      const now = new Date();

      // Check Reminders
      for (const reminder of reminders) {
        if (reminder.notified) continue;
        if (notifiedIds.current.has(reminder.id)) continue;

        const reminderTime = parseISO(reminder.time);
        if (isPast(reminderTime) || isSameMinute(now, reminderTime)) {
          await notifyUser(
            reminder.id, 
            'reminders', 
            `🔔 Nhắc nhở: ${reminder.title}`,
            `Đã đến lúc thực hiện: ${reminder.title}`
          );
        }
      }

      // Check Tasks
      for (const task of tasks) {
        if (task.notified) continue;
        if (notifiedIds.current.has(task.id)) continue;
        if (!task.startTime) continue;

        try {
          const taskDateTime = parse(`${task.date} ${task.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
          if (isPast(taskDateTime) || isSameMinute(now, taskDateTime)) {
            await notifyUser(
              task.id, 
              'tasks', 
              `📅 Lịch trình: ${task.title}`,
              `Bạn có lịch trình: ${task.title} vào lúc ${task.startTime}`
            );
          }
        } catch (e) {
          console.error("Error parsing task time:", e);
        }
      }
    };

    const notifyUser = async (id: string, collectionName: 'reminders' | 'tasks', toastMsg: string, chatMsg: string) => {
      if (!user) return;
      
      notifiedIds.current.add(id);
      
      try {
        // 1. Add message to chat
        const messagesRef = collection(db, 'users', user.uid, 'messages');
        await addDoc(messagesRef, {
          uid: user.uid,
          role: 'assistant',
          content: chatMsg,
          timestamp: new Date().toISOString()
        });

        // 2. Update item as notified
        const itemRef = doc(db, 'users', user.uid, collectionName, id);
        await updateDoc(itemRef, { notified: true });

        // 3. Show toast and play sound if enabled
        if (preferences?.notificationsEnabled) {
          toast(toastMsg, {
            description: "Linh vừa gửi tin nhắn nhắc nhở cho bạn.",
            duration: 5000,
          });
          
          // Play sound logic could go here
          if (preferences.notificationSound) {
            // playSound(preferences.notificationSound);
          }
        }
      } catch (error) {
        console.error(`Failed to notify for ${id}:`, error);
        notifiedIds.current.delete(id); // Allow retry
      }
    };

    const interval = setInterval(checkReminders, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [user, reminders, tasks, preferences]);

  return null; // This component doesn't render anything
};
