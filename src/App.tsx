import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Clock, 
  CheckCircle2, 
  Info, 
  CalendarClock, 
  Cpu, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Reminder } from './types';
import { startAlarm, stopAlarm, initAudioContext, playBeep } from './utils/alarm';
import AlarmOverlay from './components/AlarmOverlay';
import ReminderForm from './components/ReminderForm';
import ReminderItem from './components/ReminderItem';
import DashboardStats from './components/DashboardStats';
import PermissionPrompt from './components/PermissionPrompt';

export default function App() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activeAlarm, setActiveAlarm] = useState<Reminder | null>(null);
  const [, setNotifPermission] = useState<NotificationPermission>('default');
  const [currentLocalTime, setCurrentLocalTime] = useState<Date>(new Date());
  const [isTestMode, setIsTestMode] = useState(false);

  // 1. Load reminders from localStorage and setup Permissions on startup
  useEffect(() => {
    try {
      const stored = localStorage.getItem('reminder_app_alerts');
      if (stored) {
        setReminders(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to parse reminders from localStorage:', e);
    }

    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }

    // Register PWA Service Worker for offline access and background notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[App] Service Worker registered scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[App] Service Worker registration failed:', err);
        });
    }
  }, []);

  // 2. Local Time ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentLocalTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Save reminders helper
  const saveReminders = (updated: Reminder[]) => {
    setReminders(updated);
    localStorage.setItem('reminder_app_alerts', JSON.stringify(updated));
  };

  // 4. Background checker for active reminders (Runs every 1s)
  useEffect(() => {
    const checkAlarms = () => {
      const now = Date.now();
      let hasUpdates = false;
      const updatedList = reminders.map((reminder) => {
        const reminderTime = new Date(reminder.dateTime).getTime();
        
        // Trigger if: time reached AND not already triggered AND was within active future
        if (reminderTime <= now && !reminder.triggered) {
          triggerAlarm(reminder);
          hasUpdates = true;
          return { ...reminder, triggered: true };
        }
        return reminder;
      });

      if (hasUpdates) {
        saveReminders(updatedList);
      }
    };

    const interval = setInterval(checkAlarms, 1000);
    return () => clearInterval(interval);
  }, [reminders]);

  // 5. Trigger the Full Alarm Routine
  const triggerAlarm = (reminder: Reminder) => {
    setActiveAlarm(reminder);
    
    // Start Web Audio Synthesizer Loop & device vibration haptics
    startAlarm();

    // Trigger Operating System Push Notification
    triggerWebNotification(reminder);
  };

  const triggerWebNotification = (reminder: Reminder) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const title = `Reminder: ${reminder.title}`;
    const options = {
      body: reminder.notes || 'Your scheduled reminder alert time has arrived!',
      icon: 'https://cdn-icons-png.flaticon.com/512/3602/3602145.png',
      tag: reminder.id,
      requireInteraction: true, // Keep notification visible until actioned
      vibrate: [300, 100, 300, 100, 300],
    };

    // Attempt to dispatch via service worker for maximum lock-screen/background reliability
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, options);
      }).catch(() => {
        // Fallback to traditional browser notification
        new Notification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  };

  // 6. Action handlers
  const handleAddReminder = (title: string, notes: string, dateTime: string) => {
    // Create new entry
    const newReminder: Reminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      notes,
      dateTime,
      triggered: false,
      createdAt: new Date().toISOString(),
    };

    const updated = [newReminder, ...reminders].sort(
      (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
    );
    saveReminders(updated);
    
    // Play subtle chime on success to verify Audio Context is initialized
    initAudioContext();
    playBeep(1200, 0.15);
  };

  const handleDeleteReminder = (id: string) => {
    const updated = reminders.filter((r) => r.id !== id);
    saveReminders(updated);
    
    // If deleted reminder is the active alarm, shut down the alarm
    if (activeAlarm?.id === id) {
      handleDismissAlarm();
    }
  };

  const handleDismissAlarm = () => {
    setActiveAlarm(null);
    stopAlarm();
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear your reminder logs and database?')) {
      saveReminders([]);
      handleDismissAlarm();
    }
  };

  const triggerTestAlarm = () => {
    // Setup a 5-second test reminder
    initAudioContext();
    setIsTestMode(true);
    
    const now = new Date();
    now.setSeconds(now.getSeconds() + 5);
    
    // Account for timezone offset to match YYYY-MM-DDTHH:mm:ss format
    const tzOffset = now.getTimezoneOffset() * 60000;
    const testLocalISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 19);

    const testReminder: Reminder = {
      id: `test_alarm_${Date.now()}`,
      title: '🚨 Test Alarm Triggered!',
      notes: 'This verifies blinking overlay screens, synthesized siren audio, device haptics, and system notification permissions!',
      dateTime: testLocalISOTime,
      triggered: false,
      createdAt: new Date().toISOString(),
    };

    // Pre-insert into reminders so background checker triggers it
    const updated = [testReminder, ...reminders];
    saveReminders(updated);
    
    // Small countdown notification alert
    playBeep(800, 0.1);
    setTimeout(() => {
      setIsTestMode(false);
    }, 5000);
  };

  // Render Time Formatting
  const timeString = currentLocalTime.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateString = currentLocalTime.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Separate reminders into categories
  const activeRemindersList = reminders.filter(
    (r) => !r.triggered && new Date(r.dateTime).getTime() > Date.now()
  );
  
  const historyRemindersList = reminders.filter(
    (r) => r.triggered || new Date(r.dateTime).getTime() <= Date.now()
  );

  return (
    <div id="app-root" className="min-h-screen bg-zinc-950 text-zinc-50 font-sans pb-16 relative">
      {/* Background visual grain */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-red-500/5 via-zinc-950/0 to-zinc-950 pointer-events-none z-0" />

      {/* Navigation Header */}
      <header className="border-b border-zinc-900/60 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 text-zinc-50 rounded-xl shadow-md shadow-red-500/20">
              <Bell className="w-5 h-5 fill-zinc-50/10" />
            </div>
            <div>
              <h1 className="text-base font-bold font-display tracking-tight text-zinc-100">
                Reminder Web App
              </h1>
              <span className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                <Cpu className="w-2.5 h-2.5 text-red-500/70" /> Client PWA Enabled
              </span>
            </div>
          </div>

          {/* Clock Widget */}
          <div className="text-right flex flex-col items-end">
            <span className="text-lg font-bold font-mono text-red-400 tabular-nums select-none tracking-tight">
              {timeString}
            </span>
            <span className="text-[10px] font-semibold text-zinc-500 font-display">
              {dateString}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6 relative z-10">
        
        {/* Permission Manager Card */}
        <PermissionPrompt onPermissionChange={(status) => setNotifPermission(status)} />

        {/* Dashboard Stat Cards */}
        <DashboardStats reminders={reminders} />

        {/* Action Controls & Quick Test */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Creation Form (Col Span 5) */}
          <div className="md:col-span-5 space-y-6">
            <ReminderForm onAddReminder={handleAddReminder} />

            {/* Test Console Widget */}
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold font-display text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-red-400" /> Diagnostics Console
              </h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Click below to queue a test alarm for 5 seconds in the future. Perfect for testing device screen-locks, vibration haptics, synthesized alarms, and browser alerts!
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={triggerTestAlarm}
                  id="btn-trigger-test-alarm"
                  disabled={isTestMode}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider font-display transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isTestMode 
                      ? 'bg-zinc-800 text-zinc-500 border border-zinc-800 pointer-events-none'
                      : 'bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-zinc-50 active:scale-97'
                  }`}
                >
                  {isTestMode ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Alarm in 5s...
                    </>
                  ) : (
                    <>
                      ⚡ Quick Test Alarm
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Reminder Boards (Col Span 7) */}
          <div className="md:col-span-7 space-y-6">
            
            {/* Active Queue Card */}
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
                <h2 className="text-sm font-bold font-display text-zinc-200 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-red-500" />
                  Upcoming Queue ({activeRemindersList.length})
                </h2>
                {reminders.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    id="btn-clear-reminders"
                    className="text-[10px] font-mono font-bold text-zinc-500 hover:text-red-400 uppercase tracking-wider px-2 py-1 hover:bg-red-500/5 rounded transition-all cursor-pointer border border-transparent hover:border-red-500/10"
                  >
                    Reset DB
                  </button>
                )}
              </div>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 no-scrollbar">
                <AnimatePresence mode="popLayout">
                  {activeRemindersList.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="py-12 text-center text-zinc-500 space-y-2 border border-dashed border-zinc-800 rounded-xl"
                    >
                      <Bell className="w-8 h-8 mx-auto text-zinc-700 stroke-[1.5]" />
                      <p className="text-xs font-sans">No upcoming reminders</p>
                      <p className="text-[10px] text-zinc-600 max-w-[200px] mx-auto leading-relaxed">
                        Create a reminder on the left or click the Quick Test button.
                      </p>
                    </motion.div>
                  ) : (
                    activeRemindersList.map((reminder) => (
                      <ReminderItem
                        key={reminder.id}
                        reminder={reminder}
                        onDelete={handleDeleteReminder}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* History Queue Card */}
            {historyRemindersList.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 shadow-xl">
                <h2 className="text-xs font-bold font-display text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-4 pb-2 border-b border-zinc-800/40">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" /> Passed / Logs ({historyRemindersList.length})
                </h2>
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {historyRemindersList.map((reminder) => (
                      <ReminderItem
                        key={reminder.id}
                        reminder={reminder}
                        onDelete={handleDeleteReminder}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Help / Platform Guideline Card */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 space-y-3 text-xs leading-relaxed text-zinc-400">
              <h3 className="font-bold text-zinc-200 font-display flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <Info className="w-3.5 h-3.5 text-red-500/70" /> Help & Testing Guidelines
              </h3>
              <ul className="space-y-2 list-disc pl-4 text-[11px] text-zinc-400">
                <li>
                  <strong className="text-zinc-300">Lock-Screen & Minimizing:</strong> Modern mobile browsers restrict JavaScript execution when tabs are in the background or device is locked. If you wish to guarantee background alarms, install this app on your Home Screen as a PWA, grant system notifications when prompted, and keep the application tab active in the browser.
                </li>
                <li>
                  <strong className="text-zinc-300">How to Install:</strong> Open this app in Safari (iOS) and select <span className="font-semibold text-red-400">"Add to Home Screen"</span> or click the install prompt on Chrome (Android).
                </li>
                <li>
                  <strong className="text-zinc-300">Audio Autoplay:</strong> Web browsers prevent audio sirens from sounding automatically unless you have interacted with the page first. Be sure to tap anywhere on the screen before testing!
                </li>
              </ul>
            </div>

          </div>

        </div>

      </main>

      {/* Repeating Screen-Blinking Red Emergency Alarm Dialog overlay */}
      <AnimatePresence>
        {activeAlarm && (
          <AlarmOverlay
            activeReminder={activeAlarm}
            onDismiss={handleDismissAlarm}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
