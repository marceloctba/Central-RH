import { Calendar, Clock, Copy, ShieldCheck, User, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { DayKey, DaySchedule, Employee, WeeklySchedule } from '../types';
import {
  calculateDayWorkedMinutes,
  calculateWeeklyMinutes,
  createDefaultWeeklySchedule,
  DAY_LABELS,
  DAY_ORDER,
  formatMinutesAsHours,
  isManagerRole,
  minutesToTime,
  SUGGESTED_ROLES,
  timeToMinutes,
} from '../utils/schedule';
import { PhotoCaptureField } from './PhotoCaptureField';

interface EmployeeFormModalProps {
  open: boolean;
  storeName: string;
  employee: Employee | null;
  initialTab?: 'profile' | 'schedule';
  onSave: (payload: {
    name: string;
    email: string;
    role: string;
    isManager: boolean;
    birthDate: string;
    photoDataUrl: string;
    active: boolean;
    schedule: WeeklySchedule;
  }) => Promise<void>;
  onClose: () => void;
}

export function EmployeeFormModal({
  open,
  storeName,
  employee,
  initialTab = 'profile',
  onSave,
  onClose,
}: EmployeeFormModalProps) {
  const [tab, setTab] = useState<'profile' | 'schedule'>(initialTab);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [isManager, setIsManager] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [active, setActive] = useState(true);
  const [schedule, setSchedule] = useState<WeeklySchedule>(createDefaultWeeklySchedule());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setError(null);
    if (employee) {
      setName(employee.name);
      setEmail(employee.email || '');
      setRole(employee.role);
      setIsManager(Boolean(employee.isManager));
      setBirthDate(employee.birthDate);
      setPhotoDataUrl(employee.photoDataUrl || '');
      setActive(employee.active);
      setSchedule(structuredClone(employee.schedule));
    } else {
      setName('');
      setEmail('');
      setRole('');
      setIsManager(false);
      setBirthDate('');
      setPhotoDataUrl('');
      setActive(true);
      setSchedule(createDefaultWeeklySchedule());
    }
  }, [open, employee, initialTab]);

  if (!open) return null;

  const handleRoleChange = (nextRole: string) => {
    setRole(nextRole);
    if (isManagerRole(nextRole)) {
      setIsManager(true);
    } else if (role && isManagerRole(role) && !isManagerRole(nextRole)) {
      setIsManager(false);
    }
  };

  const updateDay = (dayKey: DayKey, patch: Partial<DaySchedule>) => {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        ...patch,
      },
    }));
  };

  const applyLunchDuration = (dayKey: DayKey, durationMin: number) => {
    const day = schedule[dayKey];
    const startMin = timeToMinutes(day.lunchStart || '12:00');
    const nextEnd = minutesToTime(startMin + durationMin);
    updateDay(dayKey, {
      hasLunch: true,
      lunchStart: day.lunchStart || '12:00',
      lunchEnd: nextEnd,
    });
  };

  const copyMondayToDays = (targets: DayKey[]) => {
    const source = schedule.mon;
    setSchedule((prev) => {
      const next = { ...prev };
      for (const k of targets) {
        next[k] = { ...source };
      }
      return next;
    });
  };

  const markWeekendOff = () => {
    setSchedule((prev) => ({
      ...prev,
      sat: { ...prev.sat, working: false },
      sun: { ...prev.sun, working: false },
    }));
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Informe o nome completo do funcionário.';
    if (!role.trim()) return 'Informe a função do funcionário na loja.';
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return 'Informe um endereço de e-mail válido.';
    }
    if (isManager && !cleanEmail) {
      return 'Informe o e-mail do funcionário para liberar o acesso de gerente na loja.';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return 'Informe uma data de nascimento válida.';
    }
    for (const dayKey of DAY_ORDER) {
      const d = schedule[dayKey];
      if (!d.working) continue;
      const start = timeToMinutes(d.startTime);
      const end = timeToMinutes(d.endTime);
      if (end <= start) {
        return `Em ${DAY_LABELS[dayKey].full}, o horário de saída deve ser maior que o de entrada.`;
      }
      if (d.hasLunch) {
        if (!d.lunchStart || !d.lunchEnd) {
          return `Em ${DAY_LABELS[dayKey].full}, informe o início e o fim do horário de almoço.`;
        }
        const ls = timeToMinutes(d.lunchStart);
        const le = timeToMinutes(d.lunchEnd);
        if (le <= ls) {
          return `Em ${DAY_LABELS[dayKey].full}, o retorno do almoço deve ser após a saída para o almoço.`;
        }
        if (ls < start || le > end) {
          return `Em ${DAY_LABELS[dayKey].full}, o horário de almoço deve estar dentro da jornada (${d.startTime}–${d.endTime}).`;
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      if (
        validationError.includes('nome') ||
        validationError.includes('função') ||
        validationError.includes('e-mail') ||
        validationError.includes('nascimento')
      ) {
        setTab('profile');
      } else {
        setTab('schedule');
      }
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role.trim(),
        isManager,
        birthDate,
        photoDataUrl,
        active,
        schedule,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Não foi possível salvar os dados: ${err.message}`
          : 'Erro ao salvar funcionário.',
      );
    } finally {
      setSaving(false);
    }
  };

  const totalWeeklyMinutes = calculateWeeklyMinutes(schedule);
  const workingDaysCount = DAY_ORDER.filter((k) => schedule[k].working).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-modal-title"
    >
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-white">
          <div>
            <h2 id="employee-modal-title" className="text-lg font-bold text-slate-900">
              {employee ? `Editar: ${employee.name}` : 'Cadastrar Novo Funcionário'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Loja: <span className="font-medium text-slate-700">{storeName}</span> · Preencha
              dados, e-mail de acesso e escala semanal com almoço.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'profile'}
              onClick={() => setTab('profile')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'profile'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              Dados, E-mail e Foto
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'schedule'}
              onClick={() => setTab('schedule')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'schedule'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Escala Semanal e Almoço
            </button>
          </div>

          <div className="pb-2 text-xs text-slate-600 font-mono tabular-nums">
            <span>{workingDaysCount} dias</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="font-semibold text-slate-900">
              {formatMinutesAsHours(totalWeeklyMinutes)}/semana
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {tab === 'profile' ? (
              <div className="space-y-5">
                <PhotoCaptureField
                  name={name}
                  value={photoDataUrl}
                  onChange={setPhotoDataUrl}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="emp-name" className="block text-sm font-medium text-slate-800 mb-1.5">
                      Nome completo
                    </label>
                    <input
                      id="emp-name"
                      type="text"
                      required
                      maxLength={100}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex.: Mariana Silva Santos"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label htmlFor="emp-email" className="block text-sm font-medium text-slate-800 mb-1.5">
                      E-mail Google (opcional)
                    </label>
                    <input
                      id="emp-email"
                      type="email"
                      maxLength={120}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="colaborador@gmail.com"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      Ao entrar com este e-mail, o colaborador visualiza a própria escala, almoço e
                      horas extras.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="emp-birth" className="block text-sm font-medium text-slate-800 mb-1.5">
                      Data de aniversário
                    </label>
                    <input
                      id="emp-birth"
                      type="date"
                      required
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      Usada para gerar lembretes automáticos dos aniversariantes da semana.
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="emp-role" className="block text-sm font-medium text-slate-800 mb-1.5">
                      Função na loja
                    </label>
                    <input
                      id="emp-role"
                      type="text"
                      required
                      maxLength={80}
                      value={role}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      placeholder="Ex.: Gerente, Caixa, Vendedor(a), Estoquista"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {SUGGESTED_ROLES.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleRoleChange(suggestion)}
                          className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                            role === suggestion
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Permissão de Gerente nesta loja ({storeName})
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Funcionários marcados como gerente (ativado automaticamente na função
                        &quot;Gerente&quot;) podem cadastrar, editar e gerenciar toda a equipe,
                        escalas e horas extras desta loja. Requer e-mail preenchido.
                      </p>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 shrink-0 cursor-pointer select-none pt-0.5">
                    <input
                      type="checkbox"
                      checked={isManager}
                      onChange={(e) => setIsManager(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                    />
                    Liberar gestão
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Situação na loja</p>
                    <p className="text-xs text-slate-500">
                      Funcionários inativos ficam ocultos da escala diária e perdem acesso de gestão.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setActive(true)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ativo
                    </button>
                    <button
                      type="button"
                      onClick={() => setActive(false)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        !active
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Inativo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <p className="text-xs text-slate-600">
                    Atalhos rápidos baseados no horário de Segunda-feira:
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyMondayToDays(['tue', 'wed', 'thu', 'fri'])}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar Seg → Ter a Sex
                    </button>
                    <button
                      type="button"
                      onClick={() => copyMondayToDays(['tue', 'wed', 'thu', 'fri', 'sat'])}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar Seg → Ter a Sáb
                    </button>
                    <button
                      type="button"
                      onClick={markWeekendOff}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      Folga Sáb e Dom
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  {DAY_ORDER.map((dayKey) => {
                    const day = schedule[dayKey];
                    const netMinutes = calculateDayWorkedMinutes(day);
                    return (
                      <div
                        key={dayKey}
                        className={`p-3.5 transition-colors ${
                          day.working ? 'bg-white' : 'bg-slate-50/70'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="flex items-center justify-between lg:w-44 shrink-0 gap-3">
                            <span className="text-sm font-semibold text-slate-900">
                              {DAY_LABELS[dayKey].full}
                            </span>
                            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                              <button
                                type="button"
                                onClick={() => updateDay(dayKey, { working: true })}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                                  day.working
                                    ? 'bg-blue-700 text-white'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Trabalha
                              </button>
                              <button
                                type="button"
                                onClick={() => updateDay(dayKey, { working: false })}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                                  !day.working
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Folga
                              </button>
                            </div>
                          </div>

                          {day.working ? (
                            <div className="flex-1 flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <label className="text-xs text-slate-500">Entrada</label>
                                <input
                                  type="time"
                                  value={day.startTime}
                                  onChange={(e) => updateDay(dayKey, { startTime: e.target.value })}
                                  className="px-2 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <label className="text-xs text-slate-500">Saída</label>
                                <input
                                  type="time"
                                  value={day.endTime}
                                  onChange={(e) => updateDay(dayKey, { endTime: e.target.value })}
                                  className="px-2 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                                />
                              </div>

                              <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={day.hasLunch}
                                  onChange={(e) =>
                                    updateDay(dayKey, {
                                      hasLunch: e.target.checked,
                                      lunchStart: day.lunchStart || '12:00',
                                      lunchEnd: day.lunchEnd || '13:00',
                                    })
                                  }
                                  className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                                />
                                Almoço
                              </label>

                              {day.hasLunch && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <input
                                    type="time"
                                    aria-label={`Saída para almoço (${DAY_LABELS[dayKey].full})`}
                                    value={day.lunchStart}
                                    onChange={(e) =>
                                      updateDay(dayKey, { lunchStart: e.target.value })
                                    }
                                    className="px-2 py-1.5 text-xs font-mono tabular-nums bg-amber-50/70 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                  <span className="text-xs text-slate-400">às</span>
                                  <input
                                    type="time"
                                    aria-label={`Retorno do almoço (${DAY_LABELS[dayKey].full})`}
                                    value={day.lunchEnd}
                                    onChange={(e) =>
                                      updateDay(dayKey, { lunchEnd: e.target.value })
                                    }
                                    className="px-2 py-1.5 text-xs font-mono tabular-nums bg-amber-50/70 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                  <div className="flex items-center gap-1 ml-1">
                                    {[
                                      { label: '30m', min: 30 },
                                      { label: '1h', min: 60 },
                                      { label: '1h15', min: 75 },
                                    ].map((preset) => (
                                      <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => applyLunchDuration(dayKey, preset.min)}
                                        className="px-1.5 py-1 text-[11px] font-mono text-amber-800 bg-amber-100/80 hover:bg-amber-200/80 rounded transition-colors cursor-pointer"
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="ml-auto flex items-center gap-1 text-xs font-mono tabular-nums text-slate-700 font-medium">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {formatMinutesAsHours(netMinutes)}
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 text-xs text-slate-500 italic">
                              Folga programada neste dia da semana.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              {tab === 'profile' ? (
                <button
                  type="button"
                  onClick={() => setTab('schedule')}
                  className="text-blue-700 font-medium hover:underline cursor-pointer"
                >
                  Avançar para configurar escala e almoço →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setTab('profile')}
                  className="text-slate-600 font-medium hover:underline cursor-pointer"
                >
                  ← Voltar para dados e foto
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
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
                {saving
                  ? 'Salvando...'
                  : employee
                    ? 'Salvar alterações'
                    : 'Cadastrar funcionário'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
