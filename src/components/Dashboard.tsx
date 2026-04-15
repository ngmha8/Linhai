import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Reminder, Task, LearnedPreference } from '@/types';
import { Suggestions } from './Suggestions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Bell, CheckCircle2, Circle, Trash2, Clock, Search, X as CloseIcon } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export const Dashboard: React.FC = () => {
  const { user, preferences, updatePreferences } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;

    const remindersRef = collection(db, 'users', user.uid, 'reminders');
    const remindersQuery = query(remindersRef, orderBy('time', 'asc'));
    const unsubReminders = onSnapshot(remindersQuery, (snapshot) => {
      setReminders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Reminder[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/reminders`));

    const tasksRef = collection(db, 'users', user.uid, 'tasks');
    const tasksQuery = query(tasksRef, orderBy('date', 'asc'));
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/tasks`));

    return () => {
      unsubReminders();
      unsubTasks();
    };
  }, [user]);

  const toggleReminder = async (id: string, completed: boolean) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'reminders', id), { completed: !completed });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/reminders/${id}`);
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'tasks', id), { completed: !completed });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/tasks/${id}`);
    }
  };

  const deleteItem = async (type: 'reminders' | 'tasks', id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, type, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/${type}/${id}`);
    }
  };

  const filteredReminders = reminders.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6 pb-24">
      <div className="flex flex-col gap-4 mb-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-tg-hint font-bold">Sắp tới</span>
          <span className="tg-automation-badge">Đang hoạt động</span>
        </div>
        
        <div className="relative group">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tg-hint group-focus-within:text-tg-primary transition-colors" />
          <input
            type="text"
            placeholder="Tìm kiếm nhắc nhở, lịch trình..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-tg-card border border-white/5 rounded-xl py-2.5 pl-10 pr-10 text-sm text-tg-text focus:ring-1 focus:ring-tg-primary focus:border-tg-primary transition-all outline-none"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-tg-hint hover:text-tg-text"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>
      </div>

      <Suggestions />

      <div className="grid grid-cols-1 gap-4">
        <Card className="tg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
              <Bell className="text-tg-primary w-4 h-4" />
              Nhắc nhở
            </CardTitle>
            <Badge variant="secondary" className="bg-tg-bg text-tg-primary border-none text-[10px] font-bold">
              {filteredReminders.filter(r => !r.completed).length}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredReminders.length === 0 ? (
                <p className="text-sm text-tg-hint text-center py-4">
                  {searchQuery ? "Không tìm thấy kết quả." : "Chưa có nhắc nhở nào."}
                </p>
              ) : (
                filteredReminders.map(reminder => (
                  <div key={reminder.id} className="flex items-start gap-4 group">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(36,129,204,0.5)] ${reminder.completed ? 'bg-tg-hint shadow-none' : 'bg-tg-primary'}`} />
                      <div className="w-0.5 flex-1 bg-white/5 min-h-[20px]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-[15px] font-semibold ${reminder.completed ? 'line-through text-tg-hint' : ''}`}>
                          {reminder.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleReminder(reminder.id, reminder.completed)} className="text-tg-hint hover:text-tg-primary transition-colors">
                            {reminder.completed ? <CheckCircle2 className="w-4 h-4 text-tg-primary" /> : <Circle className="w-4 h-4" />}
                          </button>
                          <button onClick={() => deleteItem('reminders', reminder.id)} className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-tg-hint font-medium mt-1">
                        {format(new Date(reminder.time), 'HH:mm, dd/MM', { locale: vi })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="tg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
              <CalendarIcon className="text-tg-primary w-4 h-4" />
              Lịch trình
            </CardTitle>
            <Badge variant="secondary" className="bg-tg-bg text-tg-primary border-none text-[10px] font-bold">
              {filteredTasks.filter(t => !t.completed).length}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredTasks.length === 0 ? (
                <p className="text-sm text-tg-hint text-center py-4">
                  {searchQuery ? "Không tìm thấy kết quả." : "Chưa có lịch trình nào."}
                </p>
              ) : (
                filteredTasks.map(task => (
                  <div key={task.id} className="flex items-start gap-4 group">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(36,129,204,0.5)] ${task.completed ? 'bg-tg-hint shadow-none' : 'bg-tg-primary'}`} />
                      <div className="w-0.5 flex-1 bg-white/5 min-h-[20px]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-[15px] font-semibold ${task.completed ? 'line-through text-tg-hint' : ''}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleTask(task.id, task.completed)} className="text-tg-hint hover:text-tg-primary transition-colors">
                            {task.completed ? <CheckCircle2 className="w-4 h-4 text-tg-primary" /> : <Circle className="w-4 h-4" />}
                          </button>
                          <button onClick={() => deleteItem('tasks', task.id)} className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-tg-hint font-medium mt-1">
                        {format(new Date(task.date), 'dd MMMM', { locale: vi })}
                        {task.startTime && ` • ${task.startTime}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
