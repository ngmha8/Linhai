import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserPreferences, LearnedPreference, Message, Task, Reminder } from '@/types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  preferences: UserPreferences | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => Promise<void>;
  runLearning: (messages: Message[], tasks: Task[], reminders: Reminder[]) => Promise<LearnedPreference[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  useEffect(() => {
    console.log("AuthContext: Initializing onAuthStateChanged...");
    
    // Set a safety timeout to prevent permanent loading screen
    const safetyTimeout = setTimeout(() => {
      console.warn("AuthContext: Safety timeout reached, forcing loading to false");
      setLoading(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("AuthContext: Auth state changed, user:", user?.uid || 'none');
      clearTimeout(safetyTimeout);
      setUser(user);
      
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        
        console.log("AuthContext: Setting up preferences listener...");
        const unsubPrefs = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            console.log("AuthContext: Preferences updated from Firestore");
            setPreferences(doc.data().preferences || null);
          }
          // Set loading false once we have the first snapshot (even if doc doesn't exist yet)
          setLoading(false);
        }, (error) => {
          console.error("AuthContext: Preferences listener error:", error);
          setLoading(false); // Still set loading false so app can show error or login
        });

        try {
          console.log("AuthContext: Checking user profile existence...");
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            console.log("AuthContext: Creating new user profile...");
            const initialPrefs: UserPreferences = {
              theme: 'telegram',
              language: 'vi',
              notificationsEnabled: true,
              learnedPreferences: []
            };
            await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              preferences: initialPrefs
            }, { merge: true });
          }
        } catch (error) {
          console.error("AuthContext: Error checking user profile:", error);
        }
      } else {
        setPreferences(null);
        setLoading(false);
      }
    }, (error) => {
      console.error("AuthContext: onAuthStateChanged error:", error);
      clearTimeout(safetyTimeout);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    // Add custom parameters to force account selection
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    try {
      console.log("AuthContext: Attempting login with popup...");
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed:", error);
      
      // Handle specific Google disallowed_useragent error
      if (error.code === 'auth/web-storage-unsupported' || error.code === 'auth/operation-not-supported-in-this-environment') {
        toast.error("Trình duyệt này không hỗ trợ đăng nhập Google trực tiếp. Hãy thử mở ứng dụng bằng trình duyệt bên ngoài (Chrome/Safari).");
      } else if (error.code === 'auth/popup-blocked') {
        toast.error("Cửa sổ đăng nhập bị chặn. Hãy cho phép bật popup và thử lại.");
      } else {
        toast.error("Đăng nhập thất bại. Vui lòng thử lại hoặc mở trong trình duyệt ngoài.");
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const updatePreferences = async (newPrefs: Partial<UserPreferences>) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await setDoc(userDocRef, {
        preferences: {
          ...preferences,
          ...newPrefs
        }
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const runLearning = async (messages: Message[], tasks: Task[], reminders: Reminder[]) => {
    if (!user || !preferences) return;
    
    const { learningService } = await import('@/services/learningService');
    const newPrefs = await learningService.extractPreferences(
      messages,
      tasks,
      reminders,
      preferences.learnedPreferences || []
    );

    if (newPrefs.length > 0) {
      const updatedLearnedPrefs = [
        ...(preferences.learnedPreferences || []),
        ...newPrefs
      ].slice(-50); // Keep last 50 insights

      // Update structured profile if personal info is found
      const updatedProfile = await learningService.updateProfile(
        preferences.profile || {},
        newPrefs
      );

      await updatePreferences({ 
        learnedPreferences: updatedLearnedPrefs,
        profile: updatedProfile
      });
      return newPrefs;
    }
    return [];
  };

  return (
    <AuthContext.Provider value={{ user, loading, preferences, login, logout, updatePreferences, runLearning }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
