import { Clock, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { Employee, OvertimeType } from '../types';
import { getTodayIsoDate } from '../utils/schedule';

interface OvertimeModalProps {
  open: boolean;
  employees: Employee[];
  defaultEmployeeId?: string;
  selfMode?: boolean;
  onSave: (payload: {
    employeeId: string;
    date: string;
    type: OvertimeType;
    minutes: number;
    note: string;
  }) => Promise<void>;
  onClose: () => void;
}

export function OvertimeModal({
  open,
  employees,
  defaultEmployeeId,
  selfMode = false,
  onSave,
  onClose,
}: OvertimeModalProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(getTodayIsoDate());
  const [type, setType] = useState<OvertimeType>('extra');
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDate(getTodayIsoDate());
    setType('extra');
    setHours(1);
    setMinutes(0);
    setNote('');
    if (defaultEmployeeId && employees.some((e) => e.id === defaultEmployeeId)) {
      setEmployeeId(defaultEmployeeId);
    } else if (employees.length > 0) {
      setEmployeeId(employees[0].id);
    } else {
      setEmployeeId('');
    }
  }, [open, defaultEmployeeId, employees]);

  if (!open) return null;

  const totalMinutes = hours * 60 + minutes;
  const lockedEmployee = selfMode
    ? employees.find((e) => e.id === employeeId) ?? employees[0] ?? null
    : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      setError('Selecione um funcionário.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Informe uma data válida.');
      return;
    }
    if (totalMinutes <= 0 || totalMinutes > 1440) {
      setError('A duração deve ser entre 1 minuto e 24 horas.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        employeeId,
        date,
        type,
        minutes: totalMinutes,
        note: note.trim(),
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? `Erro ao registrar: ${err.message}` : 'Erro ao registrar lançamento.',
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
      aria-labelledby="overtime-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-blue-700" />
            <h2 id="overtime-modal-title" className="text-base font-bold text-slate-900">
              {selfMode ? 'Registrar Minhas Horas Extras' : 'Registrar Horas Extras / Banco'}
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

          {selfMode && lockedEmployee ? (
            <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
              Colaborador:{' '}
              <span className="font-semibold text-slate-900">{lockedEmployee.name}</span> ·{' '}
              {lockedEmployee.storeName}
            </div>
          ) : (
            <div>
              <label htmlFor="ot-employee" className="block text-sm font-medium text-slate-800 mb-1.5">
                Funcionário
              </label>
              <select
                id="ot-employee"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.role}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className="block text-sm font-medium text-slate-800 mb-1.5">Tipo de movimento</span>
            <div className={`grid ${selfMode ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
              <button
                type="button"
                onClick={() => setType('extra')}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  type === 'extra'
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                + Hora Extra
              </button>
              <button
                type="button"
                onClick={() => setType('compensacao')}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  type === 'compensacao'
                    ? 'bg-amber-700 text-white border-amber-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                - Compensação
              </button>
              {!selfMode && (
                <button
                  type="button"
                  onClick={() => setType('pago')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    type === 'pago'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  - Paga em Folha
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="ot-date" className="block text-sm font-medium text-slate-800 mb-1.5">
                Data
              </label>
              <input
                id="ot-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="ot-hours" className="block text-sm font-medium text-slate-800 mb-1.5">
                Horas
              </label>
              <input
                id="ot-hours"
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(Math.max(0, Math.min(24, Number(e.target.value) || 0)))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="ot-minutes" className="block text-sm font-medium text-slate-800 mb-1.5">
                Minutos
              </label>
              <input
                id="ot-minutes"
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '30m', h: 0, m: 30 },
              { label: '1h', h: 1, m: 0 },
              { label: '1h30', h: 1, m: 30 },
              { label: '2h', h: 2, m: 0 },
              { label: '4h', h: 4, m: 0 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setHours(preset.h);
                  setMinutes(preset.m);
                }}
                className="px-2.5 py-1 text-xs font-mono text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="ot-note" className="block text-sm font-medium text-slate-800 mb-1.5">
              Observação / Motivo
            </label>
            <input
              id="ot-note"
              type="text"
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Fechamento de caixa, inventário, saída antecipada..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

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
              {saving ? 'Salvando...' : 'Salvar lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
