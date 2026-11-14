import {
  createEmployeeForStore,
  createOvertimeEntryForStore,
} from '../services/storeService';
import type { Employee, OvertimeEntry, Store, WeeklySchedule } from '../types';
import { getTodayIsoDate } from './schedule';

function makeShift(
  working: boolean,
  startTime = '08:00',
  endTime = '17:00',
  hasLunch = true,
  lunchStart = '12:00',
  lunchEnd = '13:00',
) {
  return { working, startTime, endTime, hasLunch, lunchStart, lunchEnd };
}

export async function seedSampleStoreTeam(
  store: Store,
  actorEmail: string,
  currentEmployees: Employee[],
  currentEntries: OvertimeEntry[],
): Promise<void> {
  const now = new Date();
  const bdayToday = `1996-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const twoDaysLater = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  const bdaySoon = `1999-${String(twoDaysLater.getMonth() + 1).padStart(2, '0')}-${String(twoDaysLater.getDate()).padStart(2, '0')}`;

  const samples: {
    name: string;
    email: string;
    role: string;
    isManager: boolean;
    birthDate: string;
    schedule: WeeklySchedule;
    extraMinutes?: number;
    extraNote?: string;
  }[] = [
    {
      name: 'Camila Ferreira',
      email: '',
      role: 'Subgerente',
      isManager: false,
      birthDate: bdayToday,
      schedule: {
        mon: makeShift(true, '08:00', '17:00', true, '12:00', '13:00'),
        tue: makeShift(true, '08:00', '17:00', true, '12:00', '13:00'),
        wed: makeShift(true, '08:00', '17:00', true, '12:00', '13:00'),
        thu: makeShift(true, '08:00', '17:00', true, '12:00', '13:00'),
        fri: makeShift(true, '08:00', '17:00', true, '12:00', '13:00'),
        sat: makeShift(true, '09:00', '13:00', false, '', ''),
        sun: makeShift(false),
      },
      extraMinutes: 150,
      extraNote: 'Fechamento de inventário mensal',
    },
    {
      name: 'Rafael Mendes',
      email: '',
      role: 'Caixa',
      isManager: false,
      birthDate: bdaySoon,
      schedule: {
        mon: makeShift(true, '09:00', '18:00', true, '13:00', '14:00'),
        tue: makeShift(true, '09:00', '18:00', true, '13:00', '14:00'),
        wed: makeShift(false),
        thu: makeShift(true, '09:00', '18:00', true, '13:00', '14:00'),
        fri: makeShift(true, '09:00', '18:00', true, '13:00', '14:00'),
        sat: makeShift(true, '09:00', '18:00', true, '13:00', '14:00'),
        sun: makeShift(true, '10:00', '16:00', false, '', ''),
      },
      extraMinutes: 90,
      extraNote: 'Cobertura de turno no caixa principal',
    },
    {
      name: 'Juliana Costa',
      email: '',
      role: 'Vendedor(a)',
      isManager: false,
      birthDate: '1994-04-18',
      schedule: {
        mon: makeShift(true, '10:00', '19:00', true, '14:00', '15:00'),
        tue: makeShift(true, '10:00', '19:00', true, '14:00', '15:00'),
        wed: makeShift(true, '10:00', '19:00', true, '14:00', '15:00'),
        thu: makeShift(false),
        fri: makeShift(true, '10:00', '19:00', true, '14:00', '15:00'),
        sat: makeShift(true, '10:00', '19:00', true, '14:00', '15:00'),
        sun: makeShift(true, '10:00', '16:00', false, '', ''),
      },
      extraMinutes: 60,
      extraNote: 'Organização de vitrine promocional',
    },
    {
      name: 'Bruno Oliveira',
      email: '',
      role: 'Estoquista',
      isManager: false,
      birthDate: '1991-08-22',
      schedule: {
        mon: makeShift(true, '07:00', '16:00', true, '11:30', '12:30'),
        tue: makeShift(true, '07:00', '16:00', true, '11:30', '12:30'),
        wed: makeShift(true, '07:00', '16:00', true, '11:30', '12:30'),
        thu: makeShift(true, '07:00', '16:00', true, '11:30', '12:30'),
        fri: makeShift(true, '07:00', '16:00', true, '11:30', '12:30'),
        sat: makeShift(false),
        sun: makeShift(false),
      },
      extraMinutes: 120,
      extraNote: 'Recebimento de carga antecipada',
    },
    {
      name: 'Larissa Rocha',
      email: '',
      role: 'Atendimento',
      isManager: false,
      birthDate: '2001-01-09',
      schedule: {
        mon: makeShift(false),
        tue: makeShift(true, '12:00', '21:00', true, '16:00', '17:00'),
        wed: makeShift(true, '12:00', '21:00', true, '16:00', '17:00'),
        thu: makeShift(true, '12:00', '21:00', true, '16:00', '17:00'),
        fri: makeShift(true, '12:00', '21:00', true, '16:00', '17:00'),
        sat: makeShift(true, '12:00', '21:00', true, '16:00', '17:00'),
        sun: makeShift(true, '11:00', '17:00', false, '', ''),
      },
    },
  ];

  const todayIso = getTodayIsoDate(now);
  const runningEmployees = [...currentEmployees];

  for (const sample of samples) {
    const id = await createEmployeeForStore(store, runningEmployees, currentEntries, {
      name: sample.name,
      email: sample.email,
      role: sample.role,
      isManager: sample.isManager,
      birthDate: sample.birthDate,
      photoDataUrl: '',
      active: true,
      schedule: sample.schedule,
    });
    const createdEmp: Employee = {
      id,
      storeId: store.id,
      storeName: store.name,
      ownerId: store.ownerId,
      managerEmails: store.managerEmails,
      name: sample.name,
      email: sample.email,
      role: sample.role,
      isManager: sample.isManager,
      birthDate: sample.birthDate,
      photoDataUrl: '',
      active: true,
      schedule: sample.schedule,
    };
    runningEmployees.push(createdEmp);

    if (sample.extraMinutes && sample.extraNote) {
      await createOvertimeEntryForStore(store, createdEmp, actorEmail, {
        employeeId: id,
        date: todayIso,
        type: 'extra',
        minutes: sample.extraMinutes,
        note: sample.extraNote,
      });
    }
  }
}
