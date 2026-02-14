import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { ShiftForm } from './components/ShiftForm';
import { ShiftTypeForm } from './components/ShiftTypeForm';
import { ExpenseForm } from './components/ExpenseForm';
import { Shift, ShiftType, Expense, ViewState, COLORS, UserSettings } from './types';

// Capacitor Imports for Native Notifications
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// Fixed imports for better compatibility
import { 
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  eachMonthOfInterval,
  subHours,
  differenceInMinutes,
  isAfter,
  isBefore,
  parse,
  set
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { 
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  Trash2, Edit2, CircleDollarSign,
  TrendingDown, Download, Upload, Database,
  Monitor, FileDown, X, BellRing, Sparkles, Clock,
  Briefcase, Sun, Moon, Minus, AlertTriangle, Info, CheckCircle,
  CalendarOff, ArrowRightFromLine, Eraser
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line
} from 'recharts';

// Toast Component Interface
interface ToastData {
  id: number;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'info' | 'error';
}

export default function App() {
  const [view, setView] = useState<ViewState>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Data State
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  // Settings State
  const [settings, setSettings] = useState<UserSettings>({
    notificationsEnabled: false,
    notificationAdvanceHours: 2, 
    notificationSound: 'default',
    lastBackupDate: null,
    theme: 'dark', 
  });
  
  // UI State
  const [isShiftFormOpen, setIsShiftFormOpen] = useState(false);
  const [isShiftTypeFormOpen, setIsShiftTypeFormOpen] = useState(false);
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  
  const [editingShiftType, setEditingShiftType] = useState<ShiftType | undefined>(undefined);
  const [editingShift, setEditingShift] = useState<Shift | undefined>(undefined); // NEW: To handle shift editing
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // New State for Quick Add Modal in Calendar
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [preSelectedTypeId, setPreSelectedTypeId] = useState<string | undefined>(undefined);
  
  // NEW: State for Analytics List Modal
  const [isAnalyticsListOpen, setIsAnalyticsListOpen] = useState(false);

  // NEW: State for Delete Expense Modal
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Notification State to prevent duplicates during session
  const [notifiedShiftIds, setNotifiedShiftIds] = useState<string[]>([]);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toast/In-App Notification State
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Analytics Date State (Lifted for delete logic access)
  const [analyticsDate, setAnalyticsDate] = useState(new Date());

  // --- HELPER: TOAST MANAGEMENT ---
  const addToast = (title: string, message: string, type: ToastData['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message, type }]);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const playNotificationSound = () => {
    try {
        // Simple beep using AudioContext or HTML5 Audio as fallback
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        
        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
            // Second beep
            setTimeout(() => {
                 const osc2 = audioCtx.createOscillator();
                 const gain2 = audioCtx.createGain();
                 osc2.connect(gain2);
                 gain2.connect(audioCtx.destination);
                 osc2.type = 'sine';
                 osc2.frequency.setValueAtTime(554.37, audioCtx.currentTime); // C#5
                 gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
                 osc2.start();
                 setTimeout(() => osc2.stop(), 200);
            }, 300);
        }, 200);

    } catch (e) {
        console.error("Audio playback failed", e);
    }
  };

  // --- NATIVE NOTIFICATION SETUP (ANDROID CHANNEL) ---
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.createChannel({
        id: 'shifts_channel',
        name: 'Lembretes de Plantão',
        description: 'Notificações para início de plantões',
        importance: 5, // High importance for heads-up notification
        visibility: 1, // Public on lockscreen
        vibration: true,
      }).catch(err => console.error("Erro ao criar canal de notificação:", err));
    }
  }, []);

  // --- NATIVE NOTIFICATION HELPERS ---
  
  // Helper to convert string ID to integer (required by LocalNotifications plugin)
  const getNotificationId = (shiftId: string): number => {
    let hash = 0;
    for (let i = 0; i < shiftId.length; i++) {
        const char = shiftId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };

  const scheduleNativeNotification = async (shift: Shift, typeName: string) => {
      // Only run if native and enabled
      if (!Capacitor.isNativePlatform() || !settings.notificationsEnabled) return;

      try {
          // Calculate trigger time
          const [hours, minutes] = shift.startTime.split(':').map(Number);
          const shiftDateTime = new Date(shift.date);
          shiftDateTime.setHours(hours, minutes, 0, 0);
          
          const advanceHours = shift.notificationAdvanceHours ?? 2;
          const triggerDate = subHours(shiftDateTime, advanceHours);

          // Only schedule if in the future
          if (triggerDate > new Date()) {
            const notifId = getNotificationId(shift.id);
            
            // Cancel existing if update (avoids duplicates)
            await LocalNotifications.cancel({ notifications: [{ id: notifId }] });

            await LocalNotifications.schedule({
                notifications: [{
                    title: `Plantão: ${typeName}`,
                    body: `Começa às ${shift.startTime} (${advanceHours}h de aviso).`,
                    id: notifId,
                    schedule: { at: triggerDate },
                    channelId: 'shifts_channel', // Essential for Android 8+
                    sound: undefined, // Use system default sound
                    actionTypeId: "",
                    extra: { shiftId: shift.id }
                }]
            });
            console.log("Notificação nativa agendada para:", triggerDate);
          }
      } catch (e) {
          console.error("Erro ao agendar notificação nativa:", e);
      }
  };

  const cancelNativeNotification = async (shiftId: string) => {
      if (!Capacitor.isNativePlatform()) return;
      try {
          await LocalNotifications.cancel({ notifications: [{ id: getNotificationId(shiftId) }] });
      } catch (e) {
          console.error("Erro ao cancelar notificação:", e);
      }
  };


  // --- PERSISTENCE & MIGRATION ---
  useEffect(() => {
    try {
      const savedShifts = localStorage.getItem('shifts');
      const savedTypes = localStorage.getItem('shiftTypes');
      const savedExpenses = localStorage.getItem('expenses');
      const savedSettings = localStorage.getItem('userSettings');

      if (savedShifts) {
        const parsed = JSON.parse(savedShifts);
        const migrated = parsed.map((s: any) => ({
          ...s,
          date: new Date(s.date),
          paymentDate: s.paymentDate ? new Date(s.paymentDate) : new Date(s.date),
          value: Number(s.value) || 0,
          notificationAdvanceHours: s.notificationAdvanceHours || 2 // Default migration
        }));
        setShifts(migrated);
      }

      if (savedTypes) {
        setShiftTypes(JSON.parse(savedTypes));
      }

      if (savedExpenses) {
        const parsed = JSON.parse(savedExpenses);
        const migrated = parsed.map((e: any) => ({
          ...e,
          date: new Date(e.date),
          category: e.category || 'fixed',
          valueType: e.valueType || 'fixed',
          recurrenceEnd: e.recurrenceEnd ? new Date(e.recurrenceEnd) : undefined,
          exclusionDates: e.exclusionDates || []
        }));
        setExpenses(migrated);
      }

      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error("Data load error:", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('shifts', JSON.stringify(shifts));
    localStorage.setItem('shiftTypes', JSON.stringify(shiftTypes));
    localStorage.setItem('expenses', JSON.stringify(expenses));
    localStorage.setItem('userSettings', JSON.stringify(settings));
  }, [shifts, shiftTypes, expenses, settings]);

  // --- THEME EFFECT ---
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, [settings.theme]);

  // --- NOTIFICATION LOGIC ---
  
  // Toggle handler to request permissions
  const toggleNotifications = async () => {
    const nextState = !settings.notificationsEnabled;
    
    if (nextState) {
      // 1. Try Native Permission (Capacitor)
      if (Capacitor.isNativePlatform()) {
          const perm = await LocalNotifications.requestPermissions();
          if (perm.display === 'granted') {
             setSettings(s => ({ ...s, notificationsEnabled: true }));
             // Reschedule all future shifts
             shifts.forEach(s => {
                 const t = getShiftType(s.typeId);
                 if (t) scheduleNativeNotification(s, t.name);
             });
             addToast("Ativado", "Notificações agendadas no dispositivo.", "success");
             return;
          }
      }

      // 2. Fallback to Web Notification API
      if (!("Notification" in window)) {
        setSettings(s => ({ ...s, notificationsEnabled: true }));
        addToast("Aviso", "Notificações de sistema não suportadas. Usaremos alertas internos.", 'warning');
        return;
      }

      const permission = await Notification.requestPermission();
      
      if (permission === "granted") {
        setSettings(s => ({ ...s, notificationsEnabled: true }));
        new Notification("PlantãoGest", { 
          body: "Notificações ativadas! Você será avisado antes dos seus plantões.",
          icon: '/favicon.ico'
        });
      } else {
        setSettings(s => ({ ...s, notificationsEnabled: true }));
        addToast("Permissão Negada", "Usaremos alertas internos quando o app estiver aberto.", 'info');
      }
    } else {
      setSettings(s => ({ ...s, notificationsEnabled: false }));
      // Cancel all native notifications if disabled
      if (Capacitor.isNativePlatform()) {
          const pending = await LocalNotifications.getPending();
          if (pending.notifications.length > 0) {
              await LocalNotifications.cancel(pending);
          }
      }
    }
  };

  // Effect to check for upcoming shifts ON THE HOUR (Troca de hora) - WEB FALLBACK ONLY
  useEffect(() => {
    if (!settings.notificationsEnabled) return;
    // If native, we rely on the scheduled notifications, not polling
    if (Capacitor.isNativePlatform()) return; 

    const checkShifts = () => {
      const now = new Date();

      shifts.forEach(shift => {
        if (notifiedShiftIds.includes(shift.id)) return;

        const shiftDate = new Date(shift.date);
        const [hours, minutes] = shift.startTime.split(':').map(Number);
        shiftDate.setHours(hours, minutes, 0, 0);

        // Use custom shift notification time, fallback to 2 hours if undefined
        const advanceHours = shift.notificationAdvanceHours ?? 2;
        const triggerTime = subHours(shiftDate, advanceHours);
        
        if (now >= triggerTime && now < shiftDate) {
           const diff = differenceInMinutes(now, triggerTime);
           
           if (diff >= 0 && diff < 65) {
             const type = getShiftType(shift.typeId);
             const title = `Plantão: ${type?.name || 'Geral'}`;
             const body = `Seu plantão começa em ${advanceHours}h (${shift.startTime}). Prepare-se!`;

             // Try System Notification first
             if ("Notification" in window && Notification.permission === "granted") {
                try {
                   new Notification(title, {
                     body: body,
                     tag: shift.id, 
                     requireInteraction: true,
                     icon: '/favicon.ico'
                   });
                } catch (e) {
                   addToast(title, body, 'info');
                   playNotificationSound();
                }
             } else {
                // Fallback to In-App Toast
                addToast(title, body, 'info');
                playNotificationSound();
             }
               
             setNotifiedShiftIds(prev => [...prev, shift.id]);
           }
        }
      });
    };

    // Helper to sync recursively to the next hour
    const startHourlyCycle = () => {
        checkShifts(); 
        const now = new Date();
        const minutesToNextHour = 60 - now.getMinutes();
        const msToNextHour = (minutesToNextHour * 60 * 1000) - (now.getSeconds() * 1000) - now.getMilliseconds() + 1000;

        notificationTimerRef.current = setTimeout(() => {
            startHourlyCycle(); 
        }, msToNextHour);
    };

    startHourlyCycle();

    return () => {
        if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    };
  }, [shifts, settings.notificationsEnabled, notifiedShiftIds, shiftTypes]);


  // --- CRUD OPERATIONS ---
  const handleAddShiftType = (newTypeData: Omit<ShiftType, 'id'>) => {
    const newType: ShiftType = { ...newTypeData, id: Math.random().toString(36).substr(2, 9) };
    setShiftTypes([...shiftTypes, newType]);
  };
  const handleUpdateShiftType = (updatedType: ShiftType) => {
    setShiftTypes(shiftTypes.map(t => t.id === updatedType.id ? updatedType : t));
  };

  const handleDeleteShiftType = (id: string) => {
    if (window.confirm("Deseja remover este tipo? Plantões existentes deste tipo NÃO serão apagados do histórico.")) {
       setShiftTypes(prev => prev.map(t => t.id === id ? { ...t, archived: true } : t));
    }
  };

  const handleSaveShift = (shiftData: Omit<Shift, 'id'>) => {
    let savedShift: Shift;

    if (editingShift) {
      // Update Existing
      savedShift = { ...shiftData, id: editingShift.id };
      setShifts(prev => prev.map(s => s.id === editingShift.id ? savedShift : s));
      addToast("Sucesso", "Plantão atualizado!", "success");
      setEditingShift(undefined);
    } else {
      // Create New
      savedShift = { ...shiftData, id: Math.random().toString(36).substr(2, 9) };
      setShifts([...shifts, savedShift]);
      addToast("Sucesso", "Plantão adicionado!", "success");
    }

    // Schedule Native Notification
    const type = getShiftType(savedShift.typeId);
    if (type) {
        scheduleNativeNotification(savedShift, type.name);
    }
  };

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setIsShiftFormOpen(true);
  }

  const handleDeleteShift = (id: string) => { 
      setShifts(shifts.filter(s => s.id !== id));
      cancelNativeNotification(id);
  };

  const handleTogglePaid = (id: string) => { setShifts(shifts.map(s => s.id === id ? { ...s, isPaid: !s.isPaid } : s)); };
  
  const handleAddExpense = (newExpenseData: Omit<Expense, 'id'>) => {
    const newExpense: Expense = { ...newExpenseData, id: Math.random().toString(36).substr(2, 9) };
    setExpenses([...expenses, newExpense]);
    addToast("Sucesso", "Gasto adicionado!", "success");
  };

  const handleDeleteExpense = (expense: Expense) => {
    if (expense.category === 'fixed') {
        setExpenseToDelete(expense);
    } else {
        // Variable expense: just delete
        setExpenses(expenses.filter(e => e.id !== expense.id));
        addToast("Sucesso", "Gasto removido.", "success");
    }
  };

  const confirmDeleteExpense = (action: 'single' | 'future' | 'all') => {
    if (!expenseToDelete) return;

    if (action === 'all') {
        setExpenses(prev => prev.filter(e => e.id !== expenseToDelete.id));
        addToast("Sucesso", "Gasto fixo excluído totalmente.", "success");
    } else if (action === 'single') {
        const monthStr = format(analyticsDate, 'yyyy-MM');
        setExpenses(prev => prev.map(e => {
            if (e.id === expenseToDelete.id) {
                return {
                    ...e,
                    exclusionDates: [...(e.exclusionDates || []), monthStr]
                };
            }
            return e;
        }));
        addToast("Sucesso", "Removido apenas deste mês.", "success");
    } else if (action === 'future') {
        // Set end date to the END of the PREVIOUS month relative to analyticsDate
        // So it shows up until last month, but stops appearing from this analytics month onwards.
        const endOfPrevMonth = endOfMonth(subMonths(analyticsDate, 1));
        
        setExpenses(prev => prev.map(e => {
            if (e.id === expenseToDelete.id) {
                return {
                    ...e,
                    recurrenceEnd: endOfPrevMonth
                };
            }
            return e;
        }));
        addToast("Sucesso", "Removido a partir deste mês.", "success");
    }

    setExpenseToDelete(null);
  };
  
  const getShiftType = (id: string) => shiftTypes.find(t => t.id === id);
  const activeShiftTypes = shiftTypes.filter(t => !t.archived);

  // --- ACTIONS ---
  const openNewShiftModal = () => {
    if (activeShiftTypes.length === 0) {
      alert("Crie um tipo de plantão primeiro na aba 'Turnos'.");
      setView('shifts');
      setIsShiftTypeFormOpen(true);
      return;
    }
    // Default open without specific type pre-selected from calendar
    setPreSelectedTypeId(undefined);
    setEditingShift(undefined); // Ensure we are not editing
    setIsShiftFormOpen(true);
  };
  
  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setIsQuickAddOpen(true);
  };

  const handleQuickAddSelect = (typeId: string) => {
    setPreSelectedTypeId(typeId);
    setEditingShift(undefined);
    setIsQuickAddOpen(false);
    setIsShiftFormOpen(true);
  };

  // --- EXPORT/IMPORT ---
  const handleExportLocal = () => {
    const data = { version: '1.2', timestamp: new Date().toISOString(), shifts, shiftTypes, expenses, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-${format(new Date(), 'dd-MM-yyyy')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Backup", "Arquivo de backup gerado.", "success");
  };

  const handleImportLocal = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        if (data.shifts) setShifts(data.shifts.map((s: any) => ({ ...s, date: new Date(s.date), paymentDate: s.paymentDate ? new Date(s.paymentDate) : new Date(s.date) })));
        if (data.shiftTypes) setShiftTypes(data.shiftTypes);
        if (data.expenses) setExpenses(data.expenses.map((e: any) => ({ ...e, date: new Date(e.date) })));
        if (data.settings) setSettings(data.settings);
        addToast("Restauração", "Dados restaurados com sucesso!", "success");
      } catch (err) {
        addToast("Erro", "Arquivo de backup inválido.", "error");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // --- SUB-VIEWS ---
  
  const CalendarView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Sort selected day shifts by time (Chronological: 07:00 before 19:00)
    const selectedDayShifts = shifts
        .filter(s => isSameDay(s.date, selectedDate))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Determine icon type: 'sun' (Day), 'moon' (Night), or 'mixed' (Mixed)
    const getShiftIconType = (startStr: string, endStr: string) => {
        const startH = parseInt(startStr.split(':')[0]);
        const endH = parseInt(endStr.split(':')[0]);
        
        // Simple day/night check based on start time first
        const isStartDay = startH >= 6 && startH < 18;
        
        // Check for mixed scenario (e.g., 12:00 to 00:00)
        // If it starts in the "middle" of the day (e.g., 10am to 4pm) 
        // AND extends into night (after 19:00 or wraps to morning)
        if (startH >= 10 && startH <= 16) {
             if (endH >= 19 || endH < 6) {
                 return 'mixed';
             }
        }
        
        return isStartDay ? 'sun' : 'moon';
    };

    // Helper to render the icons based on type
    const renderIcon = (type: 'sun' | 'moon' | 'mixed', size: number = 8) => {
        if (type === 'mixed') {
            return (
                <div className="relative" style={{ width: size, height: size }}>
                    {/* Background: Moon (Night) - displayed in bottom right area */}
                    <Moon size={size} className="text-blue-900 fill-current absolute top-0 left-0" />
                    {/* Foreground: Sun (Day) - clipped to top left triangle */}
                    <div 
                        className="absolute top-0 left-0 overflow-hidden" 
                        style={{ 
                            width: size, 
                            height: size, 
                            clipPath: 'polygon(0 0, 100% 0, 0 100%)' // Diagonal cut: Top-Left to Bottom-Left to Top-Right logic
                        }}
                    >
                        <Sun size={size} className="text-yellow-300 fill-current" />
                    </div>
                </div>
            );
        }
        if (type === 'moon') return <Moon size={size} className="text-blue-900 fill-current shrink-0" />;
        return <Sun size={size} className="text-yellow-300 fill-current shrink-0" />;
    };

    // --- TOUCH / SWIPE LOGIC ---
    const calendarRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        if (calendarRef.current) {
            calendarRef.current.style.transition = 'none'; // Remove transition for instant drag feel
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = currentX - touchStartX.current;
        const deltaY = currentY - touchStartY.current;

        // If scrolling vertically, do not swipe
        if (Math.abs(deltaY) > Math.abs(deltaX)) return;

        if (calendarRef.current) {
            calendarRef.current.style.transform = `translateX(${deltaX}px)`;
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const currentX = e.changedTouches[0].clientX;
        const deltaX = currentX - touchStartX.current;
        const threshold = 80; // Distance to trigger change

        if (calendarRef.current) {
             calendarRef.current.style.transition = 'transform 0.3s ease-out'; // Enable transition for snap

             if (deltaX > threshold) {
                 // Swipe Right -> Prev Month
                 calendarRef.current.style.transform = 'translateX(100%)';
                 setTimeout(() => {
                     setCurrentDate(d => subMonths(d, 1));
                     requestAnimationFrame(() => {
                        if (calendarRef.current) {
                            calendarRef.current.style.transition = 'none';
                            calendarRef.current.style.transform = 'translateX(-100%)'; // Instant jump to other side
                            requestAnimationFrame(() => {
                                if (calendarRef.current) {
                                    calendarRef.current.style.transition = 'transform 0.3s ease-out';
                                    calendarRef.current.style.transform = 'translateX(0)';
                                }
                            })
                        }
                     });
                 }, 250);
             } else if (deltaX < -threshold) {
                 // Swipe Left -> Next Month
                 calendarRef.current.style.transform = 'translateX(-100%)';
                 setTimeout(() => {
                     setCurrentDate(d => addMonths(d, 1));
                     requestAnimationFrame(() => {
                        if (calendarRef.current) {
                            calendarRef.current.style.transition = 'none';
                            calendarRef.current.style.transform = 'translateX(100%)'; // Instant jump to other side
                            requestAnimationFrame(() => {
                                if (calendarRef.current) {
                                    calendarRef.current.style.transition = 'transform 0.3s ease-out';
                                    calendarRef.current.style.transform = 'translateX(0)';
                                }
                            })
                        }
                     });
                 }, 250);
             } else {
                 // Snap back
                 calendarRef.current.style.transform = 'translateX(0)';
             }
        }
    };

    return (
      <div id="calendar-view-container" className="flex flex-col h-full overflow-hidden pb-16 bg-background">
        <div className="px-5 pt-6 pb-2 flex justify-between items-center bg-background z-10">
          <div onClick={() => setCurrentDate(new Date())} className="cursor-pointer">
            <h1 className="text-xl sm:text-2xl font-extrabold capitalize text-text">{format(currentDate, "MMMM", { locale: ptBR })}</h1>
            <p className="text-textMuted font-bold text-xs">{format(currentDate, "yyyy", { locale: ptBR })}</p>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 bg-surfaceHighlight hover:bg-surface rounded-xl text-text"><ChevronLeft size={18} /></button>
             <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 bg-surfaceHighlight hover:bg-surface rounded-xl text-text"><ChevronRight size={18} /></button>
             <button onClick={openNewShiftModal} className="p-2 bg-primary text-white rounded-xl shadow-lg active:scale-95"><Plus size={18} strokeWidth={3} /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 px-3 mb-1">
          {['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'].map((day, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-textMuted/60 py-1.5">{day}</div>
          ))}
        </div>

        <div 
          ref={calendarRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="grid grid-cols-7 px-2 gap-2 mb-4 flex-1 overflow-y-auto no-scrollbar pb-32 content-start"
        >
          {calendarDays.map((day, idx) => {
            // Sort shifts by start time for the day cell (Chronological: 07:00 before 19:00)
            const dayShifts = shifts
                .filter(s => isSameDay(s.date, day))
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentDate);
            
            return (
              <div 
                key={idx} 
                onClick={() => handleDayClick(day)} 
                // FIXED HEIGHT and SIZE logic here:
                // Decreased height to 80px
                // CHANGED: bg-[#25252b] -> dark:bg-[#25252b] bg-white
                className={`h-[80px] flex flex-col items-center pt-2 rounded-xl cursor-pointer border overflow-hidden relative ${
                  isSelected 
                    ? 'bg-surface dark:border-white/80 border-primary z-10 shadow-lg' 
                    : 'dark:bg-[#25252b] bg-white border-transparent hover:border-black/5 dark:hover:border-white/10'
                } ${!isCurrentMonth ? 'opacity-30' : 'opacity-100'}`}
              >
                {/* Day Number */}
                <span className={`text-sm font-bold mb-1.5 ${isToday(day) ? 'text-primary' : 'text-text'}`}>
                   {format(day, 'd')}
                </span>

                {/* Shifts Container - Vertical List */}
                <div className="w-full px-1 flex flex-col gap-1 overflow-hidden">
                  {dayShifts.map(s => {
                    const type = getShiftType(s.typeId);
                    const iconType = getShiftIconType(s.startTime, s.endTime);
                    return (
                      <div 
                        key={s.id} 
                        style={{ backgroundColor: type?.color || COLORS[0] }} 
                        className="text-[9px] text-white font-bold px-1 py-1 rounded-md w-full truncate text-center flex items-center justify-center gap-1 shadow-sm"
                      >
                        {renderIcon(iconType, 8)}
                        <span className="truncate">{type?.abbreviation?.substring(0, 5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Detail Card (Only visible if quick add is not covering it, but Quick Add is a modal) */}
        <div className="fixed bottom-[72px] left-3 right-3 bg-surface/90 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-white/5 z-20">
          <div className="flex justify-between items-end mb-3 border-b border-gray-700/50 pb-2">
            <div><p className="text-[9px] font-bold text-primary uppercase">Selecionado</p><h3 className="text-lg font-extrabold text-text capitalize">{format(selectedDate, "eeee, d", { locale: ptBR })}</h3></div>
            {selectedDayShifts.length > 0 && <span className="text-[9px] bg-surfaceHighlight px-2 py-0.5 rounded-md font-bold text-textMuted">{selectedDayShifts.length} plantões</span>}
          </div>
          <div className="space-y-2 max-h-[140px] overflow-y-auto no-scrollbar">
            {selectedDayShifts.length === 0 ? (
               <div className="py-2 text-center flex flex-col items-center gap-1 opacity-50"><Sparkles size={16} className="text-textMuted" /><p className="text-[10px] text-textMuted">Livre neste dia</p></div>
            ) : (
               selectedDayShifts.map(s => {
                const iconType = getShiftIconType(s.startTime, s.endTime);
                return (
                <div key={s.id} className="bg-background/50 p-2.5 rounded-xl flex items-center justify-between group">
                   <div className="flex items-center gap-2.5">
                      <div className="w-1 h-8 rounded-full" style={{ backgroundColor: getShiftType(s.typeId)?.color }}></div>
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-1">
                             {renderIcon(iconType, 10)}
                             <h4 className="font-bold text-text text-sm truncate">{getShiftType(s.typeId)?.name}</h4>
                        </div>
                        <p className="text-[10px] text-textMuted font-medium">{s.startTime} - {s.endTime} • <span className="text-green-400">R$ {s.value}</span></p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <button onClick={() => handleTogglePaid(s.id)} className={`p-2 rounded-lg ${s.isPaid ? 'text-green-400 bg-green-500/10' : 'text-gray-500 bg-gray-800'}`}><CircleDollarSign size={18} /></button>
                     <button onClick={() => handleEditShift(s)} className="p-2 rounded-lg text-blue-400 bg-blue-500/10"><Edit2 size={18} /></button>
                     <button onClick={() => handleDeleteShift(s.id)} className="p-2 rounded-lg text-red-400 bg-red-500/10"><Trash2 size={18} /></button>
                   </div>
                </div>
              )})
            )}
          </div>
        </div>

        {/* Quick Add Modal (Suspended Tab) */}
        {isQuickAddOpen && (
            <div 
                className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm" 
                onClick={() => setIsQuickAddOpen(false)}
            >
                <div 
                    className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-3xl p-5 border-t border-white/10 shadow-2xl animate-slide-up"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-black text-text">Adicionar em {format(selectedDate, "dd/MM")}</h3>
                        <button onClick={() => setIsQuickAddOpen(false)} className="bg-surfaceHighlight p-1.5 rounded-full"><X size={16} className="text-text" /></button>
                    </div>
                    
                    {activeShiftTypes.length === 0 ? (
                         <div className="text-center py-4 text-textMuted text-sm">Nenhum tipo cadastrado.</div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto">
                            {activeShiftTypes.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => handleQuickAddSelect(type.id)}
                                    className="p-3 bg-surfaceHighlight hover:bg-surfaceHighlight/80 rounded-xl flex items-center gap-3 border border-transparent hover:border-primary/50 transition-all text-left"
                                >
                                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: type.color}} />
                                    <div>
                                        <p className="font-bold text-sm text-text truncate w-24">{type.name}</p>
                                        <p className="text-[10px] text-textMuted">{type.startTime}-{type.endTime}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    
                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-center">
                        <button onClick={() => openNewShiftModal()} className="text-primary font-bold text-xs flex items-center gap-1">
                             <Plus size={14} /> Personalizar outro
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  };

  const ShiftsView = () => (
    <div className="p-5 h-full overflow-y-auto pb-24 bg-background">
      <h1 className="text-2xl font-black text-text mb-6">Meus Turnos</h1>
      <div className="grid gap-3">
        {activeShiftTypes.length === 0 ? (
            <div className="text-center py-10 opacity-50">
                <Briefcase size={40} className="mx-auto mb-2 text-textMuted" />
                <p className="text-sm font-bold text-textMuted">Nenhum tipo de plantão criado.</p>
            </div>
        ) : (
            activeShiftTypes.map(t => (
            <div key={t.id} onClick={() => { setEditingShiftType(t); setIsShiftTypeFormOpen(true); }} className="bg-surface p-4 rounded-2xl flex justify-between items-center border border-white/5 cursor-pointer hover:bg-surfaceHighlight active:scale-[0.98] transition-all group">
                <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-lg" style={{backgroundColor: t.color}}>
                    {t.abbreviation}
                </div>
                <div>
                    <h3 className="font-bold text-text">{t.name}</h3>
                    <p className="text-xs text-textMuted">{t.startTime} - {t.endTime} • R$ {t.defaultRate}</p>
                </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteShiftType(t.id);
                        }}
                        className="p-2 rounded-xl text-textMuted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Excluir"
                    >
                        <Trash2 size={18} />
                    </button>
                    <div className="bg-surfaceHighlight p-2 rounded-xl text-textMuted">
                        <Edit2 size={16} />
                    </div>
                </div>
            </div>
            ))
        )}
        
        <button onClick={() => { setEditingShiftType(undefined); setIsShiftTypeFormOpen(true); }} className="mt-4 w-full py-4 bg-primary/10 border-2 border-dashed border-primary/30 rounded-2xl font-bold text-primary flex justify-center items-center gap-2 hover:bg-primary/20 transition-all active:scale-95">
          <Plus size={20} />
          Criar Novo Tipo de Plantão
        </button>
      </div>
    </div>
  );

  const AnalyticsView = () => {
    // Lifted state `analyticsDate` to App component scope to share with delete logic
    
    const calculateMetrics = (date: Date) => {
      const monthShifts = shifts.filter(s => s.paymentDate && isSameMonth(s.paymentDate, date));
      const count = monthShifts.length;
      const paidCount = monthShifts.filter(s => s.isPaid).length;
      const gross = monthShifts.reduce((acc, curr) => acc + curr.value, 0);
      
      const monthExpenses = expenses.filter(e => {
        // Variable expenses: exact date match
        if (e.category === 'variable') {
             return e.date && isSameMonth(e.date, date);
        }
        
        // Fixed expenses logic with exclusions/recurrence end
        if (e.category === 'fixed') {
             const currentMonthStr = format(date, 'yyyy-MM');
             
             // 1. Check if specific month was excluded
             if (e.exclusionDates?.includes(currentMonthStr)) {
                 return false;
             }
             
             // 2. Check if recurrence has ended (e.g. deleted from future)
             // If analytics date is AFTER recurrenceEnd, do not show
             if (e.recurrenceEnd) {
                 // We want to include the recurrenceEnd month, so strict greater than
                 if (isAfter(startOfMonth(date), endOfMonth(e.recurrenceEnd))) {
                     return false;
                 }
             }

             return true;
        }
        return false;
      });

      const totalExpenses = monthExpenses.reduce((acc, curr) => acc + (curr.valueType === 'percentage' ? (curr.value / 100) * gross : curr.value), 0);
      return { gross, expenses: totalExpenses, net: gross - totalExpenses, expensesList: monthExpenses, count, paidCount, monthShifts };
    };

    const metrics = calculateMetrics(analyticsDate);
    const chartData = eachMonthOfInterval({ start: subMonths(analyticsDate, 5), end: analyticsDate }).map(month => {
       const m = calculateMetrics(month);
       return { name: format(month, 'MMM', { locale: ptBR }), bruto: m.gross, liquido: m.net, gastos: m.expenses };
    });

    return (
      <div id="analytics-view-container" className="p-5 pb-20 h-full overflow-y-auto bg-background">
         <div className="flex justify-between items-center mb-5">
            <h1 className="text-2xl font-black text-text">Análise</h1>
         </div>
         <div className="flex items-center justify-between bg-surfaceHighlight p-1.5 rounded-2xl mb-5 shadow-inner">
            <button onClick={() => setAnalyticsDate(subMonths(analyticsDate, 1))} className="p-2 hover:bg-surface rounded-xl text-text"><ChevronLeft size={16} /></button>
            <h2 className="text-sm font-black capitalize text-text">{format(analyticsDate, 'MMMM yyyy', { locale: ptBR })}</h2>
            <button onClick={() => setAnalyticsDate(addMonths(analyticsDate, 1))} className="p-2 hover:bg-surface rounded-xl text-text"><ChevronRight size={16} /></button>
         </div>
         <div className="grid grid-cols-2 gap-2.5 mb-5">
            {/* Net Value - Full Width */}
            <div className="col-span-2 bg-gradient-to-br from-surface to-surfaceHighlight rounded-[1.25rem] p-5 shadow-xl border border-white/5 text-center relative overflow-hidden">
               <p className="text-[10px] text-textMuted font-bold uppercase tracking-widest mb-1 relative z-10">Líquido Estimado</p>
               <h2 className={`text-4xl font-black tracking-tighter relative z-10 ${metrics.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{metrics.net.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
            </div>
            
            {/* Gross Value */}
            <div className="col-span-1 bg-surface rounded-2xl p-3.5 shadow-lg border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-surfaceHighlight transition-colors">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                <p className="text-[9px] text-textMuted font-bold uppercase mb-1">Valor Bruto</p>
                {/* Changed text-white to text-text */}
                <p className="text-sm sm:text-base font-black text-text">{metrics.gross.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>

            {/* Expenses */}
            <div className="col-span-1 bg-surface rounded-2xl p-3.5 shadow-lg border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-surfaceHighlight transition-colors">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                <p className="text-[9px] text-textMuted font-bold uppercase mb-1">Gastos</p>
                {/* Changed text-white to text-text */}
                <p className="text-sm sm:text-base font-black text-text">{metrics.expenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>

            {/* Shift Count - CLICKABLE */}
             <div 
               onClick={() => setIsAnalyticsListOpen(true)}
               className="col-span-2 bg-surface rounded-2xl p-3.5 shadow-lg border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-surfaceHighlight transition-colors cursor-pointer active:scale-95"
             >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                <div className="absolute right-3 top-3 opacity-30 group-hover:opacity-100 transition-opacity"><Info size={16} className="text-primary" /></div>
                <p className="text-[9px] text-textMuted font-bold uppercase mb-1">Qtd. Plantões (Recebimento)</p>
                <p className="text-xl font-black text-text">{metrics.count} <span className="text-xs text-textMuted font-medium">plantões</span></p>
            </div>
         </div>
         <div className="bg-surface rounded-[1.5rem] p-4 shadow-xl border border-white/5 mb-5 h-56">
             <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                   <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                   <XAxis dataKey="name" stroke="#666" fontSize={9} tickLine={false} axisLine={false} />
                   <YAxis stroke="#666" fontSize={8} tickLine={false} axisLine={false} />
                   <Tooltip contentStyle={{ backgroundColor: '#1E1F20', borderRadius: '10px', border: 'none' }} />
                   <Bar dataKey="bruto" fill="#6366F1" radius={[3, 3, 0, 0]} barSize={8} />
                   <Bar dataKey="gastos" fill="#F43F5E" radius={[3, 3, 0, 0]} barSize={8} />
                   <Line type="monotone" dataKey="liquido" stroke="#10B981" strokeWidth={2} dot={{r: 2}} />
                </ComposedChart>
             </ResponsiveContainer>
         </div>
         <div className="mb-4">
            <div className="flex justify-between items-center mb-2.5">
               <h3 className="text-xs font-bold text-textMuted uppercase">Detalhamento</h3>
               <button onClick={() => setIsExpenseFormOpen(true)} className="text-[10px] text-red-400 bg-red-500/10 px-2.5 py-1.5 rounded-full font-bold flex gap-1 items-center"><Plus size={10} /> Add</button>
            </div>
            <div className="space-y-2">
               {metrics.expensesList.map(e => (
                  <div key={e.id} className="bg-surface p-3 rounded-xl flex items-center justify-between border-l-[3px] border-red-500">
                     <div><p className="font-bold text-xs">{e.name}</p><p className="text-[9px] text-textMuted uppercase">{e.category === 'fixed' ? 'Mensal' : 'Variável'}</p></div>
                     <div className="flex gap-2 items-center"><span className="font-black text-red-400 text-xs">- {e.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span><button onClick={() => handleDeleteExpense(e)}><Trash2 size={14} className="text-textMuted" /></button></div>
                  </div>
               ))}
            </div>
         </div>

         {/* ANALYTICS LIST MODAL */}
         {isAnalyticsListOpen && (
            <div 
              className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
              onClick={() => setIsAnalyticsListOpen(false)}
            >
              <div 
                 className="bg-surface w-full max-w-sm sm:rounded-[2rem] rounded-t-[2rem] p-5 shadow-2xl animate-slide-up border-t sm:border border-white/10 max-h-[80vh] flex flex-col"
                 onClick={(e) => e.stopPropagation()}
              >
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                      <div>
                        <h3 className="text-lg font-black text-text">Plantões a Receber</h3>
                        <p className="text-xs text-textMuted capitalize">{format(analyticsDate, 'MMMM yyyy', { locale: ptBR })}</p>
                      </div>
                      <button onClick={() => setIsAnalyticsListOpen(false)} className="bg-surfaceHighlight p-1.5 rounded-full"><X size={16} className="text-text" /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5">
                      {metrics.monthShifts.length === 0 ? (
                        <div className="text-center py-8 text-textMuted text-sm">Nenhum plantão previsto para recebimento neste mês.</div>
                      ) : (
                        metrics.monthShifts
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .map(s => {
                             const type = getShiftType(s.typeId);
                             return (
                                <div key={s.id} className="bg-background/50 p-3 rounded-xl flex items-center justify-between">
                                   <div className="flex items-center gap-3">
                                      <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: type?.color || COLORS[0] }}></div>
                                      <div>
                                         <p className="font-bold text-sm text-text">{type?.name || 'Desconhecido'}</p>
                                         <p className="text-[10px] text-textMuted">
                                            {format(s.date, 'dd/MM')} • {s.startTime} - {s.endTime}
                                         </p>
                                      </div>
                                   </div>
                                   <span className="font-bold text-green-400 text-sm">R$ {s.value}</span>
                                </div>
                             );
                          })
                      )}
                  </div>
              </div>
            </div>
         )}
      </div>
    );
  };

  const SettingsView = () => (
    <div className="p-5 pb-20 h-full overflow-y-auto space-y-6 bg-background">
      <h1 className="text-2xl font-black text-text">Configurações</h1>
      
      {/* Appearance */}
      <div className="bg-surface rounded-[1.5rem] p-5 shadow-xl border border-white/5">
        <div className="flex items-center gap-3 mb-4"><div className="bg-primary/10 p-2.5 rounded-xl text-primary"><Monitor size={20} /></div><h2 className="text-lg font-bold text-text">Aparência</h2></div>
        <div className="bg-surfaceHighlight p-1 rounded-2xl flex"><button onClick={() => setSettings(s => ({ ...s, theme: 'light' }))} className={`flex-1 py-3 rounded-xl font-bold text-xs ${settings.theme === 'light' ? 'bg-surface shadow-lg text-primary' : 'text-textMuted'}`}>Claro</button><button onClick={() => setSettings(s => ({ ...s, theme: 'dark' }))} className={`flex-1 py-3 rounded-xl font-bold text-xs ${settings.theme === 'dark' ? 'bg-surface shadow-lg text-primary' : 'text-textMuted'}`}>Escuro</button></div>
      </div>

      {/* Notifications - FUNCTIONAL TOGGLE */}
      <div className="bg-surface rounded-[1.5rem] p-5 shadow-xl border border-white/5">
        <div className="flex items-center gap-3 mb-4">
            <div className="bg-pink-500/10 p-2.5 rounded-xl text-pink-500"><BellRing size={20} /></div>
            <h2 className="text-lg font-bold text-text">Notificações</h2>
        </div>
        <div className="flex items-center justify-between p-4 bg-surfaceHighlight/50 rounded-2xl border border-white/10">
            <div className="flex flex-col">
                <span className="block font-bold text-sm text-text">Lembretes</span>
                <span className="text-[10px] text-textMuted">Antes do plantão</span>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={toggleNotifications} className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 ${settings.notificationsEnabled ? 'bg-primary' : 'bg-gray-700'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${settings.notificationsEnabled ? 'translate-x-4' : ''}`} />
                </button>
            </div>
        </div>
        
        {/* Info Text for APK users */}
        {!('Notification' in window) && settings.notificationsEnabled && (
           <div className="mt-3 px-2 flex gap-2 items-start opacity-70">
              <Info size={14} className="mt-0.5 text-textMuted shrink-0" />
              <p className="text-[10px] text-textMuted leading-tight">
                Seu dispositivo está usando o modo de notificações internas (In-App). Você receberá alertas enquanto o aplicativo estiver aberto.
              </p>
           </div>
        )}
      </div>

      {/* Data */}
      <div className="bg-surface rounded-[1.5rem] p-5 shadow-xl border border-white/5">
        <div className="flex items-center gap-3 mb-4"><div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-500"><Database size={20} /></div><h2 className="text-lg font-bold text-text">Dados</h2></div>
        <div className="space-y-3"><button onClick={handleExportLocal} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-xs flex justify-center items-center gap-2"><Download size={16} /> BACKUP JSON</button><button onClick={() => fileInputRef.current?.click()} className="w-full py-3.5 bg-surfaceHighlight text-text rounded-2xl font-bold text-xs flex justify-center items-center gap-2"><Upload size={16} /> RESTAURAR</button><input type="file" ref={fileInputRef} onChange={handleImportLocal} accept=".json" className="hidden" /></div>
      </div>
    </div>
  );

  // --- MAIN RENDER ---
  return (
    <div className="h-screen w-screen bg-background text-text overflow-hidden font-sans select-none flex flex-col">
      <div className="flex-1 overflow-hidden relative">
        {view === 'calendar' && <CalendarView />}
        {view === 'shifts' && <ShiftsView />}
        {view === 'analytics' && <AnalyticsView />}
        {view === 'settings' && <SettingsView />}
      </div>
      
      {/* GLOBAL TOAST CONTAINER */}
      <div className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
         {toasts.map(toast => (
            <div 
               key={toast.id} 
               className="pointer-events-auto bg-surface/95 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl animate-slide-down flex items-start gap-3 max-w-sm mx-auto w-full"
            >
               <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
                   toast.type === 'success' ? 'bg-green-500/10 text-green-500' : 
                   toast.type === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
                   toast.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
               }`}>
                   {toast.type === 'success' && <CheckCircle size={18} />}
                   {toast.type === 'warning' && <AlertTriangle size={18} />}
                   {toast.type === 'error' && <AlertTriangle size={18} />}
                   {toast.type === 'info' && <BellRing size={18} />}
               </div>
               <div className="flex-1">
                   <h4 className="text-sm font-bold text-text">{toast.title}</h4>
                   <p className="text-xs text-textMuted leading-snug">{toast.message}</p>
               </div>
               <button onClick={() => removeToast(toast.id)} className="text-textMuted hover:text-text"><X size={16} /></button>
            </div>
         ))}
      </div>
      
      {/* DELETE EXPENSE CONFIRMATION MODAL */}
      {expenseToDelete && (
         <div 
             className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
             onClick={() => setExpenseToDelete(null)}
         >
             <div 
                 className="bg-surface w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-white/10 animate-scale-up"
                 onClick={(e) => e.stopPropagation()}
             >
                 <div className="text-center mb-6">
                     <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                         <Trash2 size={32} />
                     </div>
                     <h3 className="text-xl font-black text-text mb-2">Excluir Gasto Fixo</h3>
                     <p className="text-sm text-textMuted">
                         "{expenseToDelete.name}" é um gasto mensal. Como deseja remover?
                     </p>
                 </div>
                 
                 <div className="space-y-3">
                     <button 
                         onClick={() => confirmDeleteExpense('single')}
                         className="w-full bg-surfaceHighlight hover:bg-surface border border-white/5 p-4 rounded-xl flex items-center gap-3 transition-all group text-left"
                     >
                         <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-colors">
                             <CalendarOff size={20} />
                         </div>
                         <div>
                             <p className="font-bold text-sm text-text">Apenas este mês</p>
                             <p className="text-[10px] text-textMuted">Mantém nos outros meses</p>
                         </div>
                     </button>
                     
                     <button 
                         onClick={() => confirmDeleteExpense('future')}
                         className="w-full bg-surfaceHighlight hover:bg-surface border border-white/5 p-4 rounded-xl flex items-center gap-3 transition-all group text-left"
                     >
                         <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg group-hover:bg-purple-500 group-hover:text-white transition-colors">
                             <ArrowRightFromLine size={20} />
                         </div>
                         <div>
                             <p className="font-bold text-sm text-text">A partir deste mês</p>
                             <p className="text-[10px] text-textMuted">Mantém histórico anterior</p>
                         </div>
                     </button>
                     
                     <button 
                         onClick={() => confirmDeleteExpense('all')}
                         className="w-full bg-red-500/10 hover:bg-red-500/20 p-4 rounded-xl flex items-center gap-3 transition-all group text-left border border-transparent hover:border-red-500/30"
                     >
                         <div className="p-2 bg-red-500/20 text-red-500 rounded-lg">
                             <Eraser size={20} />
                         </div>
                         <div>
                             <p className="font-bold text-sm text-red-400">Excluir Tudo</p>
                             <p className="text-[10px] text-red-400/70">Remove de todos os meses</p>
                         </div>
                     </button>
                 </div>
                 
                 <button 
                     onClick={() => setExpenseToDelete(null)}
                     className="mt-6 w-full py-3 text-textMuted font-bold text-sm hover:text-text transition-colors"
                 >
                     Cancelar
                 </button>
             </div>
         </div>
      )}

      <Navbar currentView={view} setView={setView} />

      <ShiftForm
        isOpen={isShiftFormOpen}
        onClose={() => setIsShiftFormOpen(false)}
        onSave={handleSaveShift}
        selectedDate={selectedDate}
        shiftTypes={activeShiftTypes}
        initialTypeId={preSelectedTypeId}
        initialData={editingShift}
      />

      <ShiftTypeForm
        isOpen={isShiftTypeFormOpen}
        onClose={() => { setIsShiftTypeFormOpen(false); setEditingShiftType(undefined); }}
        onSave={handleAddShiftType}
        onUpdate={handleUpdateShiftType}
        onDelete={handleDeleteShiftType}
        initialData={editingShiftType}
      />

      <ExpenseForm
        isOpen={isExpenseFormOpen}
        onClose={() => setIsExpenseFormOpen(false)}
        onSave={handleAddExpense}
        selectedMonthDate={currentDate}
      />
    </div>
  );
}