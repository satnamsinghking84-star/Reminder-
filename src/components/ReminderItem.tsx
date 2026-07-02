import { useEffect, useState } from 'react';
import { Trash2, Clock, Calendar, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { Reminder } from '../types';

interface ReminderItemProps {
  key?: string;
  reminder: Reminder;
  onDelete: (id: string) => void;
}

export default function ReminderItem({ reminder, onDelete }: ReminderItemProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false); // Less than 1 minute remaining

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(reminder.dateTime).getTime();
      const diff = target - now;

      if (reminder.triggered || diff <= 0) {
        setTimeLeft('Triggered');
        setIsUrgent(false);
        return;
      }

      // Convert to days, hours, minutes, seconds
      const seconds = Math.floor((diff / 1000) % 60);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      // Color coding urgency: if under 1 minute, highlight red
      if (diff <= 60000) {
        setIsUrgent(true);
      } else {
        setIsUrgent(false);
      }

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setTimeLeft(`In ${parts.join(' ')}`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [reminder]);

  const formattedDate = new Date(reminder.dateTime).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = new Date(reminder.dateTime).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isTriggered = reminder.triggered || new Date(reminder.dateTime).getTime() <= new Date().getTime();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all duration-300 ${
        isTriggered
          ? 'bg-zinc-950/40 border-zinc-900/60 opacity-60'
          : isUrgent
          ? 'bg-red-500/5 border-red-500/30 shadow-md shadow-red-500/5 animate-subtle-glow'
          : 'bg-zinc-900/80 border-zinc-800/60 hover:border-zinc-700/80'
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div
          className={`mt-1 p-2 rounded-lg flex-shrink-0 border ${
            isTriggered
              ? 'bg-zinc-900 border-zinc-800 text-zinc-500'
              : isUrgent
              ? 'bg-red-500/15 border-red-500/20 text-red-400'
              : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'
          }`}
        >
          {isTriggered ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : isUrgent ? (
            <AlertTriangle className="w-4 h-4 animate-bounce" />
          ) : (
            <Clock className="w-4 h-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className={`text-sm font-semibold truncate leading-snug font-sans ${
              isTriggered ? 'text-zinc-500 line-through' : 'text-zinc-100'
            }`}
          >
            {reminder.title}
          </h3>
          
          {reminder.notes && !isTriggered && (
            <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-md font-sans">
              {reminder.notes}
            </p>
          )}

          <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2 text-[11px] font-mono font-medium text-zinc-500">
            <span className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-900">
              <Calendar className="w-3 h-3" /> {formattedDate}
            </span>
            <span className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-900">
              <Clock className="w-3 h-3" /> {formattedTime}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Real-time Ticking Countdown Badge */}
        <span
          className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-full border ${
            isTriggered
              ? 'bg-zinc-950 text-zinc-500 border-zinc-900'
              : isUrgent
              ? 'bg-red-500/15 text-red-400 border-red-500/30'
              : 'bg-zinc-800 text-zinc-300 border-zinc-700/50'
          }`}
        >
          {timeLeft}
        </span>

        <button
          onClick={() => onDelete(reminder.id)}
          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-500/15 focus:outline-none focus:ring-1 focus:ring-red-500/30"
          title="Delete Reminder"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
