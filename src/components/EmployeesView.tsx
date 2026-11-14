import { Calendar, CalendarOff, Clock, Edit3, Plus, Search, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Employee } from '../types';
import {
  calculateWeeklyMinutes,
  DAY_LABELS,
  DAY_ORDER,
  formatIsoDateBr,
  formatMinutesAsHours,
  formatSignedMinutes,
} from '../utils/schedule';
import { EmployeeAvatar } from './EmployeeAvatar';

interface EmployeesViewProps {
  employees: Employee[];
  overtimeBalances: Record<string, { balanceMinutes: number }>;
  onAddEmployee: () => void;
  onEditEmployee: (employee: Employee, tab?: 'profile' | 'schedule') => void;
  onAddOvertime: (employeeId: string) => void;
  onScheduleTimeOff: (employeeId: string) => void;
  onDeleteEmployee: (employee: Employee) => void;
}

export function EmployeesView({
  employees,
  overtimeBalances,
  onAddEmployee,
  onEditEmployee,
  onAddOvertime,
  onScheduleTimeOff,
  onDeleteEmployee,
}: EmployeesViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (statusFilter === 'active' && !e.active) return false;
      if (statusFilter === 'inactive' && e.active) return false;
      if (q && !e.name.toLowerCase().includes(q) && !e.role.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [employees, search, statusFilter]);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou função..."
              className="w-64 pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'active', label: 'Ativos' },
              { id: 'inactive', label: 'Inativos' },
              { id: 'all', label: 'Todos' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id as 'active' | 'inactive' | 'all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === item.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onAddEmployee}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Funcionário
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <Users className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            Nenhum funcionário encontrado
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {employees.length === 0
              ? 'Adicione o primeiro colaborador com foto, aniversário e escala.'
              : 'Ajuste os filtros de busca para visualizar outros funcionários.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[920px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5">Funcionário</th>
                  <th className="py-3 px-4">Nascimento</th>
                  <th className="py-3 px-4">Dias de Trabalho</th>
                  <th className="py-3 px-4 text-right">Carga Semanal</th>
                  <th className="py-3 px-4 text-right">Banco H.E.</th>
                  <th className="py-3 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filtered.map((emp) => {
                  const workingDays = DAY_ORDER.filter((k) => emp.schedule[k]?.working);
                  const weeklyMin = calculateWeeklyMinutes(emp.schedule);
                  const balanceMin = overtimeBalances[emp.id]?.balanceMinutes ?? 0;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar
                            name={emp.name}
                            photoDataUrl={emp.photoDataUrl}
                            size="lg"
                          />
                          <div>
                            <p className="font-semibold text-slate-900">
                              {emp.name}
                              {!emp.active && (
                                <span className="ml-2 text-xs font-normal text-slate-400">
                                  (Inativo)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">
                              <span>{emp.role}</span>
                              {emp.isManager && (
                                <>
                                  <span aria-hidden="true" className="mx-1.5 text-slate-300">
                                    ·
                                  </span>
                                  <span className="text-blue-700 font-medium">Acesso de gerente</span>
                                </>
                              )}
                              {emp.email && (
                                <>
                                  <span aria-hidden="true" className="mx-1.5 text-slate-300">
                                    ·
                                  </span>
                                  <span className="font-mono text-[11px]">{emp.email}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-700">
                        {formatIsoDateBr(emp.birthDate)}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        {workingDays.length === 0 ? (
                          <span className="text-slate-400">Sem dias escalados</span>
                        ) : (
                          <span>
                            {workingDays.map((k) => DAY_LABELS[k].short).join(' · ')}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-medium text-slate-900">
                        {formatMinutesAsHours(weeklyMin)}
                      </td>

                      <td
                        className={`py-3.5 px-4 text-right font-mono tabular-nums text-xs font-semibold ${
                          balanceMin > 0
                            ? 'text-emerald-700'
                            : balanceMin < 0
                              ? 'text-red-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {formatSignedMinutes(balanceMin)}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditEmployee(emp, 'profile')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditEmployee(emp, 'schedule')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Escala
                          </button>
                          <button
                            type="button"
                            onClick={() => onScheduleTimeOff(emp.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <CalendarOff className="w-3.5 h-3.5" />
                            Folga
                          </button>
                          <button
                            type="button"
                            onClick={() => onAddOvertime(emp.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            + H.E.
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteEmployee(emp)}
                            aria-label={`Excluir ${emp.name}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
