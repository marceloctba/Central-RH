import {
  Calendar,
  CalendarOff,
  Clock,
  Plus,
  Store as StoreIcon,
  Trash2,
  Utensils,
} from 'lucide-react';
import type { Employee, OvertimeEntry, OvertimeType, TimeOffEntry } from '../types';
import {
  calculateDayWorkedMinutes,
  calculateWeeklyMinutes,
  computeOvertimeBalanceByEmployee,
  DAY_LABELS,
  DAY_ORDER,
  formatIsoDateBr,
  formatMinutesAsHours,
  formatSignedMinutes,
  getLiveShiftStatus,
  getTimeOffForEmployeeOnDate,
  getTodayDayKey,
  getTodayIsoDate,
  TIME_OFF_REASON_LABELS,
} from '../utils/schedule';
import { EmployeeAvatar } from './EmployeeAvatar';

interface EmployeeSelfViewProps {
  employees: Employee[];
  overtimeEntries: OvertimeEntry[];
  timeOffs: TimeOffEntry[];
  currentUserEmail: string;
  onAddSelfOvertime: (employee: Employee) => void;
  onDeleteSelfOvertime: (entry: OvertimeEntry) => void;
}

const TYPE_LABEL: Record<OvertimeType, string> = {
  extra: 'Hora Extra (+)',
  compensacao: 'Compensação (-)',
  pago: 'Paga em Folha (-)',
};

export function EmployeeSelfView({
  employees,
  overtimeEntries,
  timeOffs,
  currentUserEmail,
  onAddSelfOvertime,
  onDeleteSelfOvertime,
}: EmployeeSelfViewProps) {
  const todayKey = getTodayDayKey();
  const todayIso = getTodayIsoDate();
  const now = new Date();
  const balances = computeOvertimeBalanceByEmployee(overtimeEntries);
  const normalizedUserEmail = currentUserEmail.trim().toLowerCase();

  return (
    <div className="space-y-8">
      {employees.map((emp) => {
        const weeklyMinutes = calculateWeeklyMinutes(emp.schedule);
        const empEntries = overtimeEntries.filter((e) => e.employeeId === emp.id);
        const empTimeOffs = timeOffs.filter((t) => t.employeeId === emp.id);
        const todayTimeOff = getTimeOffForEmployeeOnDate(empTimeOffs, emp.id, todayIso);
        const balance = balances[emp.id] ?? {
          balanceMinutes: 0,
          totalExtraMinutes: 0,
          totalDeductedMinutes: 0,
          entryCount: 0,
        };
        const todayShift = emp.schedule[todayKey];
        const todayStatus = getLiveShiftStatus(todayShift, true, now);

        return (
          <div key={emp.id} className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <EmployeeAvatar name={emp.name} photoDataUrl={emp.photoDataUrl} size="xl" />
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <StoreIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>{emp.storeName || 'Loja'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{emp.role}</span>
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{emp.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                    {emp.email} · Nascimento: {formatIsoDateBr(emp.birthDate)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-6 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">Hoje ({DAY_LABELS[todayKey].short})</p>
                  {todayTimeOff ? (
                    <>
                      <p className="mt-0.5 text-sm font-semibold text-amber-800">
                        Ausência planejada
                      </p>
                      <p className="text-xs text-amber-700">
                        {TIME_OFF_REASON_LABELS[todayTimeOff.reason]}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {todayShift.working
                          ? `${todayShift.startTime}–${todayShift.endTime}`
                          : 'Folga'}
                      </p>
                      <p className="text-xs text-blue-700">{todayStatus.label}</p>
                    </>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Carga Semanal</p>
                  <p className="mt-0.5 text-sm font-bold font-mono tabular-nums text-slate-900">
                    {formatMinutesAsHours(weeklyMinutes)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Banco de H.E.</p>
                  <p
                    className={`mt-0.5 text-sm font-bold font-mono tabular-nums ${
                      balance.balanceMinutes > 0
                        ? 'text-emerald-700'
                        : balance.balanceMinutes < 0
                          ? 'text-red-700'
                          : 'text-slate-700'
                    }`}
                  >
                    {formatSignedMinutes(balance.balanceMinutes)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Minha Escala Semanal e Horário de Almoço
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                      <th className="py-3 px-5">Dia da Semana</th>
                      <th className="py-3 px-4">Jornada</th>
                      <th className="py-3 px-4">Almoço</th>
                      <th className="py-3 px-5 text-right">Horas Líquidas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {DAY_ORDER.map((dayKey) => {
                      const d = emp.schedule[dayKey];
                      const isToday = dayKey === todayKey;
                      const netMin = calculateDayWorkedMinutes(d);
                      return (
                        <tr
                          key={dayKey}
                          className={isToday ? 'bg-blue-50/40' : 'hover:bg-slate-50/70'}
                        >
                          <td className="py-3 px-5 font-medium text-slate-900">
                            {DAY_LABELS[dayKey].full}
                            {isToday && (
                              <span className="ml-2 text-xs font-semibold text-blue-700">
                                · Hoje
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-xs">
                            {d.working ? (
                              <span className="font-semibold text-slate-900">
                                {d.startTime} – {d.endTime}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-sans">Folga</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {!d.working ? (
                              <span className="text-slate-400">—</span>
                            ) : d.hasLunch && d.lunchStart && d.lunchEnd ? (
                              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-amber-800 font-medium">
                                <Utensils className="w-3.5 h-3.5 text-amber-600" />
                                {d.lunchStart} – {d.lunchEnd}
                              </span>
                            ) : (
                              <span className="text-slate-400">Sem intervalo</span>
                            )}
                          </td>
                          <td className="py-3 px-5 text-right font-mono tabular-nums text-xs text-slate-700">
                            {d.working ? formatMinutesAsHours(netMin) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {empTimeOffs.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
                  <CalendarOff className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Minhas Folgas Planejadas, Férias e Atestados
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                        <th className="py-3 px-5">Período</th>
                        <th className="py-3 px-4">Motivo</th>
                        <th className="py-3 px-4">Banco de Horas</th>
                        <th className="py-3 px-5">Observação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {empTimeOffs.map((to) => {
                        const singleDay = to.startDate === to.endDate;
                        return (
                          <tr key={to.id}>
                            <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-800 font-medium">
                              {singleDay
                                ? formatIsoDateBr(to.startDate)
                                : `${formatIsoDateBr(to.startDate)} → ${formatIsoDateBr(to.endDate)}`}
                            </td>
                            <td className="py-3 px-4 text-xs font-medium text-slate-900">
                              {TIME_OFF_REASON_LABELS[to.reason]}
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600">
                              {to.deductFromBank && to.deductedMinutes > 0
                                ? `-${formatMinutesAsHours(to.deductedMinutes)} descontado`
                                : 'Sem desconto'}
                            </td>
                            <td className="py-3 px-5 text-xs text-slate-600">
                              {to.note || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      Meu Histórico de Horas Extras
                    </h3>
                  </div>
                  <p className="mt-1 text-xs font-mono tabular-nums text-slate-600">
                    <span>Extras: +{formatMinutesAsHours(balance.totalExtraMinutes)}</span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span>
                      Compensado/Pago: -{formatMinutesAsHours(balance.totalDeductedMinutes)}
                    </span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span className="font-bold text-slate-900">
                      Saldo: {formatSignedMinutes(balance.balanceMinutes)}
                    </span>
                  </p>
                </div>

                {emp.active && (
                  <button
                    type="button"
                    onClick={() => onAddSelfOvertime(emp)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Registrar Hora Extra
                  </button>
                )}
              </div>

              {empEntries.length === 0 ? (
                <div className="p-6 text-sm text-slate-500 text-center">
                  Nenhum lançamento de hora extra registrado até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                        <th className="py-3 px-5">Data</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4">Observação</th>
                        <th className="py-3 px-4 text-right">Duração</th>
                        <th className="py-3 px-5 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {empEntries.map((entry) => {
                        const isAdd = entry.type === 'extra';
                        const canDelete =
                          Boolean(normalizedUserEmail) &&
                          entry.createdByEmail === normalizedUserEmail;
                        return (
                          <tr key={entry.id}>
                            <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-700">
                              {formatIsoDateBr(entry.date)}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <span
                                className={`font-medium ${
                                  isAdd ? 'text-emerald-700' : 'text-amber-800'
                                }`}
                              >
                                {TYPE_LABEL[entry.type]}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600">
                              {entry.note || '—'}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold ${
                                isAdd ? 'text-emerald-700' : 'text-slate-700'
                              }`}
                            >
                              {isAdd ? '+' : '-'}
                              {formatMinutesAsHours(entry.minutes)}
                            </td>
                            <td className="py-3 px-5 text-right">
                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => onDeleteSelfOvertime(entry)}
                                  aria-label="Excluir meu lançamento"
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">Gerência</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
