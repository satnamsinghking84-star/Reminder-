import { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle2, ShieldAlert } from 'lucide-react';

interface PermissionPromptProps {
  onPermissionChange: (status: NotificationPermission) => void;
}

export default function PermissionPrompt({ onPermissionChange }: PermissionPromptProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (!('Notification' in window)) {
      setIsSupported(false);
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
    if (!isSupported) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      onPermissionChange(result);
    } catch (error) {
      console.warn('Failed to request notification permission:', error);
    }
  };

  if (!isSupported) {
    return (
      <div id="notif-support-alert" className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/10 flex-shrink-0">
          <BellOff className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-amber-300 font-display">System Notifications Unsupported</h4>
          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
            Your browser doesn't support the HTML5 Notification API. Local blinking and audio alarms will still trigger as long as this tab is open.
          </p>
        </div>
      </div>
    );
  }

  if (permission === 'granted') {
    return (
      <div id="notif-allowed-banner" className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/10 flex-shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-bold text-emerald-400 font-display">Notifications Activated</h4>
          <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
            Your browser will receive alert notifications even when the app is in the background or minimized.
          </p>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div id="notif-blocked-banner" className="bg-red-500/5 border border-red-500/25 rounded-2xl p-4 flex items-start gap-3">
        <div className="p-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/15 flex-shrink-0">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-red-400 font-display">Notifications Blocked</h4>
          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
            You blocked notifications for this site. To fix this: click the padlock icon in the browser address bar, reset notification permissions to <strong>"Allow"</strong>, then reload the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="notif-request-banner" className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-red-500/5">
      <div className="absolute -top-10 -left-10 w-32 h-32 bg-red-500/5 blur-3xl rounded-full" />
      <div className="flex items-start gap-3.5 relative z-10">
        <div className="p-3 bg-red-600/10 text-red-400 rounded-2xl border border-red-500/20 flex-shrink-0 animate-pulse">
          <Bell className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-zinc-100 font-display">Enable Push Notifications</h4>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
            Allow notifications to trigger alarm alerts even when this browser tab is minimized, lock-screened, or in the background.
          </p>
        </div>
      </div>
      <button
        onClick={requestPermission}
        id="btn-request-notif-permission"
        className="relative z-10 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-zinc-50 font-semibold rounded-xl text-xs uppercase tracking-wider font-display shadow-md shadow-red-600/25 active:scale-97 transition-all duration-150 cursor-pointer text-center"
      >
        Enable Alerts
      </button>
    </div>
  );
}
