import { Cake, Calendar } from 'lucide-react';
import type { Employee } from '../types';
import {
  formatIsoDateBr,
  getBirthdayInfoForWeek,
  getNextBirthdayDate,
} from '../utils/schedule';
import { EmployeeAvatar } from './EmployeeAvatar';

interface BirthdaysViewProps {
  employees: Employee[];
}

export function BirthdaysView({ employees }: BirthdaysViewProps) {
  const activeEmployees = employees.filter((e) => e.active);
  const weekMatches = getBirthdayInfoForWeek(activeEmployees);

  const upcomingList = activeEmployees
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.birthDate))
    .map((emp) => ({
      employee: emp,
      ...getNextBirthdayDate(emp.birthDate),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <Cake className="w-5 h-5 text-amber-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">Aniversariantes desta Semana</h2>
            <p className="text-xs text-slate-500">
              Lembrete automático dos colaboradores que fazem aniversário de domingo a sábado.
            </p>
          </div>
        </div>

        {weekMatches.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhum funcionário ativo faz aniversário nesta semana.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {weekMatches.map((m) => (
              <div
                key={m.employee.id}
                className={`p-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  m.isToday ? 'bg-amber-50/70' : 'bg-white'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <EmployeeAvatar
                    name={m.employee.name}
                    photoDataUrl={m.employee.photoDataUrl}
                    size="lg"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {m.employee.name}
                      {m.isToday && (
                        <span className="ml-2 text-xs font-semibold text-amber-800">
                          · Fazendo {m.turningAge} anos hoje!
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {m.employee.role} · Nascimento: {formatIsoDateBr(m.employee.birthDate)}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right font-mono tabular-nums text-xs">
                  <p className="font-semibold text-slate-900">
                    {m.dayOfWeekLabel}, {m.dateFormatted}
                  </p>
                  <p className="text-slate-500">Completa {m.turningAge} anos</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <Calendar className="w-4.5 h-4.5 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">
            Próximos aniversários da equipe ({upcomingList.length})
          </h3>
        </div>

        {upcomingList.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhum aniversário cadastrado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5">Funcionário</th>
                  <th className="py-3 px-4">Dia / Mês</th>
                  <th className="py-3 px-4">Idade a completar</th>
                  <th className="py-3 px-5 text-right">Contagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {upcomingList.map((item) => (
                  <tr key={item.employee.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar
                          name={item.employee.name}
                          photoDataUrl={item.employee.photoDataUrl}
                          size="sm"
                        />
                        <div>
                          <p className="font-semibold text-slate-900">{item.employee.name}</p>
                          <p className="text-xs text-slate-500">{item.employee.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs font-medium text-slate-900">
                      {item.dateFormatted}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-700">
                      {item.turningAge} anos
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-xs">
                      {item.daysUntil === 0 ? (
                        <span className="font-bold text-amber-700">Hoje</span>
                      ) : item.daysUntil === 1 ? (
                        <span className="font-semibold text-amber-700">Amanhã</span>
                      ) : (
                        <span className="text-slate-600">em {item.daysUntil} dias</span>
                      )}
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
