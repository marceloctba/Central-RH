import { Printer } from 'lucide-react';
import type { Employee } from '../types';
import {
  calculateWeeklyMinutes,
  DAY_LABELS,
  DAY_ORDER,
  formatMinutesAsHours,
  getTodayDayKey,
} from '../utils/schedule';
import { EmployeeAvatar } from './EmployeeAvatar';

interface WeeklyMatrixViewProps {
  employees: Employee[];
  onEditSchedule: (employee: Employee) => void;
}

export function WeeklyMatrixView({ employees, onEditSchedule }: WeeklyMatrixViewProps) {
  const activeEmployees = employees.filter((e) => e.active);
  const todayKey = getTodayDayKey();

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Matriz Semanal da Loja</h2>
          <p className="text-xs text-slate-500">
            Jornada padrão semanal (turnos, almoços e folgas fixas). Clique em qualquer linha para editar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir matriz
        </button>
      </div>

      {activeEmployees.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          Nenhum funcionário ativo cadastrado para exibir na escala semanal.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th className="py-3 px-4 w-56">Funcionário</th>
                {DAY_ORDER.map((dayKey) => (
                  <th
                    key={dayKey}
                    className={`py-3 px-2.5 text-center ${
                      dayKey === todayKey ? 'text-blue-700 font-semibold bg-blue-50/50' : ''
                    }`}
                  >
                    {DAY_LABELS[dayKey].short}
                    {dayKey === todayKey ? ' (Hoje)' : ''}
                  </th>
                ))}
                <th className="py-3 px-4 text-right">Total Semanal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {activeEmployees.map((emp) => {
                const weeklyMinutes = calculateWeeklyMinutes(emp.schedule);
                return (
                  <tr
                    key={emp.id}
                    onClick={() => onEditSchedule(emp)}
                    className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar
                          name={emp.name}
                          photoDataUrl={emp.photoDataUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{emp.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{emp.role}</p>
                        </div>
                      </div>
                    </td>

                    {DAY_ORDER.map((dayKey) => {
                      const d = emp.schedule[dayKey];
                      return (
                        <td
                          key={dayKey}
                          className={`py-2.5 px-2 text-center align-top ${
                            dayKey === todayKey ? 'bg-blue-50/25' : ''
                          }`}
                        >
                          {d.working ? (
                            <div className="space-y-0.5">
                              <p className="font-mono tabular-nums font-semibold text-slate-900">
                                {d.startTime}–{d.endTime}
                              </p>
                              {d.hasLunch && d.lunchStart && d.lunchEnd ? (
                                <p className="font-mono tabular-nums text-[11px] text-amber-800">
                                  Alm. {d.lunchStart}–{d.lunchEnd}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400">Sem almoço</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">
                              Folga semanal
                            </span>
                          )}
                        </td>
                      );
                    })}

                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatMinutesAsHours(weeklyMinutes)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
