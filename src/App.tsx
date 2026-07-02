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
  RefreshCw,
  Download,
  Smartphone,
  Share2,
  HelpCircle,
  Zap
} from 'lucide-react';
import { Reminder } from './types';
import { startAlarm, stopAlarm, initAudioContext, playBeep, startSilentKeepAlive, stopSilentKeepAlive } from './utils/alarm';
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
  const [isBackgroundLockActive, setIsBackgroundLockActive] = useState<boolean>(true);

  // PWA Install Prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
  const [selectedBrand, setSelectedBrand] = useState<'all' | 'samsung' | 'xiaomi' | 'oneplus' | 'iphone'>('all');

  // Register PWA install prompt listeners and active check
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log('App was successfully installed on the home screen!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstallPrompt = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
  };

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

  // 1b. Background Keep-Alive (Silent Audio Wake-Lock to prevent CPU throttling)
  useEffect(() => {
    const hasActiveFuture = reminders.some(
      (r) => !r.triggered && new Date(r.dateTime).getTime() > Date.now()
    );

    if (isBackgroundLockActive && hasActiveFuture) {
      startSilentKeepAlive();
    } else {
      stopSilentKeepAlive();
    }

    return () => {
      stopSilentKeepAlive();
    };
  }, [reminders, isBackgroundLockActive]);

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
    if (isBackgroundLockActive) {
      startSilentKeepAlive();
    }
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

        {/* Background Alarm Lock Panel */}
        <div id="background-lock-panel" className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -z-10" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-2xl border transition-all duration-300 ${
                isBackgroundLockActive 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-zinc-800/20 text-zinc-500 border-zinc-800/40'
              }`}>
                <Zap className={`w-5.5 h-5.5 ${isBackgroundLockActive ? 'animate-pulse' : ''}`} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-zinc-100 font-display">
                    ⚡ Background Wake-Lock (पृष्ठभूमि अलार्म लॉक)
                  </h3>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isBackgroundLockActive 
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                      : 'bg-zinc-800/40 border border-zinc-800/60 text-zinc-500'
                  }`}>
                    {isBackgroundLockActive ? 'सक्रिय (ACTIVE)' : 'बंद (INACTIVE)'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
                  इसे चालू रखने पर हमारा ऐप बैकग्राउंड में एक अदृश्य, म्यूटेड साउंड ट्रैक प्ले करता है। इससे मोबाइल ऑपरेटिंग सिस्टम आपके अलार्म को कभी सुलाएगा नहीं, और दूसरे ऐप्स चलाने पर भी अलार्म बिल्कुल सही समय पर बजेगा।
                </p>
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center gap-1.5 self-end md:self-auto min-w-[120px]">
              <button
                type="button"
                onClick={() => {
                  initAudioContext();
                  const nextState = !isBackgroundLockActive;
                  setIsBackgroundLockActive(nextState);
                  if (nextState) {
                    startSilentKeepAlive();
                  } else {
                    stopSilentKeepAlive();
                  }
                }}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer text-center ${
                  isBackgroundLockActive
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-md shadow-emerald-500/5'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
              >
                {isBackgroundLockActive ? 'LOCK ON' : 'LOCK OFF'}
              </button>
              <span className="text-[10px] text-zinc-500 font-medium font-display leading-tight text-center">
                {isBackgroundLockActive ? 'बैटरी सुरक्षित' : 'अलार्म रुक सकता है'}
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Stat Cards */}
        <DashboardStats reminders={reminders} />

        {/* PWA Home Screen Banner & Installation Guide */}
        <div id="pwa-install-banner" className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 md:p-6 space-y-5 relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 rounded-full blur-3xl -z-10" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-red-500/10 text-red-400 rounded-lg">
                  <Smartphone className="w-5 h-5" />
                </span>
                <h2 className="text-sm font-bold font-display text-zinc-100 uppercase tracking-wider">
                  Mobile Home Screen (PWA) App
                </h2>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
                इस ऐप को सीधे अपने मोबाइल की होम स्क्रीन (Home Screen) पर इंस्टॉल करें। PWA इंस्टॉल करने से आपको एक असली मोबाइल ऐप जैसा अनुभव मिलेगा और रिमाइंडर अलर्ट्स सही से काम करेंगे!
              </p>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10px] self-start md:self-auto">
              <span className="text-zinc-500">STATUS:</span>
              {isInstalled ? (
                <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> INSTALLED / PWA MODE
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> BROWSER MODE
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1 border-t border-zinc-800/40">
            {deferredPrompt && (
              <button
                onClick={triggerInstallPrompt}
                id="btn-direct-install-pwa"
                className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-zinc-50 text-xs font-bold rounded-xl shadow-lg shadow-red-500/15 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" /> 📥 Install App (होम स्क्रीन पर लाएं)
              </button>
            )}

            <button
              onClick={() => setShowInstallGuide(!showInstallGuide)}
              id="btn-toggle-pwa-guide"
              className="px-4 py-2.5 bg-zinc-950 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 hover:text-zinc-50 text-xs font-semibold rounded-xl flex items-center gap-2 active:scale-97 transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-zinc-400" /> 
              {showInstallGuide ? "Hide Setup Guide" : "How to Install? (इंस्टॉल कैसे करें?)"}
            </button>
          </div>

          <AnimatePresence>
            {showInstallGuide && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-5 pt-4 border-t border-zinc-800/60"
              >
                {/* Installation Guides */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Android Card */}
                  <div className="bg-zinc-950/60 border border-zinc-800/40 rounded-xl p-4 space-y-2">
                    <h4 className="font-bold text-zinc-200 flex items-center gap-1.5">
                      <span className="text-red-400">🤖</span> Android Users (Chrome):
                    </h4>
                    <ol className="list-decimal pl-4 space-y-1.5 text-zinc-400 font-normal leading-relaxed">
                      <li>Chrome browser में इस वेबसाइट को खोलें।</li>
                      <li>यदि ऊपर <strong className="text-red-400">"Install App"</strong> बटन दिखाई दे तो उसपर क्लिक करें।</li>
                      <li>या फिर दाईं ओर कोने में <strong className="text-zinc-300">3 Dots (Menu)</strong> पर क्लिक करें।</li>
                      <li>वहां <strong className="text-red-400">"Add to Home screen"</strong> या <strong className="text-red-400">"Install app"</strong> का विकल्प चुनें।</li>
                    </ol>
                  </div>

                  {/* iOS Card */}
                  <div className="bg-zinc-950/60 border border-zinc-800/40 rounded-xl p-4 space-y-2">
                    <h4 className="font-bold text-zinc-200 flex items-center gap-1.5">
                      <span className="text-red-400">🍎</span> iPhone / iPad Users (Safari):
                    </h4>
                    <ol className="list-decimal pl-4 space-y-1.5 text-zinc-400 font-normal leading-relaxed">
                      <li>Safari browser में इस वेबसाइट को खोलें।</li>
                      <li>नीचे दिए गए <strong className="text-red-400 font-semibold flex items-center gap-1 inline-flex">Share <Share2 className="w-3.5 h-3.5 text-red-400" /></strong> बटन पर क्लिक करें।</li>
                      <li>थोड़ा नीचे स्क्रॉल करें और <strong className="text-red-400">"Add to Home Screen"</strong> पर क्लिक करें।</li>
                      <li>अब यह आपके iPhone के होम स्क्रीन पर एक असली ऐप की तरह आ जाएगा!</li>
                    </ol>
                  </div>
                </div>

                {/* Battery Optimization / App Keep Alive Guides */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                      🔋 Background Settings (अलार्म को चालू रखने के लिए चुनें):
                    </h4>
                    <p className="text-[10px] text-zinc-500 leading-normal">
                      मोबाइल कंपनियां बैटरी बचाने के लिए बंद ऐप्स का अलार्म रोक देती हैं। अपने मोबाइल ब्रांड के अनुसार ये सेटिंग्स करें:
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800/60">
                    {[
                      { id: 'all', label: '📌 सभी मोबाइल्स' },
                      { id: 'samsung', label: '📱 Samsung' },
                      { id: 'xiaomi', label: '📱 Xiaomi/POCO' },
                      { id: 'oneplus', label: '📱 OnePlus/OPPO' },
                      { id: 'iphone', label: '🍎 iPhone' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSelectedBrand(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          selectedBrand === tab.id
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Brand Guide Content */}
                  <div className="bg-zinc-950/40 border border-zinc-800/30 rounded-xl p-4 min-h-[140px] text-xs">
                    {selectedBrand === 'all' && (
                      <div className="space-y-2">
                        <h5 className="font-bold text-zinc-300 flex items-center gap-1.5">
                          ⭐ अलार्म मिस न होने देने के मुख्य नियम:
                        </h5>
                        <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 font-normal leading-relaxed">
                          <li>
                            <strong className="text-zinc-200">सिर्फ मिनिमाइज़ (Minimize) करें:</strong> जब आप अलार्म सेट करें, तो ऐप को होम बटन दबाकर बैकग्राउंड में छोड़ दें। रीसेंट ऐप्स की लिस्ट से ऊपर स्वाइप करके बंद न करें।
                          </li>
                          <li>
                            <strong className="text-zinc-200">डोंट डिस्टर्ब (Do Not Disturb):</strong> चेक कर लें कि आपका फोन साइलेंट या "डीएनडी" मोड में न हो।
                          </li>
                          <li>
                            <strong className="text-zinc-200">Notification permission:</strong> अगर नोटिफिकेशन परमीशन ब्लॉक है तो ऊपर जाकर उसे अनुमति प्रदान करें।
                          </li>
                        </ul>
                      </div>
                    )}

                    {selectedBrand === 'samsung' && (
                      <div className="space-y-2">
                        <h5 className="font-bold text-zinc-300 flex items-center gap-1.5">
                          ⚙️ Samsung मोबाइल की आवश्यक सेटिंग्स:
                        </h5>
                        <ol className="list-decimal pl-4 space-y-1.5 text-zinc-400 font-normal leading-relaxed">
                          <li>अपने सैमसंग फोन में नीचे से स्वाइप करके <strong className="text-zinc-200">Recent Apps (रीसेंट ऐप्स)</strong> स्क्रीन खोलें।</li>
                          <li>इस रिमाइंडर ऐप (Reminders) के गोल लोगो पर टैप करें और <strong className="text-red-400 font-bold">"Keep open"</strong> पर क्लिक करें। इससे ऐप हमेशा खुला रहेगा।</li>
                          <li>फोन की <strong className="text-zinc-200">Settings &gt; Apps &gt; Chrome/Reminders</strong> में जाएं।</li>
                          <li>वहां <strong className="text-zinc-200">Battery</strong> पर क्लिक करें और इसे <strong className="text-emerald-400 font-bold">"Unrestricted"</strong> पर सेट करें ताकि बैकग्राउंड में अलार्म बजे।</li>
                        </ol>
                      </div>
                    )}

                    {selectedBrand === 'xiaomi' && (
                      <div className="space-y-2">
                        <h5 className="font-bold text-zinc-300 flex items-center gap-1.5">
                          ⚙️ Xiaomi / Redmi / POCO मोबाइल की सेटिंग्स:
                        </h5>
                        <ol className="list-decimal pl-4 space-y-1.5 text-zinc-400 font-normal leading-relaxed">
                          <li><strong className="text-zinc-200">Recent Apps</strong> स्क्रीन खोलें, इस ऐप की स्क्रीन पर लॉन्ग-प्रेस (उंगली दबाकर रखें) करें।</li>
                          <li>वहां दिख रहे <strong className="text-red-400 font-bold">Lock (ताले 🔒)</strong> वाले आइकॉन पर क्लिक करें ताकि यह बैकग्राउंड से डिलीट न हो।</li>
                          <li>अपने फोन की <strong className="text-zinc-200">Settings &gt; Apps &gt; Manage Apps &gt; Reminders/Chrome</strong> में जाएं।</li>
                          <li>वहां <strong className="text-zinc-200">Battery Saver</strong> पर जाकर <strong className="text-emerald-400 font-bold">"No restrictions"</strong> चुनें।</li>
                        </ol>
                      </div>
                    )}

                    {selectedBrand === 'oneplus' && (
                      <div className="space-y-2">
                        <h5 className="font-bold text-zinc-300 flex items-center gap-1.5">
                          ⚙️ OnePlus / OPPO / Realme मोबाइल की सेटिंग्स:
                        </h5>
                        <ol className="list-decimal pl-4 space-y-1.5 text-zinc-400 font-normal leading-relaxed">
                          <li><strong className="text-zinc-200">Recent Apps</strong> खोलें और इस ऐप के ऊपर कोने में दिए गए 3 डॉट्स (:) पर क्लिक करें।</li>
                          <li>वहां लिस्ट में से <strong className="text-red-400 font-bold">"Lock"</strong> विकल्प को चुनें।</li>
                          <li>फोन की <strong className="text-zinc-200">Settings &gt; Apps &gt; App Management &gt; Reminders/Chrome</strong> में जाएं।</li>
                          <li>वहां <strong className="text-zinc-200">Battery Usage</strong> में जाएं और <strong className="text-emerald-400 font-bold">"Allow background activity"</strong> को इनेबल कर दें।</li>
                        </ol>
                      </div>
                    )}

                    {selectedBrand === 'iphone' && (
                      <div className="space-y-2">
                        <h5 className="font-bold text-zinc-300 flex items-center gap-1.5">
                          ⚙️ Apple iPhone (iOS) की आवश्यक सेटिंग्स:
                        </h5>
                        <ol className="list-decimal pl-4 space-y-1.5 text-zinc-400 font-normal leading-relaxed">
                          <li>iPhone पर सफारी (Safari) या इस इंस्टॉल किए हुए PWA ऐप को ऊपर की तरफ स्वाइप करके पूरी तरह बंद (Close) न करें, इसे बैकग्राउंड में रहने दें।</li>
                          <li>iPhone की <strong className="text-zinc-200">Settings &gt; General &gt; Background App Refresh</strong> में जाएं।</li>
                          <li>सुनिश्चित करें कि <strong className="text-emerald-400 font-bold">"Background App Refresh"</strong> और वाई-फाई/डेटा चालू है।</li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>

                {/* Important Alert Callout */}
                <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                  <h4 className="font-bold text-red-400 text-xs mb-1.5 flex items-center gap-1.5">
                    ⚠️ महत्वपूर्ण जानकारी (PWA Technology Limitations):
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 leading-relaxed text-[11px]">
                    <li>
                      <strong className="text-zinc-300">Chrome Band (Closed) Alerts:</strong> जब आप किसी भी ऐप या ब्राउज़र को पूरी तरह रीसेंट स्क्रीन से हटाकर बंद कर देते हैं, तो फोन ऑपरेटिंग सिस्टम सुरक्षा कारणों से सभी लोकल बैकग्राउंड टाइमर को सस्पेंड कर देता है।
                    </li>
                    <li>
                      <strong className="text-zinc-300">उपाय (Solution):</strong> इस ऐप को होम स्क्रीन पर लाएं, और अलार्म सेट करने के बाद होम बटन दबाकर केवल मिनिमाइज़ करें (पूरी तरह क्लोज़ न करें)। इससे अलार्म 100% सही समय पर बजेगा।
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
