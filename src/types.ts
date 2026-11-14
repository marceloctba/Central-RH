export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DaySchedule {
  working: boolean;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  hasLunch: boolean;
  lunchStart: string; // HH:MM or ""
  lunchEnd: string; // HH:MM or ""
}

export type WeeklySchedule = Record<DayKey, DaySchedule>;

export interface Store {
  id: string;
  ownerId: string;
  ownerEmail: string;
  name: string;
  managerEmails: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Employee {
  id: string;
  storeId: string;
  storeName: string;
  ownerId: string;
  managerEmails: string[];
  name: string;
  email: string;
  role: string;
  isManager: boolean;
  birthDate: string; // YYYY-MM-DD
  photoDataUrl: string;
  active: boolean;
  schedule: WeeklySchedule;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type OvertimeType = 'extra' | 'compensacao' | 'pago';

export interface OvertimeEntry {
  id: string;
  storeId: string;
  ownerId: string;
  managerEmails: string[];
  employeeId: string;
  employeeEmail: string;
  createdByEmail: string;
  date: string; // YYYY-MM-DD
  type: OvertimeType;
  minutes: number;
  note: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type TimeOffReason = 'banco_horas' | 'ferias' | 'atestado' | 'outros';

export interface TimeOffEntry {
  id: string;
  storeId: string;
  storeName: string;
  ownerId: string;
  managerEmails: string[];
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: TimeOffReason;
  deductFromBank: boolean;
  deductedMinutes: number;
  linkedOvertimeEntryId: string;
  note: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Reminder {
  id: string;
  storeId: string;
  storeName: string;
  ownerId: string;
  managerEmails: string[];
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or ""
  title: string;
  note: string;
  done: boolean;
  createdByEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ViewMode =
  | 'daily'
  | 'weekly'
  | 'agenda'
  | 'timeoffs'
  | 'employees'
  | 'overtime'
  | 'birthdays'
  | 'my-profile';
