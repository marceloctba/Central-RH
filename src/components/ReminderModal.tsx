import { CalendarCheck2, Clock, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { Reminder } from '../types';
import { getTodayIsoDate } from '../utils/schedule';

interface ReminderModalProps {
  open: boolean;
  reminder: Reminder | null;
  defaultDate?: string;
  onSave: (payload: {
    date: string;
    time: string;
    title: string;
    note: string;
    done: boolean;
  }) => Promise<void>;
  onClose: () => void;
}

export function ReminderModal({
  open,
  reminder,
  defaultDate,
  onSave,
  onClose,
}: ReminderModalProps) {
  const [date, setDate] = useState(getTodayIsoDate());
  const [hasTime, setHasTime] = useState(true);
  const [time, setTime] = useState('09:00');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (reminder) {
      setDate(reminder.date);
      setHasTime(Boolean(reminder.time));
      setTime(reminder.time || '09:00');
      setTitle(reminder.title);
      setNote(reminder.note);
      setDone(reminder.done);
    } else {
      setDate(defaultDate || getTodayIsoDate());
      setHasTime(true);
      setTime('09:00');
      setTitle('');
      setNote('');
      setDone(false);
    }
  }, [open, reminder, defaultDate]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Informe a descrição do lembrete.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Informe uma data válida.');
      return;
    }
    if (hasTime && !/^\d{2}:\d{2}$/.test(time)) {
      setError('Informe um horário válido ou desmarque o horário específico.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        date,
        time: hasTime ? time : '',
        title: cleanTitle,
        note: note.trim(),
        done,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Não foi possível salvar o lembrete: ${err.message}`
          : 'Erro ao salvar lembrete.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <CalendarCheck2 className="w-5 h-5 text-blue-700" />
            <h2 id="reminder-modal-title" className="text-base font-bold text-slate-900">
              {reminder ? 'Editar Lembrete da Agenda' : 'Novo Lembrete na Agenda'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="rem-title" className="block text-sm font-medium text-slate-800 mb-1.5">
              O que você precisa lembrar?
            </label>
            <input
              id="rem-title"
              type="text"
              required
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Entrevista candidato para vaga de estoquista"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rem-date" className="block text-sm font-medium text-slate-800 mb-1.5">
                Data
              </label>
              <input
                id="rem-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="rem-time" className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Horário
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasTime}
                    onChange={(e) => setHasTime(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  Definir hora
                </label>
              </div>
              <input
                id="rem-time"
                type="time"
                disabled={!hasTime}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rem-note" className="block text-sm font-medium text-slate-800 mb-1.5">
              Detalhes / Observações (opcional)
            </label>
            <textarea
              id="rem-note"
              rows={3}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Candidato Carlos Eduardo · levar currículo impresso e documento"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
            />
          </div>

          {reminder && (
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={done}
                onChange={(e) => setDone(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              Marcar lembrete como concluído
            </label>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? 'Salvando...' : reminder ? 'Salvar alterações' : 'Salvar lembrete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
