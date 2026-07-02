import { useEffect, useState } from 'react';
import { ShieldCheck, Clock, CalendarClock } from 'lucide-react';
import { Reminder } from '../types';

interface DashboardStatsProps {
  reminders: Reminder[];
}

export default function DashboardStats({ reminders }: DashboardStatsProps) {
  const [nextAlarmStr, setNextAlarmStr] = useState('None scheduled');

  const pending = reminders.filter((r) => !r.triggered && new Date(r.dateTime).getTime() > Date.now()).length;
  const triggeredCount = reminders.filter((r) => r.triggered || new Date(r.dateTime).getTime() <= Date.now()).length;

  useEffect(() => {
    const updateNextAlarm = () => {
      const activeFutureReminders = reminders
        .filter((r) => !r.triggered && new Date(r.dateTime).getTime() > Date.now())
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

      if (activeFutureReminders.length === 0) {
        setNextAlarmStr('None scheduled');
        return;
      }

      const next = activeFutureReminders[0];
      const diffMs = new Date(next.dateTime).getTime() - Date.now();
      
      const minLeft = Math.ceil(diffMs / 60000);
      if (minLeft <= 1) {
        setNextAlarmStr('Triggering now...');
      } else if (minLeft < 60) {
        setNextAlarmStr(`In ${minLeft} min (${next.title})`);
      } else {
        const hours = Math.floor(minLeft / 60);
        const mins = minLeft % 60;
        setNextAlarmStr(`In ${hours}h ${mins}m (${next.title})`);
      }
    };

    updateNextAlarm();
    const interval = setInterval(updateNextAlarm, 10000); // Check every 10s to be efficient

    return () => clearInterval(interval);
  }, [reminders]);

  return (
    <div id="dashboard-stats-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Pending Reminders Card */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-3 shadow-md relative overflow-hidden">
        <div className="p-2.5 bg-red-500/10 text-red-400 border border-red-500/10 rounded-xl">
          <CalendarClock className="w-5 h-5" />
        </div>
        <div>
          <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Active Alerts
          </span>
          <span className="text-xl font-bold font-display text-zinc-100">{pending}</span>
        </div>
      </div>

      {/* Next Alarm Card */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-3 shadow-md col-span-2 relative overflow-hidden">
        <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/10 rounded-xl">
          <Clock className="w-5 h-5 animate-pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Next Scheduled Trigger
          </span>
          <span className="text-sm font-bold font-mono text-zinc-200 truncate block mt-0.5" title={nextAlarmStr}>
            {nextAlarmStr}
          </span>
        </div>
      </div>

      {/* Completed/History Card */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-3 shadow-md relative overflow-hidden">
        <div className="p-2.5 bg-zinc-800 text-zinc-400 border border-zinc-700/30 rounded-xl">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Passed
          </span>
          <span className="text-xl font-bold font-display text-zinc-400">{triggeredCount}</span>
        </div>
      </div>
    </div>
  );
}
