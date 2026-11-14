import { AlertTriangle, CalendarOff, Clock, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Employee, TimeOffEntry, TimeOffReason } from '../types';
import {
  calculateScheduledMinutesForRange,
  enumerateIsoDates,
  formatIsoDateBr,
  formatMinutesAsHours,
  formatSignedMinutes,
  getTodayIsoDate,
  jsDayToDayKey,
  parseIsoDateLocal,
  TIME_OFF_REASON_LABELS,
} from '../utils/schedule';

interface TimeOffModalProps {
  open: boolean;
  employees: Employee[];
  existingTimeOffs: TimeOffEntry[];
  overtimeBalances: Record<string, { balanceMinutes: number }>;
  defaultEmployeeId?: string;
  defaultDate?: string;
  onSave: (payload: {
    employeeId: string;
    startDate: string;
    endDate: string;
    reason: TimeOffReason;
    deductFromBank: boolean;
    deductedMinutes: number;
    note: string;
  }) => Promise<void>;
  onClose: () => void;
}

const REASONS: { value: TimeOffReason; label: string; hint: string }[] = [
  { value: 'banco_horas', label: 'Banco de horas', hint: 'Desconta horas do saldo' },
  { value: 'ferias', label: 'Férias', hint: 'Período programado' },
  { value: 'atestado', label: 'Atestado médico', hint: 'Ausência justificada' },
  { value: 'outros', label: 'Outros', hint: 'Licença / folga especial' },
];

export function TimeOffModal({
  open,
  employees,
  existingTimeOffs,
  overtimeBalances,
  defaultEmployeeId,
  defaultDate,
  onSave,
  onClose,
}: TimeOffModalProps) {
  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees]);
  const [employeeId, setEmployeeId] = useState('');
  const [reason, setReason] = useState<TimeOffReason>('banco_horas');
  const [startDate, setStartDate] = useState(getTodayIsoDate());
  const [endDate, setEndDate] = useState(getTodayIsoDate());
  const [deductFromBank, setDeductFromBank] = useState(true);
  const [deductHours, setDeductHours] = useState(8);
  const [deductMinutes, setDeductMinutes] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const initialDate = defaultDate || getTodayIsoDate();
    setStartDate(initialDate);
    setEndDate(initialDate);
    setReason('banco_horas');
    setDeductFromBank(true);
    setNote('');

    const targetEmp =
      (defaultEmployeeId && activeEmployees.find((e) => e.id === defaultEmployeeId)) ||
      activeEmployees[0] ||
      null;
    setEmployeeId(targetEmp?.id || '');

    if (targetEmp) {
      const scheduledMin = calculateScheduledMinutesForRange(
        targetEmp.schedule,
        initialDate,
        initialDate,
      );
      const safeMin = Math.min(1440, scheduledMin > 0 ? scheduledMin : 480);
      setDeductHours(Math.floor(safeMin / 60));
      setDeductMinutes(safeMin % 60);
    } else {
      setDeductHours(8);
      setDeductMinutes(0);
    }
  }, [open, defaultEmployeeId, defaultDate, activeEmployees]);

  const selectedEmployee = useMemo(
    () => activeEmployees.find((e) => e.id === employeeId) ?? null,
    [activeEmployees, employeeId],
  );

  const syncSuggestedHours = (emp: Employee | null, start: string, end: string) => {
    if (!emp || !start || !end || end < start) return;
    const scheduled = calculateScheduledMinutesForRange(emp.schedule, start, end);
    const fallback = scheduled > 0 ? scheduled : 480;
    const clamped = Math.min(1440, fallback);
    setDeductHours(Math.floor(clamped / 60));
    setDeductMinutes(clamped % 60);
  };

  const handleEmployeeChange = (nextId: string) => {
    setEmployeeId(nextId);
    const emp = activeEmployees.find((e) => e.id === nextId) ?? null;
    if (deductFromBank) {
      syncSuggestedHours(emp, startDate, endDate);
    }
  };

  const handleReasonChange = (nextReason: TimeOffReason) => {
    setReason(nextReason);
    if (nextReason === 'banco_horas') {
      setDeductFromBank(true);
      syncSuggestedHours(selectedEmployee, startDate, endDate);
    } else if (nextReason === 'ferias' || nextReason === 'atestado') {
      setDeductFromBank(false);
    }
  };

  const handleStartDateChange = (nextStart: string) => {
    setStartDate(nextStart);
    const nextEnd = endDate < nextStart || reason === 'banco_horas' ? nextStart : endDate;
    if (nextEnd !== endDate) setEndDate(nextEnd);
    if (deductFromBank) {
      syncSuggestedHours(selectedEmployee, nextStart, nextEnd);
    }
  };

  const handleEndDateChange = (nextEnd: string) => {
    setEndDate(nextEnd);
    if (deductFromBank && nextEnd >= startDate) {
      syncSuggestedHours(selectedEmployee, startDate, nextEnd);
    }
  };

  const collisionWarnings = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return [];
    const dates = enumerateIsoDates(startDate, endDate, 15);
    const warnings: { iso: string; othersOffNames: string[]; availableAfter: number }[] = [];

    for (const iso of dates) {
      const dayKey = jsDayToDayKey(parseIsoDateLocal(iso).getDay());
      const othersPlanned = existingTimeOffs.filter(
        (t) => t.employeeId !== employeeId && t.startDate <= iso && t.endDate >= iso,
      );
      const othersPlannedIds = new Set(othersPlanned.map((t) => t.employeeId));

      const othersWeeklyOff = activeEmployees.filter(
        (e) =>
          e.id !== employeeId &&
          !othersPlannedIds.has(e.id) &&
          !e.schedule[dayKey]?.working,
      );

      const availableCount = activeEmployees.filter(
        (e) =>
          e.id !== employeeId &&
          e.schedule[dayKey]?.working &&
          !othersPlannedIds.has(e.id),
      ).length;

      const offNames = [
        ...othersPlanned.map(
          (t) => `${t.employeeName} (${TIME_OFF_REASON_LABELS[t.reason]})`,
        ),
        ...othersWeeklyOff.map((e) => `${e.name} (Folga semanal)`),
      ];

      if (othersPlanned.length > 0 || availableCount <= Math.ceil(activeEmployees.length / 2)) {
        warnings.push({
          iso,
          othersOffNames: offNames,
          availableAfter: availableCount,
        });
      }
    }
    return warnings;
  }, [startDate, endDate, existingTimeOffs, employeeId, activeEmployees]);

  if (!open) return null;

  const totalDeductMinutes = deductFromBank ? deductHours * 60 + deductMinutes : 0;
  const currentBalance = employeeId ? (overtimeBalances[employeeId]?.balanceMinutes ?? 0) : 0;
  const projectedBalance = currentBalance - totalDeductMinutes;
  const scheduledInPeriod = selectedEmployee
    ? calculateScheduledMinutesForRange(selectedEmployee.schedule, startDate, endDate)
    : 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      setError('Selecione um funcionário ativo.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      setError('Informe datas válidas.');
      return;
    }
    if (endDate < startDate) {
      setError('A data final deve ser igual ou posterior à data inicial.');
      return;
    }
    if (deductFromBank) {
      if (totalDeductMinutes <= 0 || totalDeductMinutes > 1440) {
        setError('O desconto no banco de horas por lançamento deve ser entre 0h01 e 24h00.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        employeeId,
        startDate,
        endDate,
        reason,
        deductFromBank,
        deductedMinutes: totalDeductMinutes,
        note: note.trim(),
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Não foi possível agendar: ${err.message}`
          : 'Erro ao agendar folga/ausência.',
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
      aria-labelledby="timeoff-modal-title"
    >
      <div className="w-full max-w-xl max-h-[92vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <CalendarOff className="w-5 h-5 text-blue-700" />
            <h2 id="timeoff-modal-title" className="text-base font-bold text-slate-900">
              Agendar Folga ou Ausência Planejada
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

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="to-employee" className="block text-sm font-medium text-slate-800 mb-1.5">
                Funcionário
              </label>
              <select
                id="to-employee"
                value={employeeId}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-800 mb-1.5">
                Motivo da ausência
              </span>
              <div className="grid grid-cols-2 gap-2">
                {REASONS.map((item) => {
                  const selected = reason === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleReasonChange(item.value)}
                      className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-semibold">{item.label}</p>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          selected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {item.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="to-start" className="block text-sm font-medium text-slate-800 mb-1.5">
                  Data de início
                </label>
                <input
                  id="to-start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="to-end" className="block text-sm font-medium text-slate-800 mb-1.5">
                  Data de término
                </label>
                <input
                  id="to-end"
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      Descontar do banco de horas
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Lança automaticamente uma compensação (-) no banco de horas do colaborador.
                    </p>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={deductFromBank}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setDeductFromBank(next);
                      if (next) syncSuggestedHours(selectedEmployee, startDate, endDate);
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  Descontar
                </label>
              </div>

              {deductFromBank && (
                <div className="pt-2 border-t border-slate-200 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="to-dh" className="block text-xs font-medium text-slate-700 mb-1">
                        Horas a descontar
                      </label>
                      <input
                        id="to-dh"
                        type="number"
                        min={0}
                        max={24}
                        value={deductHours}
                        onChange={(e) =>
                          setDeductHours(Math.max(0, Math.min(24, Number(e.target.value) || 0)))
                        }
                        className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label htmlFor="to-dm" className="block text-xs font-medium text-slate-700 mb-1">
                        Minutos
                      </label>
                      <input
                        id="to-dm"
                        type="number"
                        min={0}
                        max={59}
                        value={deductMinutes}
                        onChange={(e) =>
                          setDeductMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
                        }
                        className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-600">
                    <span>
                      Jornada prevista: {formatMinutesAsHours(scheduledInPeriod)}
                    </span>
                    <span>
                      Saldo atual: {formatSignedMinutes(currentBalance)} → Após:{' '}
                      <strong
                        className={
                          projectedBalance >= 0 ? 'text-slate-900' : 'text-red-700'
                        }
                      >
                        {formatSignedMinutes(projectedBalance)}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {collisionWarnings.length > 0 && (
              <div className="border border-amber-300 bg-amber-50/70 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  Atenção ao impacto no quadro de funcionários
                </div>
                <div className="space-y-1 text-xs text-amber-900/90">
                  {collisionWarnings.slice(0, 4).map((w) => (
                    <p key={w.iso}>
                      <span className="font-mono font-semibold">{formatIsoDateBr(w.iso)}</span>:
                      restarão <strong>{w.availableAfter}</strong> trabalhando
                      {w.othersOffNames.length > 0
                        ? ` · Também ausentes: ${w.othersOffNames.join(', ')}`
                        : ''}
                    </p>
                  ))}
                  {collisionWarnings.length > 4 && (
                    <p className="text-[11px] text-amber-800">
                      + {collisionWarnings.length - 4} dia(s) adicionais com alerta no período.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="to-note" className="block text-sm font-medium text-slate-800 mb-1.5">
                Observação (opcional)
              </label>
              <input
                id="to-note"
                type="text"
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: Folga combinada, CID/atestado de 2 dias, viagem programada..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || activeEmployees.length === 0}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? 'Agendando...' : 'Confirmar agendamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
