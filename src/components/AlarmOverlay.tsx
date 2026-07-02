import { motion } from 'motion/react';
import { Bell, Volume2, ShieldAlert } from 'lucide-react';
import { Reminder } from '../types';

interface AlarmOverlayProps {
  activeReminder: Reminder | null;
  onDismiss: () => void;
}

export default function AlarmOverlay({ activeReminder, onDismiss }: AlarmOverlayProps) {
  if (!activeReminder) return null;

  return (
    <div id="alarm-overlay-root" className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 animate-blink-red select-none">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 180 }}
        className="bg-zinc-900/90 border border-red-500/30 backdrop-blur-md rounded-2xl p-8 max-w-md w-full text-center flex flex-col items-center justify-center gap-6 shadow-2xl relative overflow-hidden"
      >
        {/* Glow effect */}
        <div className="absolute -inset-10 bg-red-500/10 blur-3xl rounded-full" />

        {/* Pulsing alarm bell */}
        <div className="relative z-10 p-5 bg-red-500/10 rounded-full border border-red-500/20 animate-pulse-glow">
          <Bell className="w-16 h-16 text-red-500 fill-red-500/20" />
        </div>

        <div className="relative z-10 space-y-2">
          <span className="text-xs uppercase tracking-widest font-mono text-red-400 font-semibold px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-full inline-flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 animate-pulse" /> Alarm Triggered
          </span>
          <h2 className="text-2xl font-bold font-display text-zinc-50 tracking-tight leading-tight pt-2">
            {activeReminder.title}
          </h2>
          {activeReminder.notes && (
            <p className="text-sm text-zinc-400 max-h-24 overflow-y-auto no-scrollbar font-sans px-2">
              {activeReminder.notes}
            </p>
          )}
        </div>

        <div className="relative z-10 flex items-center justify-center gap-2 text-xs font-mono text-zinc-400">
          <Volume2 className="w-4 h-4 text-red-400 animate-bounce" />
          <span>Siren sounding & vibrating...</span>
        </div>

        <button
          id="btn-dismiss-alarm"
          onClick={onDismiss}
          className="relative z-10 w-full mt-2 py-4 bg-red-600 hover:bg-red-500 text-zinc-50 font-semibold rounded-xl shadow-lg shadow-red-600/30 active:scale-98 transition-all duration-200 uppercase tracking-wider font-display text-sm cursor-pointer border border-red-400/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
        >
          Dismiss Alert
        </button>
      </motion.div>
    </div>
  );
}
