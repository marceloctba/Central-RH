import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Cake,
  CalendarCheck2,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  Clock,
  Edit2,
  LogOut,
  Menu,
  Plus,
  Sparkles,
  Store as StoreIcon,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AgendaView } from './components/AgendaView';
import { BirthdaysView } from './components/BirthdaysView';
import { ConfirmModal } from './components/ConfirmModal';
import { DailyScheduleView } from './components/DailyScheduleView';
import { EmployeeFormModal } from './components/EmployeeFormModal';
import { EmployeeSelfView } from './components/EmployeeSelfView';
import { EmployeesView } from './components/EmployeesView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OvertimeModal } from './components/OvertimeModal';
import { OvertimeView } from './components/OvertimeView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ReminderModal } from './components/ReminderModal';
import { StoreModal } from './components/StoreModal';
import { TimeOffModal } from './components/TimeOffModal';
import { TimeOffView } from './components/TimeOffView';
import { WeeklyBirthdayBanner } from './components/WeeklyBirthdayBanner';
import { WeeklyMatrixView } from './components/WeeklyMatrixView';
import { auth, googleProvider } from './firebase';
import {
  createEmployeeForStore,
  createOvertimeEntryForStore,
  createReminderForStore,
  createSelfOvertimeEntry,
  createStore,
  createTimeOffForStore,
  deleteEmployeeAndSyncStore,
  deleteOvertimeEntry,
  deleteReminder,
  deleteStoreCascade,
  deleteTimeOffAndSync,
  renameStore,
  subscribeUserEmployees,
  subscribeUserOvertimeEntries,
  subscribeUserReminders,
  subscribeUserStores,
  subscribeUserTimeOffs,
  toggleReminderDone,
  updateEmployeeForStore,
  updateReminderForStore,
} from './services/storeService';
import type {
  Employee,
  OvertimeEntry,
  OvertimeType,
  Reminder,
  Store,
  TimeOffEntry,
  TimeOffReason,
  ViewMode,
  WeeklySchedule,
} from './types';
import { seedSampleStoreTeam } from './utils/sampleData';
import {
  computeOvertimeBalanceByEmployee,
  getBirthdayInfoForWeek,
  getTodayIsoDate,
} from './utils/schedule';

const NAV_ITEMS: { id: ViewMode; label: string; icon: typeof CalendarDays }[] = [
  { id: 'daily', label: 'Escala do Dia', icon: CalendarDays },
  { id: 'weekly', label: 'Escala Semanal', icon: CalendarRange },
  { id: 'agenda', label: 'Agenda', icon: CalendarCheck2 },
  { id: 'timeoffs', label: 'Folgas e Ausências', icon: CalendarOff },
  { id: 'employees', label: 'Funcionários', icon: Users },
  { id: 'overtime', label: 'Horas Extras', icon: Clock },
  { id: 'birthdays', label: 'Aniversariantes', icon: Cake },
];

const VIEW_TITLES: Record<ViewMode, string> = {
  daily: 'Escala Completa do Dia',
  weekly: 'Matriz Semanal da Equipe',
  agenda: 'Agenda e Lembretes',
  timeoffs: 'Folgas Planejadas e Baixas no Quadro',
  employees: 'Cadastro de Funcionários',
  overtime: 'Controle de Horas Extras',
  birthdays: 'Aniversariantes da Semana e Próximos',
  'my-profile': 'Minha Escala e Dados',
};

const ACTIVE_STORE_STORAGE_KEY = 'escalaloja_active_store_id';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [stores, setStores] = useState<Store[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [allOvertimeEntries, setAllOvertimeEntries] = useState<OvertimeEntry[]>([]);
  const [allTimeOffs, setAllTimeOffs] = useState<TimeOffEntry[]>([]);
  const [allReminders, setAllReminders] = useState<Reminder[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [activeStoreId, setActiveStoreId] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_STORE_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const [view, setView] = useState<ViewMode>('daily');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // First store setup state
  const [firstStoreName, setFirstStoreName] = useState('');
  const [creatingFirstStore, setCreatingFirstStore] = useState(false);
  const [firstStoreError, setFirstStoreError] = useState<string | null>(null);

  // Store modal state
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [deletingStore, setDeletingStore] = useState<Store | null>(null);

  // Employee modal state
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeModalTab, setEmployeeModalTab] = useState<'profile' | 'schedule'>('profile');

  // Overtime modal state (manager + self-service)
  const [overtimeModalOpen, setOvertimeModalOpen] = useState(false);
  const [overtimeDefaultEmpId, setOvertimeDefaultEmpId] = useState<string | undefined>(undefined);
  const [selfOvertimeEmployee, setSelfOvertimeEmployee] = useState<Employee | null>(null);

  // TimeOff modal state
  const [timeOffModalOpen, setTimeOffModalOpen] = useState(false);
  const [timeOffDefaultEmpId, setTimeOffDefaultEmpId] = useState<string | undefined>(undefined);
  const [timeOffDefaultDate, setTimeOffDefaultDate] = useState<string | undefined>(undefined);

  // Reminder modal state
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminderDefaultDate, setReminderDefaultDate] = useState<string | undefined>(undefined);

  // Confirm delete state
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<OvertimeEntry | null>(null);
  const [deletingTimeOff, setDeletingTimeOff] = useState<TimeOffEntry | null>(null);
  const [deletingReminder, setDeletingReminder] = useState<Reminder | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Sample seeding state
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setStores([]);
        setAllEmployees([]);
        setAllOvertimeEntries([]);
        setAllTimeOffs([]);
        setAllReminders([]);
        setLoadingData(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    setLoadingData(true);
    setDataError(null);
    const userEmail = (user.email || '').trim().toLowerCase();
    let storesLoaded = false;
    let empLoaded = false;
    let otLoaded = false;
    let toLoaded = false;
    let remLoaded = false;

    const markLoaded = () => {
      if (storesLoaded && empLoaded && otLoaded && toLoaded && remLoaded) {
        setLoadingData(false);
      }
    };

    const recordSyncError = (label: string, err: unknown) => {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code ?? '')
          : '';
      const rawMsg = err instanceof Error ? err.message : String(err ?? '');
      let formatted = `${label}`;
      if (rawMsg.includes('Quota exceeded')) {
        formatted = `${label} (Cota diária gratuita do Firestore atingida. A cota é redefinida no dia seguinte ou você pode verificar em: https://console.firebase.google.com/project/gen-lang-client-0592836910/firestore/databases/ai-studio-centralrhgestode-e43b7b96-cb65-435d-b017-85d992c29355/data?openUpgradeDialog=true)`;
      } else if (code || rawMsg) {
        formatted = `${label} (${code ? `${code}: ` : ''}${rawMsg})`;
      }
      setDataError((prev) => {
        if (!prev) return formatted;
        if (prev.includes(label)) return prev;
        return `${prev} | ${formatted}`;
      });
      setLoadingData(false);
    };

    const unsubStores = subscribeUserStores(
      user.uid,
      userEmail,
      (list) => {
        setStores(list);
        storesLoaded = true;
        markLoaded();
      },
      (err) => recordSyncError('Erro ao sincronizar lojas com o banco de dados', err),
    );

    const unsubEmp = subscribeUserEmployees(
      user.uid,
      userEmail,
      (list) => {
        setAllEmployees(list);
        empLoaded = true;
        markLoaded();
      },
      (err) => recordSyncError('Erro ao sincronizar funcionários com o banco de dados', err),
    );

    const unsubOt = subscribeUserOvertimeEntries(
      user.uid,
      userEmail,
      (list) => {
        setAllOvertimeEntries(list);
        otLoaded = true;
        markLoaded();
      },
      (err) => recordSyncError('Erro ao sincronizar lançamentos de horas extras', err),
    );

    const unsubTo = subscribeUserTimeOffs(
      user.uid,
      userEmail,
      (list) => {
        setAllTimeOffs(list);
        toLoaded = true;
        markLoaded();
      },
      (err) => recordSyncError('Erro ao sincronizar folgas planejadas', err),
    );

    const unsubRem = subscribeUserReminders(
      user.uid,
      userEmail,
      (list) => {
        setAllReminders(list);
        remLoaded = true;
        markLoaded();
      },
      (err) => recordSyncError('Erro ao sincronizar lembretes da agenda', err),
    );

    return () => {
      unsubStores();
      unsubEmp();
      unsubOt();
      unsubTo();
      unsubRem();
    };
  }, [authReady, user]);

  useEffect(() => {
    if (stores.length === 0) return;
    if (!activeStoreId || !stores.some((s) => s.id === activeStoreId)) {
      const firstId = stores[0].id;
      setActiveStoreId(firstId);
      try {
        localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, firstId);
      } catch {
        // ignore
      }
    }
  }, [stores, activeStoreId]);

  const selectStore = (storeId: string) => {
    setActiveStoreId(storeId);
    try {
      localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, storeId);
    } catch {
      // ignore
    }
  };

  const activeStore = useMemo(
    () => stores.find((s) => s.id === activeStoreId) ?? stores[0] ?? null,
    [stores, activeStoreId],
  );

  const storeEmployees = useMemo(() => {
    if (!activeStore) return [];
    return allEmployees.filter((e) => e.storeId === activeStore.id);
  }, [allEmployees, activeStore]);

  const storeEntries = useMemo(() => {
    if (!activeStore) return [];
    return allOvertimeEntries.filter((e) => e.storeId === activeStore.id);
  }, [allOvertimeEntries, activeStore]);

  const storeTimeOffs = useMemo(() => {
    if (!activeStore) return [];
    return allTimeOffs.filter((t) => t.storeId === activeStore.id);
  }, [allTimeOffs, activeStore]);

  const storeReminders = useMemo(() => {
    if (!activeStore) return [];
    return allReminders.filter((r) => r.storeId === activeStore.id);
  }, [allReminders, activeStore]);

  const todayIso = getTodayIsoDate();
  const upcomingStoreTimeOffCount = useMemo(
    () => storeTimeOffs.filter((t) => t.endDate >= todayIso).length,
    [storeTimeOffs, todayIso],
  );
  const pendingStoreRemindersCount = useMemo(
    () => storeReminders.filter((r) => !r.done && r.date >= todayIso).length,
    [storeReminders, todayIso],
  );

  const userEmail = (user?.email || '').trim().toLowerCase();

  const selfEmployees = useMemo(() => {
    if (!userEmail) return [];
    return allEmployees.filter((e) => e.email === userEmail);
  }, [allEmployees, userEmail]);

  const selfOvertimeEntries = useMemo(() => {
    const ids = new Set(selfEmployees.map((e) => e.id));
    return allOvertimeEntries.filter((entry) => ids.has(entry.employeeId));
  }, [allOvertimeEntries, selfEmployees]);

  const selfTimeOffs = useMemo(() => {
    const ids = new Set(selfEmployees.map((e) => e.id));
    return allTimeOffs.filter((t) => ids.has(t.employeeId));
  }, [allTimeOffs, selfEmployees]);

  const overtimeBalances = useMemo(
    () => computeOvertimeBalanceByEmployee(storeEntries),
    [storeEntries],
  );

  const weeklyBirthdays = useMemo(
    () => getBirthdayInfoForWeek(storeEmployees.filter((e) => e.active)),
    [storeEmployees],
  );

  const isStoreOwner = Boolean(
    activeStore &&
      user &&
      (activeStore.ownerId === user.uid ||
        (userEmail && activeStore.ownerEmail === userEmail)),
  );

  const handleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? 'Não foi possível entrar com sua conta Google. Tente novamente.'
          : 'Erro ao autenticar.',
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleCreateFirstStore = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || creatingFirstStore) return;
    const cleanName = firstStoreName.trim();
    if (!cleanName) {
      setFirstStoreError('Informe o nome da loja para continuar.');
      return;
    }
    setCreatingFirstStore(true);
    setFirstStoreError(null);
    try {
      const created = await createStore(user.uid, user.email || '', cleanName);
      setStores((prev) => (prev.some((s) => s.id === created.id) ? prev : [...prev, created]));
      selectStore(created.id);
      setFirstStoreName('');
    } catch (err) {
      let detail = 'Não foi possível criar a loja. Verifique sua conexão e tente novamente.';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { error?: string };
          if (parsed.error) {
            if (parsed.error.includes('Quota exceeded')) {
              detail = 'Limite diário gratuito do banco de dados atingido. Tente novamente mais tarde.';
            } else if (parsed.error.includes('Missing or insufficient permissions')) {
              detail = 'Sem permissão para criar a loja. Saia e entre novamente com sua conta Google verificada.';
            } else if (parsed.error.includes('offline')) {
              detail = 'Sem conexão com o banco de dados. Verifique sua internet e tente novamente.';
            } else {
              detail = `Erro ao criar a loja: ${parsed.error}`;
            }
          }
        } catch {
          detail = `Erro ao criar a loja: ${err.message}`;
        }
      }
      setFirstStoreError(detail);
    } finally {
      setCreatingFirstStore(false);
    }
  };

  const handleSaveStoreModal = async (name: string) => {
    if (!user) return;
    if (editingStore) {
      const empsOfStore = allEmployees.filter((e) => e.storeId === editingStore.id);
      const tosOfStore = allTimeOffs.filter((t) => t.storeId === editingStore.id);
      const remsOfStore = allReminders.filter((r) => r.storeId === editingStore.id);
      await renameStore(editingStore, name, empsOfStore, tosOfStore, remsOfStore);
    } else {
      const created = await createStore(user.uid, user.email || '', name);
      selectStore(created.id);
      setView('daily');
    }
  };

  const confirmDeleteStore = async () => {
    if (!deletingStore) return;
    setDeleteBusy(true);
    try {
      const emps = allEmployees.filter((e) => e.storeId === deletingStore.id);
      const ents = allOvertimeEntries.filter((e) => e.storeId === deletingStore.id);
      const tos = allTimeOffs.filter((t) => t.storeId === deletingStore.id);
      const rems = allReminders.filter((r) => r.storeId === deletingStore.id);
      await deleteStoreCascade(deletingStore.id, emps, ents, tos, rems);
      setDeletingStore(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const openNewEmployeeModal = () => {
    setEditingEmployee(null);
    setEmployeeModalTab('profile');
    setEmployeeModalOpen(true);
  };

  const openEditEmployeeModal = (emp: Employee, tab: 'profile' | 'schedule' = 'profile') => {
    setEditingEmployee(emp);
    setEmployeeModalTab(tab);
    setEmployeeModalOpen(true);
  };

  const openOvertimeModal = (employeeId?: string) => {
    setSelfOvertimeEmployee(null);
    setOvertimeDefaultEmpId(employeeId);
    setOvertimeModalOpen(true);
  };

  const openSelfOvertimeModal = (employee: Employee) => {
    setSelfOvertimeEmployee(employee);
    setOvertimeDefaultEmpId(employee.id);
    setOvertimeModalOpen(true);
  };

  const openTimeOffModal = (dateIso?: string, employeeId?: string) => {
    setTimeOffDefaultDate(dateIso);
    setTimeOffDefaultEmpId(employeeId);
    setTimeOffModalOpen(true);
  };

  const openNewReminderModal = (dateIso?: string) => {
    setEditingReminder(null);
    setReminderDefaultDate(dateIso);
    setReminderModalOpen(true);
  };

  const openEditReminderModal = (rem: Reminder) => {
    setEditingReminder(rem);
    setReminderDefaultDate(rem.date);
    setReminderModalOpen(true);
  };

  const handleSaveEmployee = async (payload: {
    name: string;
    email: string;
    role: string;
    isManager: boolean;
    birthDate: string;
    photoDataUrl: string;
    active: boolean;
    schedule: WeeklySchedule;
  }) => {
    if (!activeStore) return;
    if (editingEmployee) {
      await updateEmployeeForStore(
        activeStore,
        editingEmployee.id,
        storeEmployees,
        storeEntries,
        payload,
        storeTimeOffs,
        storeReminders,
      );
    } else {
      await createEmployeeForStore(
        activeStore,
        storeEmployees,
        storeEntries,
        payload,
        storeTimeOffs,
        storeReminders,
      );
    }
  };

  const handleSaveOvertime = async (payload: {
    employeeId: string;
    date: string;
    type: OvertimeType;
    minutes: number;
    note: string;
  }) => {
    if (selfOvertimeEmployee) {
      await createSelfOvertimeEntry(selfOvertimeEmployee, userEmail, {
        date: payload.date,
        type: payload.type,
        minutes: payload.minutes,
        note: payload.note,
      });
      return;
    }
    if (!activeStore) return;
    const emp = storeEmployees.find((e) => e.id === payload.employeeId);
    if (!emp) return;
    await createOvertimeEntryForStore(activeStore, emp, userEmail, payload);
  };

  const handleSaveTimeOff = async (payload: {
    employeeId: string;
    startDate: string;
    endDate: string;
    reason: TimeOffReason;
    deductFromBank: boolean;
    deductedMinutes: number;
    note: string;
  }) => {
    if (!activeStore) return;
    const emp = storeEmployees.find((e) => e.id === payload.employeeId);
    if (!emp) return;
    await createTimeOffForStore(activeStore, emp, userEmail, payload);
  };

  const handleSaveReminder = async (payload: {
    date: string;
    time: string;
    title: string;
    note: string;
    done: boolean;
  }) => {
    if (editingReminder) {
      await updateReminderForStore(editingReminder.id, payload);
      return;
    }
    if (!activeStore) return;
    await createReminderForStore(activeStore, userEmail, payload);
  };

  const handleToggleReminderDone = async (rem: Reminder) => {
    await toggleReminderDone(rem.id, !rem.done);
  };

  const confirmDeleteEmployee = async () => {
    if (!deletingEmployee || !activeStore) return;
    setDeleteBusy(true);
    try {
      await deleteEmployeeAndSyncStore(
        activeStore,
        deletingEmployee.id,
        storeEmployees,
        storeEntries,
        storeTimeOffs,
        storeReminders,
      );
      setDeletingEmployee(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const confirmDeleteEntry = async () => {
    if (!deletingEntry) return;
    setDeleteBusy(true);
    try {
      await deleteOvertimeEntry(deletingEntry.id);
      setDeletingEntry(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const confirmDeleteTimeOff = async () => {
    if (!deletingTimeOff) return;
    setDeleteBusy(true);
    try {
      await deleteTimeOffAndSync(deletingTimeOff);
      setDeletingTimeOff(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const confirmDeleteReminder = async () => {
    if (!deletingReminder) return;
    setDeleteBusy(true);
    try {
      await deleteReminder(deletingReminder.id);
      setDeletingReminder(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleSeedSample = async () => {
    if (!activeStore || seeding) return;
    setSeeding(true);
    try {
      await seedSampleStoreTeam(activeStore, userEmail, storeEmployees, storeEntries);
    } finally {
      setSeeding(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm text-slate-500">Carregando sistema da loja...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div>
            <p className="text-sm font-semibold text-blue-700 font-display">Central RH</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
              Gestão de Equipe, Lojas e Escalas
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Organize a escala completa das suas lojas em um só lugar: cadastro com foto pela
              câmera, acesso individual para colaboradores, gestão compartilhada com gerentes,
              agenda de lembretes, folgas planejadas e banco de horas extras.
            </p>
          </div>

          <div className="border-t border-slate-200 pt-5 space-y-2 text-xs text-slate-600">
            <p>• Gerencie múltiplas lojas com nomes próprios e equipes independentes</p>
            <p>• Funcionários consultam a escala e registram suas próprias horas extras</p>
            <p>• Agenda de lembretes e entrevistas por data e horário</p>
            <p>• Agende folgas (banco de horas, férias, atestado, outros) com mapa de baixas</p>
            <p>• Linha do tempo diária de turnos, almoços, folgas e aniversariantes</p>
          </div>

          {authError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {authError}
            </div>
          )}

          <button
            type="button"
            disabled={signingIn}
            onClick={() => void handleSignIn()}
            className="w-full py-3 px-4 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {signingIn ? 'Conectando...' : 'Entrar com Google'}
          </button>

          <PWAInstallButton variant="card" />
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 max-w-4xl mx-auto space-y-4 pt-16">
        <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Regular employee portal (no owned or managed stores, only employee record(s) matching email)
  if (stores.length === 0 && selfEmployees.length > 0) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg font-extrabold tracking-tight font-display text-slate-900 whitespace-nowrap">
              Central RH
            </span>
            <span aria-hidden="true" className="text-slate-300">
              /
            </span>
            <span className="text-sm font-medium text-slate-600 truncate">
              Portal do Colaborador
            </span>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton variant="header" />
            <span className="hidden sm:inline text-xs text-slate-500">{user.email}</span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-8 py-6">
          {dataError && (
            <div className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {dataError}
            </div>
          )}
          <EmployeeSelfView
            employees={selfEmployees}
            overtimeEntries={selfOvertimeEntries}
            timeOffs={selfTimeOffs}
            currentUserEmail={userEmail}
            onAddSelfOvertime={openSelfOvertimeModal}
            onDeleteSelfOvertime={(entry) => setDeletingEntry(entry)}
          />
        </main>

        <OvertimeModal
          open={overtimeModalOpen}
          employees={selfOvertimeEmployee ? [selfOvertimeEmployee] : selfEmployees}
          defaultEmployeeId={overtimeDefaultEmpId}
          selfMode
          onSave={handleSaveOvertime}
          onClose={() => {
            setOvertimeModalOpen(false);
            setSelfOvertimeEmployee(null);
          }}
        />

        <ConfirmModal
          open={Boolean(deletingEntry)}
          title="Excluir lançamento de hora extra"
          description="Deseja remover este registro do seu banco de horas?"
          confirmLabel="Excluir registro"
          danger
          loading={deleteBusy}
          onConfirm={() => void confirmDeleteEntry()}
          onClose={() => setDeletingEntry(null)}
        />
      </div>
    );
  }

  // First-time manager onboarding: no stores and no employee records yet
  if (stores.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-blue-700 font-display">Central RH</p>
              <h1 className="mt-1 text-xl font-bold text-slate-900">
                Cadastre sua primeira loja
              </h1>
            </div>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            Dê um nome para a loja que você gerencia. Depois você poderá adicionar outras filiais
            ou lojas a qualquer momento no menu lateral.
          </p>

          {(firstStoreError || dataError) && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {firstStoreError || dataError}
            </div>
          )}

          <form onSubmit={handleCreateFirstStore} noValidate className="space-y-4">
            <div>
              <label htmlFor="first-store-name" className="block text-sm font-medium text-slate-800 mb-1.5">
                Nome da loja
              </label>
              <input
                id="first-store-name"
                type="text"
                maxLength={80}
                value={firstStoreName}
                onChange={(e) => {
                  setFirstStoreName(e.target.value);
                  if (firstStoreError) setFirstStoreError(null);
                }}
                placeholder="Ex.: Loja Centro, Matriz..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={creatingFirstStore}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {creatingFirstStore ? 'Criando loja...' : 'Criar loja e começar'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
            Você é funcionário de uma loja já cadastrada? Peça ao gerente para adicionar seu e-mail (
            <span className="font-mono text-slate-700">{user.email}</span>) na sua ficha para
            visualizar sua escala automaticamente aqui.
          </div>

          <PWAInstallButton variant="card" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`no-print fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-150 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-tight font-display text-slate-900">
            Central RH
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu"
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 border-b border-slate-200 space-y-2.5 bg-slate-50/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <StoreIcon className="w-3.5 h-3.5" />
              Loja selecionada
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingStore(null);
                setStoreModalOpen(true);
              }}
              className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
            >
              + Nova loja
            </button>
          </div>

          <select
            aria-label="Selecionar loja"
            value={activeStore?.id || ''}
            onChange={(e) => selectStore(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {activeStore && (
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setEditingStore(activeStore);
                  setStoreModalOpen(true);
                }}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                Renomear
              </button>
              {isStoreOwner && stores.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDeletingStore(activeStore)}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Excluir loja
                </button>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            const badgeCount =
              item.id === 'birthdays' && weeklyBirthdays.length > 0
                ? weeklyBirthdays.length
                : item.id === 'employees'
                  ? storeEmployees.filter((e) => e.active).length
                  : item.id === 'timeoffs' && upcomingStoreTimeOffCount > 0
                    ? upcomingStoreTimeOffCount
                    : item.id === 'agenda' && pendingStoreRemindersCount > 0
                      ? pendingStoreRemindersCount
                      : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setView(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {badgeCount !== null && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      active ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}

          {selfEmployees.length > 0 && (
            <div className="pt-2 mt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setView('my-profile');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  view === 'my-profile'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span className="truncate">Minha Escala</span>
              </button>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Gerente'}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center shrink-0">
                G
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user.displayName || 'Gerente'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>

          <PWAInstallButton variant="sidebar" />

          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair da conta
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">
                {activeStore ? activeStore.name : 'Gestão da Loja'}
              </p>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {VIEW_TITLES[view]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex">
              <PWAInstallButton variant="header" />
            </div>
            <button
              type="button"
              onClick={openNewEmployeeModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Funcionário
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1280px] w-full mx-auto print-full">
          {dataError && (
            <div className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {dataError}
            </div>
          )}

          {view !== 'my-profile' && (
            <WeeklyBirthdayBanner
              matches={weeklyBirthdays}
              onOpenBirthdays={() => setView('birthdays')}
            />
          )}

          {storeEmployees.length === 0 && view !== 'my-profile' && (
            <div className="no-print mb-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {activeStore?.name} ainda não tem funcionários cadastrados
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cadastre a equipe desta loja ou carregue 5 funcionários de exemplo para testar a
                  escala diária, almoço, folgas planejadas, horas extras e aniversariantes.
                </p>
              </div>
              <button
                type="button"
                disabled={seeding}
                onClick={() => void handleSeedSample()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {seeding ? 'Carregando equipe...' : 'Carregar equipe de exemplo'}
              </button>
            </div>
          )}

          {view === 'daily' && (
            <DailyScheduleView
              employees={storeEmployees}
              timeOffs={storeTimeOffs}
              reminders={storeReminders}
              overtimeBalances={overtimeBalances}
              onEditSchedule={(emp) => openEditEmployeeModal(emp, 'schedule')}
              onAddOvertime={(empId) => openOvertimeModal(empId)}
              onScheduleTimeOff={(dateIso, empId) => openTimeOffModal(dateIso, empId)}
              onAddReminder={(dateIso) => openNewReminderModal(dateIso)}
              onToggleReminderDone={(rem) => void handleToggleReminderDone(rem)}
              onOpenAgenda={() => setView('agenda')}
              onAddEmployee={openNewEmployeeModal}
            />
          )}

          {view === 'weekly' && (
            <WeeklyMatrixView
              employees={storeEmployees}
              onEditSchedule={(emp) => openEditEmployeeModal(emp, 'schedule')}
            />
          )}

          {view === 'agenda' && (
            <AgendaView
              reminders={storeReminders}
              onAddReminder={(dateIso) => openNewReminderModal(dateIso)}
              onEditReminder={(rem) => openEditReminderModal(rem)}
              onToggleDone={(rem) => void handleToggleReminderDone(rem)}
              onDeleteReminder={(rem) => setDeletingReminder(rem)}
            />
          )}

          {view === 'timeoffs' && (
            <TimeOffView
              employees={storeEmployees}
              timeOffs={storeTimeOffs}
              onAddTimeOff={(dateIso, empId) => openTimeOffModal(dateIso, empId)}
              onDeleteTimeOff={(entry) => setDeletingTimeOff(entry)}
            />
          )}

          {view === 'employees' && (
            <EmployeesView
              employees={storeEmployees}
              overtimeBalances={overtimeBalances}
              onAddEmployee={openNewEmployeeModal}
              onEditEmployee={(emp, tab) => openEditEmployeeModal(emp, tab)}
              onAddOvertime={(empId) => openOvertimeModal(empId)}
              onScheduleTimeOff={(empId) => openTimeOffModal(undefined, empId)}
              onDeleteEmployee={(emp) => setDeletingEmployee(emp)}
            />
          )}

          {view === 'overtime' && (
            <OvertimeView
              employees={storeEmployees}
              entries={storeEntries}
              balances={overtimeBalances}
              onAddOvertime={(empId) => openOvertimeModal(empId)}
              onDeleteEntry={(entry) => setDeletingEntry(entry)}
            />
          )}

          {view === 'birthdays' && <BirthdaysView employees={storeEmployees} />}

          {view === 'my-profile' && (
            <EmployeeSelfView
              employees={selfEmployees}
              overtimeEntries={selfOvertimeEntries}
              timeOffs={selfTimeOffs}
              currentUserEmail={userEmail}
              onAddSelfOvertime={openSelfOvertimeModal}
              onDeleteSelfOvertime={(entry) => setDeletingEntry(entry)}
            />
          )}
        </main>
      </div>

      <StoreModal
        open={storeModalOpen}
        store={editingStore}
        onSave={handleSaveStoreModal}
        onClose={() => setStoreModalOpen(false)}
      />

      <EmployeeFormModal
        open={employeeModalOpen}
        storeName={activeStore?.name || ''}
        employee={editingEmployee}
        initialTab={employeeModalTab}
        onSave={handleSaveEmployee}
        onClose={() => setEmployeeModalOpen(false)}
      />

      <OvertimeModal
        open={overtimeModalOpen}
        employees={selfOvertimeEmployee ? [selfOvertimeEmployee] : storeEmployees}
        defaultEmployeeId={overtimeDefaultEmpId}
        selfMode={Boolean(selfOvertimeEmployee)}
        onSave={handleSaveOvertime}
        onClose={() => {
          setOvertimeModalOpen(false);
          setSelfOvertimeEmployee(null);
        }}
      />

      <TimeOffModal
        open={timeOffModalOpen}
        employees={storeEmployees}
        existingTimeOffs={storeTimeOffs}
        overtimeBalances={overtimeBalances}
        defaultEmployeeId={timeOffDefaultEmpId}
        defaultDate={timeOffDefaultDate}
        onSave={handleSaveTimeOff}
        onClose={() => setTimeOffModalOpen(false)}
      />

      <ReminderModal
        open={reminderModalOpen}
        reminder={editingReminder}
        defaultDate={reminderDefaultDate}
        onSave={handleSaveReminder}
        onClose={() => {
          setReminderModalOpen(false);
          setEditingReminder(null);
        }}
      />

      <ConfirmModal
        open={Boolean(deletingEmployee)}
        title="Excluir funcionário"
        description={
          deletingEmployee
            ? `Tem certeza que deseja excluir ${deletingEmployee.name}? Todos os lançamentos de horas extras e folgas planejadas deste colaborador também serão removidos.`
            : ''
        }
        confirmLabel="Excluir funcionário"
        danger
        loading={deleteBusy}
        onConfirm={() => void confirmDeleteEmployee()}
        onClose={() => setDeletingEmployee(null)}
      />

      <ConfirmModal
        open={Boolean(deletingEntry)}
        title="Excluir lançamento de hora extra"
        description="Deseja remover este registro do histórico do banco de horas? O saldo do funcionário será recalculado automaticamente."
        confirmLabel="Excluir registro"
        danger
        loading={deleteBusy}
        onConfirm={() => void confirmDeleteEntry()}
        onClose={() => setDeletingEntry(null)}
      />

      <ConfirmModal
        open={Boolean(deletingTimeOff)}
        title="Remover folga / ausência agendada"
        description={
          deletingTimeOff?.linkedOvertimeEntryId
            ? 'Ao remover este agendamento, o desconto correspondente no banco de horas do colaborador também será estornado.'
            : 'Deseja remover este agendamento de folga ou ausência?'
        }
        confirmLabel="Remover agendamento"
        danger
        loading={deleteBusy}
        onConfirm={() => void confirmDeleteTimeOff()}
        onClose={() => setDeletingTimeOff(null)}
      />

      <ConfirmModal
        open={Boolean(deletingReminder)}
        title="Excluir lembrete da agenda"
        description={
          deletingReminder
            ? `Tem certeza que deseja remover o lembrete "${deletingReminder.title}"?`
            : ''
        }
        confirmLabel="Excluir lembrete"
        danger
        loading={deleteBusy}
        onConfirm={() => void confirmDeleteReminder()}
        onClose={() => setDeletingReminder(null)}
      />

      <ConfirmModal
        open={Boolean(deletingStore)}
        title="Excluir loja"
        description={
          deletingStore
            ? `Tem certeza que deseja excluir a loja "${deletingStore.name}"? Todos os funcionários, escalas, agenda, folgas e horas extras vinculados a esta loja serão removidos permanentemente.`
            : ''
        }
        confirmLabel="Excluir loja"
        danger
        loading={deleteBusy}
        onConfirm={() => void confirmDeleteStore()}
        onClose={() => setDeletingStore(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
      <OfflineIndicator />
    </ErrorBoundary>
  );
}
