import { useState, FormEvent } from 'react';
import { Plus, Calendar, Clock, Sparkles } from 'lucide-react';

interface ReminderFormProps {
  onAddReminder: (title: string, notes: string, dateTime: string) => void;
}

export default function ReminderForm({ onAddReminder }: ReminderFormProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [error, setError] = useState('');

  // Helper to get formatted string for input type="datetime-local"
  // e.g. "2026-07-02T15:00"
  const getFutureISOString = (minutesToAdd: number) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutesToAdd);
    
    // Account for timezone offset to get local time string in YYYY-MM-DDTHH:mm format
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  };

  // Pre-fill with a reasonable default: next 15 minutes
  if (!dateTime) {
    setDateTime(getFutureISOString(15));
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Reminder title is required.');
      return;
    }

    if (!dateTime) {
      setError('Please select a date and time.');
      return;
    }

    const selectedTime = new Date(dateTime).getTime();
    const now = new Date().getTime();

    if (selectedTime <= now) {
      setError('Please choose a time in the future.');
      return;
    }

    onAddReminder(title.trim(), notes.trim(), dateTime);
    setTitle('');
    setNotes('');
    
    // Reset to 15 minutes in the future for next entry
    setDateTime(getFutureISOString(15));
  };

  const handleQuickAdd = (minutes: number, label: string) => {
    const calculatedTime = getFutureISOString(minutes);
    const quickTitle = `Reminder (+${label})`;
    onAddReminder(quickTitle, `Quick reminder set for ${label} from now.`, calculatedTime);
  };

  return (
    <div id="reminder-form-container" className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
        <Clock className="w-16 h-16 text-red-500" />
      </div>

      <h2 className="text-lg font-bold font-display text-zinc-50 flex items-center gap-2 mb-4">
        <span className="p-1.5 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
          <Calendar className="w-4 h-4" />
        </span>
        Create New Reminder
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
            Title / Note
          </label>
          <input
            id="input-reminder-title"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError('');
            }}
            placeholder="e.g. Call the dentist, Water the plants..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-50 placeholder-zinc-500 font-sans focus:border-red-500/50"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
            Details / Notes (Optional)
          </label>
          <textarea
            id="input-reminder-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any extra details..."
            rows={2}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-50 placeholder-zinc-500 font-sans resize-none focus:border-red-500/50"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Alert Date & Time
            </label>
            <input
              id="input-reminder-datetime"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => {
                setDateTime(e.target.value);
                if (error) setError('');
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-50 focus:border-red-500/50 font-sans text-left"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-red-400" /> Quick Creation
            </label>
            <div className="grid grid-cols-2 gap-2 h-[46px]">
              <button
                type="button"
                id="btn-quick-5m"
                onClick={() => handleQuickAdd(5, '5m')}
                className="bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 text-xs font-medium rounded-xl text-zinc-300 active:scale-95 transition-all duration-150 cursor-pointer"
              >
                +5 Min
              </button>
              <button
                type="button"
                id="btn-quick-1h"
                onClick={() => handleQuickAdd(60, '1h')}
                className="bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 text-xs font-medium rounded-xl text-zinc-300 active:scale-95 transition-all duration-150 cursor-pointer"
              >
                +1 Hour
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 font-medium flex items-center gap-1.5 animate-pulse bg-red-500/5 border border-red-500/10 p-2.5 rounded-lg">
            <span>⚠️</span> {error}
          </p>
        )}

        <button
          type="submit"
          id="btn-add-reminder"
          className="w-full py-3.5 bg-red-600 hover:bg-red-500 active:scale-99 text-zinc-50 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-red-600/10 cursor-pointer text-sm font-display"
        >
          <Plus className="w-4 h-4" /> Save Reminder
        </button>
      </form>
    </div>
  );
}
