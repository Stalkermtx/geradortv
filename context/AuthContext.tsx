import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'user' | 'admin';
export type SubscriptionStatus = 'active' | 'inactive' | 'expired';
export type PlanType = 'basic' | 'pro' | 'enterprise' | 'credits';

export interface Plan {
  id: PlanType;
  name: string;
  price: string;
  features: string[];
  maxUsage?: number; // For basic plan limit
  resolution: 'Low' | '4K';
  watermark: boolean;
  contactWhatsapp?: string; // For Enterprise plan
  credits?: number; // For credit-based plans
}

export interface User {
  id: string;
  email: string;
  password?: string;
  mustChangePassword?: boolean;
  name?: string;
  whatsapp?: string;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt?: string;
  activatedAt?: string;
  planId?: PlanType;
  usageCount: number;
  credits?: number; // Current credit balance
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
}

export interface GenerationHistory {
  id: string;
  userId: string;
  userEmail: string;
  prompt: string;
  imageUrl: string;
  timestamp: string;
  model: string;
}

interface AppData {
  users: User[];
  plans: Plan[];
  templates: MessageTemplate[];
  generations: GenerationHistory[];
}

interface AuthContextType {
  user: User | null;
  createUser: (email: string, password?: string, name?: string, whatsapp?: string, planId?: PlanType) => boolean;
  changePassword: (password: string) => void;
  login: (email: string, password?: string) => boolean;
  signup: (email: string, password?: string, name?: string, whatsapp?: string, planId?: PlanType) => boolean;
  logout: () => void;
  subscribe: (planId: PlanType) => void;
  users: User[]; // Mock database for admin
  updateUserStatus: (userId: string, status: SubscriptionStatus, planId?: PlanType) => void;
  updateUser: (userId: string, data: Partial<User>) => void;
  plans: Plan[];
  updatePlan: (planId: PlanType, updates: Partial<Plan>) => void;
  incrementUsage: () => void;
  templates: MessageTemplate[];
  saveTemplate: (template: MessageTemplate) => void;
  deleteTemplate: (id: string) => void;
  generations: GenerationHistory[];
  logGeneration: (prompt: string, imageUrl: string, model: string) => void;
  deleteUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [generations, setGenerations] = useState<GenerationHistory[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Fetch initial data from server
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/data');
        if (response.ok) {
          const data: AppData = await response.json();
          setUsers(data.users || []);
          setPlans(data.plans || []);
          setTemplates(data.templates || []);
          setGenerations(data.generations || []);
          
          // Restore user session from localStorage if exists
          const storedUser = localStorage.getItem('conextv_user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            // Verify user still exists in DB
            const dbUser = data.users?.find(u => u.id === parsedUser.id);
            if (dbUser) {
              setUser(dbUser);
            } else {
              localStorage.removeItem('conextv_user');
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoaded(true);
      }
    };
    fetchData();
  }, []);

  // Save data to server whenever it changes
  const saveData = async (newUsers: User[], newPlans: Plan[], newTemplates: MessageTemplate[], newGenerations: GenerationHistory[]) => {
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: newUsers,
          plans: newPlans,
          templates: newTemplates,
          generations: newGenerations
        })
      });
    } catch (error) {
      console.error("Failed to save data:", error);
    }
  };

  // Check for expiration and enforce admin password
  useEffect(() => {
    if (!isLoaded) return;
    
    const checkExpiration = () => {
      const now = new Date();
      let hasChanges = false;
      let currentUsers = [...users];

      // Enforce admin password
      const adminIndex = currentUsers.findIndex(u => u.email === 'admin@conextv.com');
      if (adminIndex !== -1 && currentUsers[adminIndex].password !== '10203040') {
        currentUsers[adminIndex] = { ...currentUsers[adminIndex], password: '10203040' };
        hasChanges = true;
      }

      const updatedUsers = currentUsers.map(u => {
        if (u.subscriptionStatus === 'active' && u.subscriptionExpiresAt) {
          if (new Date(u.subscriptionExpiresAt) < now) {
            hasChanges = true;
            return { ...u, subscriptionStatus: 'expired' as SubscriptionStatus };
          }
        }
        return u;
      });

      if (hasChanges) {
        setUsers(updatedUsers);
        saveData(updatedUsers, plans, templates, generations);
        
        if (user) {
          const updatedMe = updatedUsers.find(u => u.id === user.id);
          if (updatedMe) {
             if (updatedMe.subscriptionStatus !== user.subscriptionStatus || updatedMe.password !== user.password) {
                setUser(updatedMe);
                localStorage.setItem('conextv_user', JSON.stringify(updatedMe));
             }
          }
        }
      }
    };

    const interval = setInterval(checkExpiration, 60000); // Check every minute
    checkExpiration(); // Check on mount/update
    return () => clearInterval(interval);
  }, [users, user, isLoaded, plans, templates, generations]);

  const createUser = (email: string, password?: string, name?: string, whatsapp?: string, planId?: PlanType) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (users.some(u => u.email.toLowerCase() === normalizedEmail)) {
      alert("Email já cadastrado.");
      return false;
    }

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email: normalizedEmail,
      password: password?.trim(),
      mustChangePassword: true,
      name: name?.trim(),
      whatsapp: whatsapp?.trim(),
      role: 'user',
      subscriptionStatus: planId ? 'active' : 'inactive',
      usageCount: 0,
      planId: planId,
      subscriptionExpiresAt: planId && planId !== 'basic' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      activatedAt: planId ? new Date().toISOString() : undefined
    };
    
    if (planId) {
        const plan = plans.find(p => p.id === planId);
        if (plan?.credits) {
            newUser.credits = plan.credits;
        }
    }
    
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    saveData(updatedUsers, plans, templates, generations);
    return true;
  };

  const login = (email: string, password?: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password?.trim();

    let existingUser = users.find(u => u.email.toLowerCase() === normalizedEmail);
    
    if (existingUser) {
      if (existingUser.password && existingUser.password !== normalizedPassword) {
        console.log('Login failed: Password mismatch for', normalizedEmail);
        alert("Senha incorreta.");
        return false;
      }
      
      if (existingUser.subscriptionStatus === 'active' && existingUser.subscriptionExpiresAt) {
        if (new Date(existingUser.subscriptionExpiresAt) < new Date()) {
          existingUser = { ...existingUser, subscriptionStatus: 'expired' };
          updateUserStatus(existingUser.id, 'expired');
        }
      }

      setUser(existingUser);
      localStorage.setItem('conextv_user', JSON.stringify(existingUser));
      return true;
    }

    console.log('Login failed: User not found', normalizedEmail);
    alert("Usuário não encontrado.");
    return false;
  };

  const signup = (email: string, password?: string, name?: string, whatsapp?: string, planId?: PlanType) => {
    const success = createUser(email, password, name, whatsapp, planId);
    if (success) {
      return true;
    }
    return false;
  };

  const changePassword = (newPassword: string) => {
    if (!user) return;
    
    const updatedUser = { ...user, password: newPassword, mustChangePassword: false };
    setUser(updatedUser);
    localStorage.setItem('conextv_user', JSON.stringify(updatedUser));
    
    const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
    setUsers(updatedUsers);
    saveData(updatedUsers, plans, templates, generations);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('conextv_user');
  };

  const subscribe = (planId: PlanType) => {
    if (user) {
      const plan = plans.find(p => p.id === planId);
      const updatedUser = { 
        ...user, 
        subscriptionStatus: 'active' as SubscriptionStatus,
        planId,
        subscriptionExpiresAt: planId !== 'basic' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        activatedAt: new Date().toISOString(),
        credits: plan?.credits ? (user.credits || 0) + plan.credits : user.credits
      };
      setUser(updatedUser);
      localStorage.setItem('conextv_user', JSON.stringify(updatedUser));
      
      const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
      setUsers(updatedUsers);
      saveData(updatedUsers, plans, templates, generations);
    }
  };

  const updateUserStatus = (userId: string, status: SubscriptionStatus, planId?: PlanType) => {
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        const updates: Partial<User> = { subscriptionStatus: status };
        if (status === 'active') {
          updates.activatedAt = new Date().toISOString();
          if (planId) {
            updates.planId = planId;
            if (planId !== 'basic') {
               updates.subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            }
            const plan = plans.find(p => p.id === planId);
            if (plan?.credits) {
                updates.credits = (u.credits || 0) + plan.credits;
            }
          } else if (u.planId && u.planId !== 'basic') {
             updates.subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          }
        }
        return { ...u, ...updates };
      }
      return u;
    });
    setUsers(updatedUsers);
    saveData(updatedUsers, plans, templates, generations);

    if (user && user.id === userId) {
      const updatedMe = updatedUsers.find(u => u.id === userId);
      if (updatedMe) {
        setUser(updatedMe);
        localStorage.setItem('conextv_user', JSON.stringify(updatedMe));
      }
    }
  };

  const updateUser = (userId: string, data: Partial<User>) => {
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        return { ...u, ...data };
      }
      return u;
    });
    setUsers(updatedUsers);
    saveData(updatedUsers, plans, templates, generations);

    if (user && user.id === userId) {
      const updatedMe = updatedUsers.find(u => u.id === userId);
      if (updatedMe) {
        setUser(updatedMe);
        localStorage.setItem('conextv_user', JSON.stringify(updatedMe));
      }
    }
  };

  const deleteUser = (userId: string) => {
    const updatedUsers = users.filter(u => u.id !== userId);
    setUsers(updatedUsers);
    saveData(updatedUsers, plans, templates, generations);
  };

  const updatePlan = (planId: PlanType, updates: Partial<Plan>) => {
    const updatedPlans = plans.map(p => p.id === planId ? { ...p, ...updates } : p);
    setPlans(updatedPlans);
    saveData(users, updatedPlans, templates, generations);
  };

  const incrementUsage = () => {
    if (user) {
      const updatedUser = { ...user, usageCount: (user.usageCount || 0) + 1 };
      
      if (user.planId === 'credits' && user.credits && user.credits > 0) {
          updatedUser.credits = user.credits - 1;
      }

      setUser(updatedUser);
      localStorage.setItem('conextv_user', JSON.stringify(updatedUser));
      
      const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
      setUsers(updatedUsers);
      saveData(updatedUsers, plans, templates, generations);
    }
  };

  const saveTemplate = (template: MessageTemplate) => {
    let updatedTemplates;
    if (templates.find(t => t.id === template.id)) {
      updatedTemplates = templates.map(t => t.id === template.id ? template : t);
    } else {
      updatedTemplates = [...templates, template];
    }
    setTemplates(updatedTemplates);
    saveData(users, plans, updatedTemplates, generations);
  };

  const deleteTemplate = (id: string) => {
    const updatedTemplates = templates.filter(t => t.id !== id);
    setTemplates(updatedTemplates);
    saveData(users, plans, updatedTemplates, generations);
  };

  const logGeneration = (prompt: string, imageUrl: string, model: string) => {
    if (user) {
      const newGeneration: GenerationHistory = {
        id: Date.now().toString(),
        userId: user.id,
        userEmail: user.email,
        prompt,
        imageUrl,
        timestamp: new Date().toISOString(),
        model
      };
      const updatedGenerations = [newGeneration, ...generations];
      setGenerations(updatedGenerations);
      saveData(users, plans, templates, updatedGenerations);
    }
  };

  if (!isLoaded) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">Carregando...</div>;
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      createUser,
      changePassword,
      login, 
      signup,
      logout, 
      subscribe, 
      users, 
      updateUserStatus, 
      updateUser,
      deleteUser,
      plans, 
      updatePlan,
      incrementUsage,
      templates,
      saveTemplate,
      deleteTemplate,
      generations,
      logGeneration
    }}>
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
