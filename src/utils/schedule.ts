import type {
  DayKey,
  DaySchedule,
  Employee,
  OvertimeEntry,
  TimeOffEntry,
  TimeOffReason,
  WeeklySchedule,
} from '../types';

export const DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS: Record<DayKey, { short: string; full: string }> = {
  mon: { short: 'Seg', full: 'Segunda-feira' },
  tue: { short: 'Ter', full: 'Terça-feira' },
  wed: { short: 'Qua', full: 'Quarta-feira' },
  thu: { short: 'Qui', full: 'Quinta-feira' },
  fri: { short: 'Sex', full: 'Sexta-feira' },
  sat: { short: 'Sáb', full: 'Sábado' },
  sun: { short: 'Dom', full: 'Domingo' },
};

export const TIME_OFF_REASON_LABELS: Record<TimeOffReason, string> = {
  banco_horas: 'Folga (Banco de horas)',
  ferias: 'Férias',
  atestado: 'Atestado médico',
  outros: 'Outros',
};

export const SUGGESTED_ROLES = [
  'Gerente',
  'Subgerente',
  'Vendedor(a)',
  'Caixa',
  'Estoquista',
  'Repositor(a)',
  'Atendimento',
  'Fiscal de Loja',
];

export function isManagerRole(role: string): boolean {
  const normalized = role.trim().toLowerCase();
  return normalized === 'gerente' || normalized.startsWith('gerente ');
}

export function jsDayToDayKey(jsDay: number): DayKey {
  const map: Record<number, DayKey> = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
  };
  return map[jsDay];
}

export function getTodayDayKey(now = new Date()): DayKey {
  return jsDayToDayKey(now.getDay());
}

export function formatDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayIsoDate(now = new Date()): string {
  return formatDateToIso(now);
}

export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function enumerateIsoDates(startIso: string, endIso: string, maxDays = 90): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso)) return [];
  if (endIso < startIso) return [];
  const start = parseIsoDateLocal(startIso);
  const end = parseIsoDateLocal(endIso);
  const result: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && result.length < maxDays) {
    result.push(formatDateToIso(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function calculateScheduledMinutesForRange(
  schedule: WeeklySchedule,
  startIso: string,
  endIso: string,
): number {
  const dates = enumerateIsoDates(startIso, endIso, 31);
  let total = 0;
  for (const iso of dates) {
    const dayKey = jsDayToDayKey(parseIsoDateLocal(iso).getDay());
    total += calculateDayWorkedMinutes(schedule[dayKey]);
  }
  return total;
}

export function getTimeOffForEmployeeOnDate(
  timeOffs: TimeOffEntry[],
  employeeId: string,
  isoDate: string,
): TimeOffEntry | undefined {
  return timeOffs.find(
    (t) => t.employeeId === employeeId && t.startDate <= isoDate && t.endDate >= isoDate,
  );
}

export function getDateForDayInCurrentWeek(dayKey: DayKey, now = new Date()): Date {
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const jsDay = current.getDay(); // 0=Sun..6=Sat
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(current);
  monday.setDate(current.getDate() + mondayOffset);
  const idx = DAY_ORDER.indexOf(dayKey);
  const target = new Date(monday);
  target.setDate(monday.getDate() + idx);
  return target;
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function calculateDayWorkedMinutes(day: DaySchedule): number {
  if (!day.working) return 0;
  const start = timeToMinutes(day.startTime);
  const end = timeToMinutes(day.endTime);
  if (end <= start) return 0;
  let total = end - start;
  if (day.hasLunch && day.lunchStart && day.lunchEnd) {
    const ls = timeToMinutes(day.lunchStart);
    const le = timeToMinutes(day.lunchEnd);
    if (le > ls && ls >= start && le <= end) {
      total -= le - ls;
    }
  }
  return Math.max(0, total);
}

export function calculateWeeklyMinutes(schedule: WeeklySchedule): number {
  return DAY_ORDER.reduce((sum, key) => sum + calculateDayWorkedMinutes(schedule[key]), 0);
}

export function formatMinutesAsHours(totalMinutes: number): string {
  const abs = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

export function formatSignedMinutes(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : '';
  return `${sign}${formatMinutesAsHours(rounded)}`;
}

export function createDefaultDaySchedule(working = true): DaySchedule {
  return {
    working,
    startTime: '08:00',
    endTime: '17:00',
    hasLunch: true,
    lunchStart: '12:00',
    lunchEnd: '13:00',
  };
}

export function createDefaultWeeklySchedule(): WeeklySchedule {
  return {
    mon: createDefaultDaySchedule(true),
    tue: createDefaultDaySchedule(true),
    wed: createDefaultDaySchedule(true),
    thu: createDefaultDaySchedule(true),
    fri: createDefaultDaySchedule(true),
    sat: {
      working: true,
      startTime: '09:00',
      endTime: '13:00',
      hasLunch: false,
      lunchStart: '',
      lunchEnd: '',
    },
    sun: createDefaultDaySchedule(false),
  };
}

export interface LiveShiftStatus {
  code: 'off' | 'lunch' | 'working' | 'upcoming' | 'finished';
  label: string;
}

export function getLiveShiftStatus(
  day: DaySchedule,
  isToday: boolean,
  now = new Date(),
): LiveShiftStatus {
  if (!day.working) {
    return { code: 'off', label: 'Folga' };
  }
  if (!isToday) {
    return { code: 'working', label: 'Escalado' };
  }
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(day.startTime);
  const end = timeToMinutes(day.endTime);

  if (nowMin < start) {
    return { code: 'upcoming', label: `Entra às ${day.startTime}` };
  }
  if (nowMin >= end) {
    return { code: 'finished', label: 'Turno encerrado' };
  }
  if (day.hasLunch && day.lunchStart && day.lunchEnd) {
    const ls = timeToMinutes(day.lunchStart);
    const le = timeToMinutes(day.lunchEnd);
    if (nowMin >= ls && nowMin < le) {
      return { code: 'lunch', label: `Em almoço até ${day.lunchEnd}` };
    }
  }
  return { code: 'working', label: 'Em serviço' };
}

export interface BirthdayMatch {
  employee: Employee;
  dateThisYear: Date;
  dayOfWeekLabel: string;
  dateFormatted: string;
  isToday: boolean;
  daysFromToday: number;
  turningAge: number;
}

export function getBirthdayInfoForWeek(employees: Employee[], now = new Date()): BirthdayMatch[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const matches: BirthdayMatch[] = [];

  for (const emp of employees) {
    if (!emp.active || !emp.birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(emp.birthDate)) continue;
    const [birthYear, birthMonth, birthDay] = emp.birthDate.split('-').map(Number);

    for (const year of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      const effectiveDay = birthMonth === 2 && birthDay === 29 && !isLeap ? 28 : birthDay;
      const bDate = new Date(year, birthMonth - 1, effectiveDay);

      if (bDate >= sunday && bDate <= saturday) {
        const diffDays = Math.round((bDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        matches.push({
          employee: emp,
          dateThisYear: bDate,
          dayOfWeekLabel: diffDays === 0 ? 'Hoje' : dayNames[bDate.getDay()],
          dateFormatted: `${String(birthDay).padStart(2, '0')}/${String(birthMonth).padStart(2, '0')}`,
          isToday: diffDays === 0,
          daysFromToday: diffDays,
          turningAge: year - birthYear,
        });
        break;
      }
    }
  }

  return matches.sort((a, b) => a.dateThisYear.getTime() - b.dateThisYear.getTime());
}

export function getNextBirthdayDate(birthDate: string, now = new Date()): {
  nextDate: Date;
  daysUntil: number;
  turningAge: number;
  dateFormatted: string;
} {
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let targetYear = today.getFullYear();

  const makeDate = (yr: number) => {
    const isLeap = (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0;
    const d = birthMonth === 2 && birthDay === 29 && !isLeap ? 28 : birthDay;
    return new Date(yr, birthMonth - 1, d);
  };

  let next = makeDate(targetYear);
  if (next < today) {
    targetYear += 1;
    next = makeDate(targetYear);
  }
  const daysUntil = Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return {
    nextDate: next,
    daysUntil,
    turningAge: targetYear - birthYear,
    dateFormatted: `${String(birthDay).padStart(2, '0')}/${String(birthMonth).padStart(2, '0')}`,
  };
}

export function formatIsoDateBr(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function computeOvertimeBalanceByEmployee(entries: OvertimeEntry[]): Record<string, {
  balanceMinutes: number;
  totalExtraMinutes: number;
  totalDeductedMinutes: number;
  entryCount: number;
}> {
  const acc: Record<
    string,
    {
      balanceMinutes: number;
      totalExtraMinutes: number;
      totalDeductedMinutes: number;
      entryCount: number;
    }
  > = {};

  for (const entry of entries) {
    if (!acc[entry.employeeId]) {
      acc[entry.employeeId] = {
        balanceMinutes: 0,
        totalExtraMinutes: 0,
        totalDeductedMinutes: 0,
        entryCount: 0,
      };
    }
    const bucket = acc[entry.employeeId];
    bucket.entryCount += 1;
    if (entry.type === 'extra') {
      bucket.totalExtraMinutes += entry.minutes;
      bucket.balanceMinutes += entry.minutes;
    } else {
      bucket.totalDeductedMinutes += entry.minutes;
      bucket.balanceMinutes -= entry.minutes;
    }
  }
  return acc;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
