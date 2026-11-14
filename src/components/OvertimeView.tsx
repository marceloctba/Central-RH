import { Clock, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Employee, OvertimeEntry, OvertimeType } from '../types';
import {
  formatIsoDateBr,
  formatMinutesAsHours,
  formatSignedMinutes,
} from '../utils/schedule';
import { EmployeeAvatar } from './EmployeeAvatar';

interface OvertimeViewProps {
  employees: Employee[];
  entries: OvertimeEntry[];
  balances: Record<
    string,
    {
      balanceMinutes: number;
      totalExtraMinutes: number;
      totalDeductedMinutes: number;
      entryCount: number;
    }
  >;
  onAddOvertime: (employeeId?: string) => void;
  onDeleteEntry: (entry: OvertimeEntry) => void;
}

const TYPE_LABEL: Record<OvertimeType, string> = {
  extra: 'Hora Extra (+)',
  compensacao: 'Compensação (-)',
  pago: 'Paga em Folha (-)',
};

export function OvertimeView({
  employees,
  entries,
  balances,
  onAddOvertime,
  onDeleteEntry,
}: OvertimeViewProps) {
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | OvertimeType>('all');

  const empMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (employeeFilter !== 'all' && entry.employeeId !== employeeFilter) return false;
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
      return true;
    });
  }, [entries, employeeFilter, typeFilter]);

  const storeBalanceMinutes = Object.values(balances).reduce(
    (sum, b) => sum + b.balanceMinutes,
    0,
  );
  const totalExtras = Object.values(balances).reduce((sum, b) => sum + b.totalExtraMinutes, 0);
  const totalDeducted = Object.values(balances).reduce(
    (sum, b) => sum + b.totalDeductedMinutes,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Banco de Horas Extras</h2>
            <p className="text-xs text-slate-500">
              Controle de horas extras trabalhadas, folgas compensadas e horas pagas por funcionário.
            </p>
          </div>
          <button
            type="button"
            disabled={employees.length === 0}
            onClick={() => onAddOvertime()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Registrar Horas Extras
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-4">
            <p className="text-xs text-slate-500">Total de extras acumuladas</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700">
              +{formatMinutesAsHours(totalExtras)}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Total compensado / pago</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-700">
              -{formatMinutesAsHours(totalDeducted)}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Saldo líquido da loja</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
              {formatSignedMinutes(storeBalanceMinutes)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Saldo por funcionário</h3>
        </div>
        {employees.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Cadastre funcionários para acompanhar o saldo individual de horas extras.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5">Funcionário</th>
                  <th className="py-3 px-4 text-right">Extras (+)</th>
                  <th className="py-3 px-4 text-right">Compensado / Pago (-)</th>
                  <th className="py-3 px-4 text-right">Saldo Atual</th>
                  <th className="py-3 px-5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {employees.map((emp) => {
                  const b = balances[emp.id] ?? {
                    balanceMinutes: 0,
                    totalExtraMinutes: 0,
                    totalDeductedMinutes: 0,
                    entryCount: 0,
                  };
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar
                            name={emp.name}
                            photoDataUrl={emp.photoDataUrl}
                            size="sm"
                          />
                          <div>
                            <p className="font-semibold text-slate-900">{emp.name}</p>
                            <p className="text-xs text-slate-500">{emp.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-emerald-700">
                        +{formatMinutesAsHours(b.totalExtraMinutes)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                        -{formatMinutesAsHours(b.totalDeductedMinutes)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums text-xs font-bold ${
                          b.balanceMinutes > 0
                            ? 'text-emerald-700'
                            : b.balanceMinutes < 0
                              ? 'text-red-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {formatSignedMinutes(b.balanceMinutes)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => onAddOvertime(emp.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Lançar
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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Histórico de lançamentos ({filteredEntries.length})
          </h3>
          <div className="flex flex-wrap items-center gap-2">
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
            <select
              aria-label="Filtrar por tipo"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | OvertimeType)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="all">Todos os tipos</option>
              <option value="extra">Hora Extra (+)</option>
              <option value="compensacao">Compensação (-)</option>
              <option value="pago">Paga em Folha (-)</option>
            </select>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhum lançamento de hora extra encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5">Data</th>
                  <th className="py-3 px-4">Funcionário</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Observação</th>
                  <th className="py-3 px-4 text-right">Duração</th>
                  <th className="py-3 px-5 text-right">Excluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredEntries.map((entry) => {
                  const emp = empMap.get(entry.employeeId);
                  const isAdd = entry.type === 'extra';
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-700">
                        {formatIsoDateBr(entry.date)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900">
                          {emp?.name ?? 'Funcionário removido'}
                        </span>
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
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
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
                        <button
                          type="button"
                          onClick={() => onDeleteEntry(entry)}
                          aria-label="Remover lançamento"
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
