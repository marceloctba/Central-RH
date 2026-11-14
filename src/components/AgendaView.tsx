import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Edit2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Reminder } from '../types';
import {
  DAY_LABELS,
  formatDateToIso,
  formatIsoDateBr,
  getTodayIsoDate,
  jsDayToDayKey,
  parseIsoDateLocal,
} from '../utils/schedule';

interface AgendaViewProps {
  reminders: Reminder[];
  onAddReminder: (defaultDate?: string) => void;
  onEditReminder: (reminder: Reminder) => void;
  onToggleDone: (reminder: Reminder) => void;
  onDeleteReminder: (reminder: Reminder) => void;
}

const WEEKDAY_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function AgendaView({
  reminders,
  onAddReminder,
  onEditReminder,
  onToggleDone,
  onDeleteReminder,
}: AgendaViewProps) {
  const todayIso = getTodayIsoDate();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all' | 'done' | 'past'>('pending');
  const [search, setSearch] = useState('');

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

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const jsStartDay = firstDayOfMonth.getDay();
    const leadingBlanks = jsStartDay === 0 ? 6 : jsStartDay - 1;

    const cells: {
      iso: string;
      dayNum: number;
      inMonth: boolean;
      dayReminders: Reminder[];
      pendingCount: number;
    }[] = [];

    for (let i = 0; i < leadingBlanks; i++) {
      cells.push({
        iso: `blank-${i}`,
        dayNum: 0,
        inMonth: false,
        dayReminders: [],
        pendingCount: 0,
      });
    }

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateObj = new Date(viewYear, viewMonth, dayNum);
      const iso = formatDateToIso(dateObj);
      const dayReminders = reminders.filter((r) => r.date === iso);
      const pendingCount = dayReminders.filter((r) => !r.done).length;
      cells.push({
        iso,
        dayNum,
        inMonth: true,
        dayReminders,
        pendingCount,
      });
    }

    return cells;
  }, [viewYear, viewMonth, reminders]);

  const selectedDayReminders = useMemo(
    () => reminders.filter((r) => r.date === selectedIso),
    [reminders, selectedIso],
  );

  const selectedDayKey = jsDayToDayKey(parseIsoDateLocal(selectedIso).getDay());

  const pendingUpcomingCount = useMemo(
    () => reminders.filter((r) => !r.done && r.date >= todayIso).length,
    [reminders, todayIso],
  );
  const todayPendingCount = useMemo(
    () => reminders.filter((r) => !r.done && r.date === todayIso).length,
    [reminders, todayIso],
  );
  const doneCount = useMemo(() => reminders.filter((r) => r.done).length, [reminders]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reminders.filter((r) => {
      if (statusFilter === 'pending' && (r.done || r.date < todayIso)) return false;
      if (statusFilter === 'done' && !r.done) return false;
      if (statusFilter === 'past' && r.date >= todayIso) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.note.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [reminders, statusFilter, search, todayIso]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Agenda e Lembretes da Gerência
            </h2>
            <p className="text-xs text-slate-500">
              Cadastre entrevistas, reuniões, entregas e compromissos importantes vinculados a cada dia e horário.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onAddReminder(selectedIso)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Lembrete
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-4">
            <p className="text-xs text-slate-500">Lembretes futuros pendentes</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
              {pendingUpcomingCount}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Para hoje ({formatIsoDateBr(todayIso)})</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-blue-700">
              {todayPendingCount}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Concluídos</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700">
              {doneCount}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Calendário mensal</h3>
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
                const hasPending = cell.pendingCount > 0;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => setSelectedIso(cell.iso)}
                    className={`h-20 p-1.5 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-blue-700 bg-blue-50/60 ring-1 ring-blue-700'
                        : hasPending
                          ? 'border-blue-200 bg-blue-50/30 hover:border-blue-400'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-mono tabular-nums font-semibold ${
                          isToday ? 'text-blue-700 underline underline-offset-2' : 'text-slate-800'
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                      {cell.dayReminders.length > 0 && (
                        <span
                          className={`text-[10px] font-mono tabular-nums ${
                            hasPending ? 'text-blue-700 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {cell.dayReminders.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5 overflow-hidden">
                      {cell.dayReminders.slice(0, 2).map((r) => (
                        <p
                          key={r.id}
                          className={`text-[10px] font-medium truncate ${
                            r.done ? 'text-slate-400 line-through' : 'text-blue-800'
                          }`}
                        >
                          {r.time ? `${r.time} ` : '• '}
                          {r.title}
                        </p>
                      ))}
                      {cell.dayReminders.length > 2 && (
                        <p className="text-[10px] text-slate-500 font-mono">
                          +{cell.dayReminders.length - 2} mais
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
                Agenda de {formatIsoDateBr(selectedIso)} · {DAY_LABELS[selectedDayKey].full}
              </h3>
              <p className="text-xs text-slate-500">
                {selectedDayReminders.length === 0
                  ? 'Nenhum compromisso cadastrado neste dia'
                  : `${selectedDayReminders.length} lembrete(s) neste dia`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAddReminder(selectedIso)}
              className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
            >
              + Adicionar neste dia
            </button>
          </div>

          <div className="p-5 flex-1 overflow-y-auto">
            {selectedDayReminders.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <CalendarCheck2 className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Nenhum lembrete para {formatIsoDateBr(selectedIso)}. Cadastre entrevistas,
                  reuniões ou tarefas deste dia.
                </p>
                <button
                  type="button"
                  onClick={() => onAddReminder(selectedIso)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar lembrete
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {selectedDayReminders.map((r) => (
                  <div key={r.id} className="p-3.5 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => onToggleDone(r)}
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
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums font-semibold text-blue-700">
                              <Clock className="w-3 h-3" />
                              {r.time}
                            </span>
                          )}
                          <p
                            className={`text-sm font-semibold ${
                              r.done ? 'text-slate-400 line-through' : 'text-slate-900'
                            }`}
                          >
                            {r.title}
                          </p>
                        </div>
                        {r.note && (
                          <p className="mt-1 text-xs text-slate-600 whitespace-pre-line">{r.note}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditReminder(r)}
                        aria-label="Editar lembrete"
                        className="p-1.5 text-slate-400 hover:text-slate-800 rounded-md transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteReminder(r)}
                        aria-label="Excluir lembrete"
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              Lista de lembretes cadastrados ({filteredList.length})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar lembrete..."
                className="w-48 pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <select
              aria-label="Filtrar lembretes"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'pending' | 'all' | 'done' | 'past')
              }
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="pending">Pendentes e futuros</option>
              <option value="all">Todos</option>
              <option value="done">Concluídos</option>
              <option value="past">Datas passadas</option>
            </select>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhum lembrete encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Horário</th>
                  <th className="py-3 px-4">Lembrete</th>
                  <th className="py-3 px-4">Detalhes</th>
                  <th className="py-3 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredList.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-5">
                      <button
                        type="button"
                        onClick={() => onToggleDone(r)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                      >
                        {r.done ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-emerald-700">Concluído</span>
                          </>
                        ) : (
                          <>
                            <Circle className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-700">Pendente</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-800 font-medium whitespace-nowrap">
                      {formatIsoDateBr(r.date)}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-blue-700 font-semibold whitespace-nowrap">
                      {r.time || 'Dia todo'}
                    </td>
                    <td
                      className={`py-3 px-4 text-xs font-semibold ${
                        r.done ? 'text-slate-400 line-through' : 'text-slate-900'
                      }`}
                    >
                      {r.title}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {r.note || '—'}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditReminder(r)}
                          aria-label="Editar lembrete"
                          className="p-1.5 text-slate-400 hover:text-slate-800 rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteReminder(r)}
                          aria-label="Excluir lembrete"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
