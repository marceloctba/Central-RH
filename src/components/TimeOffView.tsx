import {
  AlertTriangle,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Employee, TimeOffEntry, TimeOffReason } from '../types';
import {
  DAY_LABELS,
  formatDateToIso,
  formatIsoDateBr,
  formatMinutesAsHours,
  getTodayIsoDate,
  jsDayToDayKey,
  parseIsoDateLocal,
  TIME_OFF_REASON_LABELS,
} from '../utils/schedule';
import { EmployeeAvatar } from './EmployeeAvatar';

interface TimeOffViewProps {
  employees: Employee[];
  timeOffs: TimeOffEntry[];
  onAddTimeOff: (defaultDate?: string, employeeId?: string) => void;
  onDeleteTimeOff: (entry: TimeOffEntry) => void;
}

const WEEKDAY_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function reasonColorClass(reason: TimeOffReason): string {
  switch (reason) {
    case 'banco_horas':
      return 'text-blue-700';
    case 'ferias':
      return 'text-emerald-700';
    case 'atestado':
      return 'text-amber-700';
    case 'outros':
      return 'text-slate-700';
  }
}

export function TimeOffView({
  employees,
  timeOffs,
  onAddTimeOff,
  onDeleteTimeOff,
}: TimeOffViewProps) {
  const todayIso = getTodayIsoDate();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0..11
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [periodFilter, setPeriodFilter] = useState<'upcoming' | 'all' | 'past'>('upcoming');
  const [reasonFilter, setReasonFilter] = useState<'all' | TimeOffReason>('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees]);
  const empMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const changeMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const monthLabel = useMemo(() => {
    const label = new Date(viewYear, viewMonth, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [viewYear, viewMonth]);

  // Calendar grid (Monday-first)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const jsStartDay = firstDayOfMonth.getDay(); // 0=Sun..6=Sat
    const leadingBlanks = jsStartDay === 0 ? 6 : jsStartDay - 1;

    const cells: {
      iso: string;
      dayNum: number;
      inMonth: boolean;
      plannedOff: TimeOffEntry[];
      weeklyOffCount: number;
      availableCount: number;
      lowStaffing: boolean;
    }[] = [];

    for (let i = 0; i < leadingBlanks; i++) {
      cells.push({
        iso: `blank-${i}`,
        dayNum: 0,
        inMonth: false,
        plannedOff: [],
        weeklyOffCount: 0,
        availableCount: 0,
        lowStaffing: false,
      });
    }

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateObj = new Date(viewYear, viewMonth, dayNum);
      const iso = formatDateToIso(dateObj);
      const dayKey = jsDayToDayKey(dateObj.getDay());

      const plannedOff = timeOffs.filter((t) => {
        const emp = empMap.get(t.employeeId);
        return (emp ? emp.active : true) && t.startDate <= iso && t.endDate >= iso;
      });
      const plannedIds = new Set(plannedOff.map((t) => t.employeeId));

      const weeklyOffCount = activeEmployees.filter(
        (e) => !plannedIds.has(e.id) && !e.schedule[dayKey]?.working,
      ).length;

      const availableCount = activeEmployees.filter(
        (e) => e.schedule[dayKey]?.working && !plannedIds.has(e.id),
      ).length;

      const totalAbsent = plannedOff.length + weeklyOffCount;
      const lowStaffing =
        activeEmployees.length > 0 &&
        (plannedOff.length >= 2 ||
          (plannedOff.length >= 1 && availableCount <= Math.ceil(activeEmployees.length * 0.5)) ||
          (totalAbsent > 0 && availableCount === 0));

      cells.push({
        iso,
        dayNum,
        inMonth: true,
        plannedOff,
        weeklyOffCount,
        availableCount,
        lowStaffing,
      });
    }

    return cells;
  }, [viewYear, viewMonth, timeOffs, activeEmployees, empMap]);

  // Critical upcoming dates in next 30 days
  const upcomingCriticalDates = useMemo(() => {
    const start = parseIsoDateLocal(todayIso);
    const list: {
      iso: string;
      dayLabel: string;
      planned: TimeOffEntry[];
      availableCount: number;
      totalActive: number;
    }[] = [];

    if (activeEmployees.length === 0) return list;

    for (let offset = 0; offset < 30; offset++) {
      const d = new Date(start);
      d.setDate(start.getDate() + offset);
      const iso = formatDateToIso(d);
      const dayKey = jsDayToDayKey(d.getDay());

      const planned = timeOffs.filter((t) => t.startDate <= iso && t.endDate >= iso);
      if (planned.length === 0) continue;

      const plannedIds = new Set(planned.map((t) => t.employeeId));
      const availableCount = activeEmployees.filter(
        (e) => e.schedule[dayKey]?.working && !plannedIds.has(e.id),
      ).length;

      if (planned.length >= 2 || availableCount <= Math.ceil(activeEmployees.length * 0.6)) {
        list.push({
          iso,
          dayLabel: DAY_LABELS[dayKey].short,
          planned,
          availableCount,
          totalActive: activeEmployees.length,
        });
      }
    }
    return list.slice(0, 6);
  }, [todayIso, timeOffs, activeEmployees]);

  // Selected day breakdown
  const selectedDayDetails = useMemo(() => {
    const dateObj = parseIsoDateLocal(selectedIso);
    const dayKey = jsDayToDayKey(dateObj.getDay());
    const planned = timeOffs.filter((t) => t.startDate <= selectedIso && t.endDate >= selectedIso);
    const plannedIds = new Set(planned.map((t) => t.employeeId));
    const weeklyOff = activeEmployees.filter(
      (e) => !plannedIds.has(e.id) && !e.schedule[dayKey]?.working,
    );
    const working = activeEmployees
      .filter((e) => e.schedule[dayKey]?.working && !plannedIds.has(e.id))
      .sort((a, b) =>
        a.schedule[dayKey].startTime.localeCompare(b.schedule[dayKey].startTime),
      );
    return { dayKey, planned, weeklyOff, working };
  }, [selectedIso, timeOffs, activeEmployees]);

  // Upcoming / all / past counts & filtered table
  const upcomingEntries = useMemo(
    () => timeOffs.filter((t) => t.endDate >= todayIso),
    [timeOffs, todayIso],
  );
  const absentTodayCount = useMemo(
    () => timeOffs.filter((t) => t.startDate <= todayIso && t.endDate >= todayIso).length,
    [timeOffs, todayIso],
  );

  const filteredList = useMemo(() => {
    return timeOffs.filter((entry) => {
      if (periodFilter === 'upcoming' && entry.endDate < todayIso) return false;
      if (periodFilter === 'past' && entry.endDate >= todayIso) return false;
      if (reasonFilter !== 'all' && entry.reason !== reasonFilter) return false;
      if (employeeFilter !== 'all' && entry.employeeId !== employeeFilter) return false;
      return true;
    });
  }, [timeOffs, periodFilter, reasonFilter, employeeFilter, todayIso]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Folgas Planejadas e Previsão de Baixas no Quadro
            </h2>
            <p className="text-xs text-slate-500">
              Agende folgas por banco de horas, férias, atestados e visualize datas futuras com menor cobertura.
            </p>
          </div>
          <button
            type="button"
            disabled={activeEmployees.length === 0}
            onClick={() => onAddTimeOff(selectedIso)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Agendar Folga / Ausência
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-4">
            <p className="text-xs text-slate-500">Ausências futuras / ativas</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
              {upcomingEntries.length}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Ausentes hoje ({formatIsoDateBr(todayIso)})</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-blue-700">
              {absentTodayCount}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Datas com alerta nos próximos 30 dias</p>
            <p
              className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
                upcomingCriticalDates.length > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {upcomingCriticalDates.length}
            </p>
          </div>
        </div>
      </div>

      {upcomingCriticalDates.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <h3 className="text-sm font-semibold text-amber-950">
              Datas próximas com baixa no quadro de funcionários
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingCriticalDates.map((item) => (
              <button
                key={item.iso}
                type="button"
                onClick={() => {
                  setSelectedIso(item.iso);
                  const d = parseIsoDateLocal(item.iso);
                  setViewYear(d.getFullYear());
                  setViewMonth(d.getMonth());
                }}
                className="text-left bg-white border border-amber-200/90 rounded-lg p-3.5 hover:border-amber-400 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold font-mono tabular-nums text-slate-900">
                    {formatIsoDateBr(item.iso)} · {item.dayLabel}
                  </span>
                  <span className="text-xs font-semibold font-mono tabular-nums text-amber-800">
                    {item.availableCount}/{item.totalActive} ativos
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-600 line-clamp-2">
                  {item.planned
                    .map((p) => `${p.employeeName} (${TIME_OFF_REASON_LABELS[p.reason]})`)
                    .join(' · ')}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">
                Mapa mensal de cobertura e folgas
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="Mês anterior"
                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-900 min-w-32 text-center">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Próximo mês"
                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {WEEKDAY_HEADERS.map((wd) => (
                <div
                  key={wd}
                  className="text-center text-[11px] font-semibold text-slate-500 py-1"
                >
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((cell) => {
                if (!cell.inMonth) {
                  return <div key={cell.iso} className="h-20 rounded-lg bg-slate-50/40" />;
                }
                const isSelected = selectedIso === cell.iso;
                const isToday = todayIso === cell.iso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => setSelectedIso(cell.iso)}
                    className={`h-20 p-1.5 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-blue-700 bg-blue-50/60 ring-1 ring-blue-700'
                        : cell.lowStaffing
                          ? 'border-amber-300 bg-amber-50/50 hover:border-amber-400'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-mono tabular-nums font-semibold ${
                          isToday
                            ? 'text-blue-700 underline underline-offset-2'
                            : 'text-slate-800'
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                      {activeEmployees.length > 0 && (
                        <span
                          className={`text-[10px] font-mono tabular-nums ${
                            cell.lowStaffing ? 'text-amber-800 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {cell.availableCount}/{activeEmployees.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5 overflow-hidden">
                      {cell.plannedOff.slice(0, 2).map((t) => (
                        <p
                          key={t.id}
                          className={`text-[10px] font-medium truncate ${reasonColorClass(
                            t.reason,
                          )}`}
                        >
                          • {t.employeeName.split(' ')[0]}
                        </p>
                      ))}
                      {cell.plannedOff.length > 2 && (
                        <p className="text-[10px] text-slate-500 font-mono">
                          +{cell.plannedOff.length - 2} mais
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Raio-X de {formatIsoDateBr(selectedIso)} ·{' '}
                {DAY_LABELS[selectedDayDetails.dayKey].full}
              </h3>
              <p className="text-xs text-slate-500">
                {selectedDayDetails.working.length} disponíveis ·{' '}
                {selectedDayDetails.planned.length} ausência(s) planejada(s) ·{' '}
                {selectedDayDetails.weeklyOff.length} folga semanal
              </p>
            </div>
            <button
              type="button"
              disabled={activeEmployees.length === 0}
              onClick={() => onAddTimeOff(selectedIso)}
              className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              + Agendar neste dia
            </button>
          </div>

          <div className="p-5 space-y-5 flex-1 overflow-y-auto">
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">
                Ausências planejadas ({selectedDayDetails.planned.length})
              </p>
              {selectedDayDetails.planned.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhuma folga planejada, férias ou atestado registrado para esta data.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  {selectedDayDetails.planned.map((t) => {
                    const emp = empMap.get(t.employeeId);
                    return (
                      <div
                        key={t.id}
                        className="p-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <EmployeeAvatar
                            name={emp?.name || t.employeeName}
                            photoDataUrl={emp?.photoDataUrl || ''}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {emp?.name || t.employeeName}
                            </p>
                            <p className={`text-[11px] font-medium ${reasonColorClass(t.reason)}`}>
                              {TIME_OFF_REASON_LABELS[t.reason]}
                              {t.deductFromBank && t.deductedMinutes > 0
                                ? ` · -${formatMinutesAsHours(t.deductedMinutes)} banco`
                                : ''}
                            </p>
                            {t.note && (
                              <p className="text-[11px] text-slate-500 truncate">{t.note}</p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteTimeOff(t)}
                          aria-label="Remover agendamento"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">
                Folga semanal da escala ({selectedDayDetails.weeklyOff.length})
              </p>
              {selectedDayDetails.weeklyOff.length === 0 ? (
                <p className="text-xs text-slate-500">Ninguém com folga fixa neste dia.</p>
              ) : (
                <div className="text-xs text-slate-600 space-y-1">
                  {selectedDayDetails.weeklyOff.map((e) => (
                    <p key={e.id}>
                      • <span className="font-medium text-slate-800">{e.name}</span> ({e.role})
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Disponíveis para cobertura ({selectedDayDetails.working.length})
              </p>
              {selectedDayDetails.working.length === 0 ? (
                <p className="text-xs text-red-700 font-medium">
                  Atenção: nenhum funcionário ativo disponível nesta data.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {selectedDayDetails.working.map((e) => {
                    const shift = e.schedule[selectedDayDetails.dayKey];
                    return (
                      <div
                        key={e.id}
                        className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-medium text-slate-800 truncate">
                          {e.name} · <span className="text-slate-500 font-normal">{e.role}</span>
                        </span>
                        <span className="font-mono tabular-nums text-slate-600 shrink-0">
                          {shift.startTime}–{shift.endTime}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              Lista de folgas planejadas e ausências ({filteredList.length})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrar por período"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as 'upcoming' | 'all' | 'past')}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="upcoming">Futuras e em andamento</option>
              <option value="all">Todas</option>
              <option value="past">Passadas</option>
            </select>
            <select
              aria-label="Filtrar por motivo"
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value as 'all' | TimeOffReason)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="all">Todos os motivos</option>
              <option value="banco_horas">Folga (Banco de horas)</option>
              <option value="ferias">Férias</option>
              <option value="atestado">Atestado médico</option>
              <option value="outros">Outros</option>
            </select>
            <select
              aria-label="Filtrar por funcionário"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="all">Todos os funcionários</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhuma folga planejada ou ausência encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[740px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5">Período</th>
                  <th className="py-3 px-4">Funcionário</th>
                  <th className="py-3 px-4">Motivo</th>
                  <th className="py-3 px-4">Banco de Horas</th>
                  <th className="py-3 px-4">Observação</th>
                  <th className="py-3 px-5 text-right">Excluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredList.map((entry) => {
                  const emp = empMap.get(entry.employeeId);
                  const singleDay = entry.startDate === entry.endDate;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-800 font-medium whitespace-nowrap">
                        {singleDay
                          ? formatIsoDateBr(entry.startDate)
                          : `${formatIsoDateBr(entry.startDate)} → ${formatIsoDateBr(entry.endDate)}`}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <EmployeeAvatar
                            name={emp?.name || entry.employeeName}
                            photoDataUrl={emp?.photoDataUrl || ''}
                            size="sm"
                          />
                          <div>
                            <p className="text-xs font-semibold text-slate-900">
                              {emp?.name || entry.employeeName}
                            </p>
                            {emp?.role && (
                              <p className="text-[11px] text-slate-500">{emp.role}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className={`font-semibold ${reasonColorClass(entry.reason)}`}>
                          {TIME_OFF_REASON_LABELS[entry.reason]}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs">
                        {entry.deductFromBank && entry.deductedMinutes > 0 ? (
                          <span className="text-amber-800 font-semibold">
                            -{formatMinutesAsHours(entry.deductedMinutes)} descontado
                          </span>
                        ) : (
                          <span className="text-slate-400 font-sans">Sem desconto</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                        {entry.note || '—'}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteTimeOff(entry)}
                          aria-label="Excluir agendamento"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
}
