import {
  CalendarCheck2,
  CalendarClock,
  CalendarOff,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  Printer,
  Search,
  Users,
  Utensils,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DayKey, Employee, Reminder, TimeOffEntry } from '../types';
import {
  calculateDayWorkedMinutes,
  DAY_LABELS,
  DAY_ORDER,
  formatDateToIso,
  formatMinutesAsHours,
  formatSignedMinutes,
  getDateForDayInCurrentWeek,
  getLiveShiftStatus,
  getTimeOffForEmployeeOnDate,
  getTodayDayKey,
  TIME_OFF_REASON_LABELS,
  timeToMinutes,
} from '../utils/schedule';
import { EmployeeAvatar } from './EmployeeAvatar';

interface DailyScheduleViewProps {
  employees: Employee[];
  timeOffs: TimeOffEntry[];
  reminders: Reminder[];
  overtimeBalances: Record<string, { balanceMinutes: number }>;
  onEditSchedule: (employee: Employee) => void;
  onAddOvertime: (employeeId: string) => void;
  onScheduleTimeOff: (dateIso: string, employeeId?: string) => void;
  onAddReminder: (dateIso: string) => void;
  onToggleReminderDone: (reminder: Reminder) => void;
  onOpenAgenda: () => void;
  onAddEmployee: () => void;
}

const TIMELINE_START_MIN = 6 * 60; // 06:00
const TIMELINE_END_MIN = 23 * 60; // 23:00
const TIMELINE_SPAN_MIN = TIMELINE_END_MIN - TIMELINE_START_MIN;
const HOUR_MARKS = [6, 8, 10, 12, 14, 16, 18, 20, 22];

function pct(minutes: number): number {
  const clamped = Math.max(TIMELINE_START_MIN, Math.min(TIMELINE_END_MIN, minutes));
  return ((clamped - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN) * 100;
}

export function DailyScheduleView({
  employees,
  timeOffs,
  reminders,
  overtimeBalances,
  onEditSchedule,
  onAddOvertime,
  onScheduleTimeOff,
  onAddReminder,
  onToggleReminderDone,
  onOpenAgenda,
  onAddEmployee,
}: DailyScheduleViewProps) {
  const todayKey = getTodayDayKey();
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    activeEmployees.forEach((e) => {
      if (e.role.trim()) set.add(e.role.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [activeEmployees]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeEmployees.filter((e) => {
      if (roleFilter !== 'all' && e.role !== roleFilter) return false;
      if (q && !e.name.toLowerCase().includes(q) && !e.role.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [activeEmployees, roleFilter, search]);

  const isToday = selectedDay === todayKey;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const selectedDateObj = getDateForDayInCurrentWeek(selectedDay, now);
  const selectedDateIso = formatDateToIso(selectedDateObj);
  const selectedDateLabel = selectedDateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
  });

  const plannedByEmployee = useMemo(() => {
    const map = new Map<string, TimeOffEntry>();
    for (const emp of filteredEmployees) {
      const found = getTimeOffForEmployeeOnDate(timeOffs, emp.id, selectedDateIso);
      if (found) map.set(emp.id, found);
    }
    return map;
  }, [filteredEmployees, timeOffs, selectedDateIso]);

  const dayReminders = useMemo(
    () => reminders.filter((r) => r.date === selectedDateIso),
    [reminders, selectedDateIso],
  );

  const workingRows = useMemo(() => {
    return filteredEmployees
      .filter((e) => e.schedule[selectedDay]?.working && !plannedByEmployee.has(e.id))
      .sort((a, b) =>
        a.schedule[selectedDay].startTime.localeCompare(b.schedule[selectedDay].startTime),
      );
  }, [filteredEmployees, selectedDay, plannedByEmployee]);

  const offRows = useMemo(() => {
    return filteredEmployees.filter(
      (e) => !e.schedule[selectedDay]?.working || plannedByEmployee.has(e.id),
    );
  }, [filteredEmployees, selectedDay, plannedByEmployee]);

  const totalDayMinutes = workingRows.reduce(
    (sum, emp) => sum + calculateDayWorkedMinutes(emp.schedule[selectedDay]),
    0,
  );
  const onLunchNowCount = isToday
    ? workingRows.filter(
        (emp) => getLiveShiftStatus(emp.schedule[selectedDay], true, now).code === 'lunch',
      ).length
    : workingRows.filter((emp) => emp.schedule[selectedDay].hasLunch).length;

  return (
    <div className="space-y-6">
      <div className="no-print bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {DAY_ORDER.map((dayKey) => {
              const active = selectedDay === dayKey;
              const isDayToday = dayKey === todayKey;
              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => setSelectedDay(dayKey)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {DAY_LABELS[dayKey].short}
                  {isDayToday ? ' · Hoje' : ''}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar funcionário..."
                className="w-full sm:w-52 pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <select
              aria-label="Filtrar por função"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">Todas as funções</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => onAddReminder(selectedDateIso)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CalendarCheck2 className="w-3.5 h-3.5" />
              + Lembrete
            </button>

            <button
              type="button"
              disabled={activeEmployees.length === 0}
              onClick={() => onScheduleTimeOff(selectedDateIso)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CalendarOff className="w-3.5 h-3.5" />
              Agendar folga
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir escala
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {DAY_LABELS[selectedDay].full} — {selectedDateLabel}
            </h2>
            <p className="text-xs text-slate-500">
              Visão completa de turnos, horários de saída e retorno do almoço, folgas semanais e ausências planejadas.
            </p>
          </div>
          {isToday && (
            <span className="text-xs font-mono tabular-nums text-blue-700 font-medium">
              Agora: {String(now.getHours()).padStart(2, '0')}:
              {String(now.getMinutes()).padStart(2, '0')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          <div className="p-4">
            <p className="text-xs text-slate-500">Escalados no dia</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
              {workingRows.length}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">De folga / ausentes</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-700">
              {offRows.length}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Carga horária total</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
              {formatMinutesAsHours(totalDayMinutes)}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">
              {isToday ? 'Em almoço neste momento' : 'Com intervalo de almoço'}
            </p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-700">
              {onLunchNowCount}
            </p>
          </div>
        </div>
      </div>

      {dayReminders.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                Lembretes da Agenda para {selectedDateLabel} ({dayReminders.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={onOpenAgenda}
              className="no-print text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
            >
              Ver agenda completa
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {dayReminders.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => onToggleReminderDone(r)}
                    aria-label={r.done ? 'Marcar como pendente' : 'Marcar como concluído'}
                    className="mt-0.5 text-slate-400 hover:text-blue-700 transition-colors shrink-0 cursor-pointer"
                  >
                    {r.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.time && (
                        <span className="text-xs font-mono tabular-nums font-semibold text-blue-700">
                          {r.time}
                        </span>
                      )}
                      <span
                        className={`text-sm font-semibold ${
                          r.done ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}
                      >
                        {r.title}
                      </span>
                    </div>
                    {r.note && <p className="text-xs text-slate-500 mt-0.5">{r.note}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeEmployees.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <Users className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            Nenhum funcionário ativo cadastrado
          </h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Cadastre os colaboradores da sua loja para visualizar a linha do tempo diária, horários
            de almoço e quem está de folga.
          </p>
          <button
            type="button"
            onClick={onAddEmployee}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
          >
            Cadastrar primeiro funcionário
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Linha do tempo de turnos e almoço (06:00 às 23:00)
              </h3>
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-2.5 rounded-xs bg-blue-700 inline-block" />
                  Em serviço
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-2.5 rounded-xs bg-amber-400 inline-block" />
                  Almoço
                </span>
              </div>
            </div>

            {workingRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Nenhum funcionário escalado para trabalhar neste dia com os filtros atuais.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[760px] p-5">
                  <div className="flex items-center mb-3">
                    <div className="w-52 shrink-0 text-xs font-medium text-slate-500">
                      Colaborador
                    </div>
                    <div className="flex-1 relative h-5">
                      {HOUR_MARKS.map((h) => (
                        <span
                          key={h}
                          style={{ left: `${pct(h * 60)}%` }}
                          className="absolute -translate-x-1/2 text-[11px] font-mono tabular-nums text-slate-400"
                        >
                          {String(h).padStart(2, '0')}h
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="relative space-y-2.5">
                    {isToday &&
                      nowMinutes >= TIMELINE_START_MIN &&
                      nowMinutes <= TIMELINE_END_MIN && (
                        <div
                          style={{ left: `calc(13rem + (100% - 13rem) * ${pct(nowMinutes) / 100})` }}
                          className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500"
                        />
                      )}

                    {workingRows.map((emp) => {
                      const d = emp.schedule[selectedDay];
                      const startPct = pct(timeToMinutes(d.startTime));
                      const endPct = pct(timeToMinutes(d.endTime));
                      const widthPct = Math.max(2, endPct - startPct);

                      const hasValidLunch = d.hasLunch && d.lunchStart && d.lunchEnd;
                      const lunchStartPct = hasValidLunch ? pct(timeToMinutes(d.lunchStart)) : 0;
                      const lunchEndPct = hasValidLunch ? pct(timeToMinutes(d.lunchEnd)) : 0;
                      const lunchLeftWithinShift =
                        hasValidLunch && widthPct > 0
                          ? ((lunchStartPct - startPct) / widthPct) * 100
                          : 0;
                      const lunchWidthWithinShift =
                        hasValidLunch && widthPct > 0
                          ? ((lunchEndPct - lunchStartPct) / widthPct) * 100
                          : 0;

                      return (
                        <div key={emp.id} className="flex items-center group">
                          <div className="w-52 shrink-0 pr-3 flex items-center gap-2.5 min-w-0">
                            <EmployeeAvatar
                              name={emp.name}
                              photoDataUrl={emp.photoDataUrl}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {emp.name}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">{emp.role}</p>
                            </div>
                          </div>

                          <div className="flex-1 relative h-9 bg-slate-100/80 rounded-lg border border-slate-200/80 overflow-hidden">
                            {HOUR_MARKS.map((h) => (
                              <div
                                key={h}
                                style={{ left: `${pct(h * 60)}%` }}
                                className="absolute top-0 bottom-0 w-px bg-slate-200/70"
                              />
                            ))}

                            <div
                              style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                              title={`${emp.name}: ${d.startTime} às ${d.endTime}${
                                hasValidLunch ? ` (Almoço ${d.lunchStart}–${d.lunchEnd})` : ''
                              }`}
                              className="absolute top-1 bottom-1 bg-blue-700 rounded-md overflow-hidden flex items-center shadow-xs"
                            >
                              {hasValidLunch && lunchWidthWithinShift > 0 && (
                                <div
                                  style={{
                                    left: `${Math.max(0, lunchLeftWithinShift)}%`,
                                    width: `${Math.min(100, lunchWidthWithinShift)}%`,
                                  }}
                                  title={`Almoço: ${d.lunchStart} às ${d.lunchEnd}`}
                                  className="absolute top-0 bottom-0 bg-amber-400 border-x border-amber-500"
                                />
                              )}
                              <span className="relative z-10 px-2 text-[11px] font-mono tabular-nums text-white font-medium truncate drop-shadow-xs">
                                {d.startTime}–{d.endTime}
                                {hasValidLunch ? ` · Almoço ${d.lunchStart}–${d.lunchEnd}` : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">
                Escala detalhada do dia ({workingRows.length} trabalhando)
              </h3>
            </div>

            {workingRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Nenhum colaborador trabalhando neste dia.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                      <th className="py-3 px-5">Funcionário</th>
                      <th className="py-3 px-4">Situação</th>
                      <th className="py-3 px-4">Jornada</th>
                      <th className="py-3 px-4">Horário de Almoço</th>
                      <th className="py-3 px-4 text-right">Carga Líquida</th>
                      <th className="py-3 px-4 text-right">Banco H.E.</th>
                      <th className="no-print py-3 px-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {workingRows.map((emp) => {
                      const d = emp.schedule[selectedDay];
                      const status = getLiveShiftStatus(d, isToday, now);
                      const netMinutes = calculateDayWorkedMinutes(d);
                      const balanceMin = overtimeBalances[emp.id]?.balanceMinutes ?? 0;

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-3">
                              <EmployeeAvatar
                                name={emp.name}
                                photoDataUrl={emp.photoDataUrl}
                                size="md"
                              />
                              <div>
                                <p className="font-semibold text-slate-900">{emp.name}</p>
                                <p className="text-xs text-slate-500">{emp.role}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span
                              className={`font-medium ${
                                status.code === 'lunch'
                                  ? 'text-amber-700'
                                  : status.code === 'working'
                                    ? 'text-emerald-700'
                                    : 'text-slate-600'
                              }`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-900 font-medium">
                            {d.startTime} – {d.endTime}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {d.hasLunch && d.lunchStart && d.lunchEnd ? (
                              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-amber-800 font-medium">
                                <Utensils className="w-3.5 h-3.5 text-amber-600" />
                                {d.lunchStart} – {d.lunchEnd}
                              </span>
                            ) : (
                              <span className="text-slate-400">Sem intervalo</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-800">
                            {formatMinutesAsHours(netMinutes)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold ${
                              balanceMin > 0
                                ? 'text-emerald-700'
                                : balanceMin < 0
                                  ? 'text-red-700'
                                  : 'text-slate-500'
                            }`}
                          >
                            {formatSignedMinutes(balanceMin)}
                          </td>
                          <td className="no-print py-3 px-5 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onEditSchedule(emp)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Escala
                              </button>
                              <button
                                type="button"
                                onClick={() => onAddOvertime(emp.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                + H.E.
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  De folga / ausentes em {DAY_LABELS[selectedDay].full} ({offRows.length})
                </h3>
              </div>
            </div>

            {offRows.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                Toda a equipe ativa está escalada para trabalhar neste dia.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:gap-px bg-slate-200">
                {offRows.map((emp) => {
                  const planned = plannedByEmployee.get(emp.id);
                  return (
                    <div
                      key={emp.id}
                      className="bg-white p-4 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <EmployeeAvatar
                          name={emp.name}
                          photoDataUrl={emp.photoDataUrl}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{emp.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {emp.role} ·{' '}
                            {planned ? (
                              <span className="font-medium text-amber-800">
                                {TIME_OFF_REASON_LABELS[planned.reason]}
                              </span>
                            ) : (
                              'Folga semanal'
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditSchedule(emp)}
                        className="no-print text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Editar escala
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
