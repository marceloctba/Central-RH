import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  DayKey,
  Employee,
  OvertimeEntry,
  OvertimeType,
  Reminder,
  Store,
  TimeOffEntry,
  TimeOffReason,
  WeeklySchedule,
} from '../types';
import { DAY_ORDER } from '../utils/schedule';

function truncateUtf8(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(value).length <= maxBytes) return value;
  let end = Math.min(value.length, maxBytes);
  while (end > 0 && encoder.encode(value.slice(0, end)).length > maxBytes) {
    end -= 1;
  }
  return value.slice(0, end);
}

function normalizeEmail(email: string): string {
  return truncateUtf8(email.trim().toLowerCase(), 120);
}

async function commitInChunks(
  ops: ((batch: ReturnType<typeof writeBatch>) => void)[],
  chunkSize = 15,
): Promise<void> {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = writeBatch(db);
    const slice = ops.slice(i, i + chunkSize);
    for (const apply of slice) {
      apply(batch);
    }
    await batch.commit();
  }
}

function sanitizeSchedule(schedule: WeeklySchedule): WeeklySchedule {
  const clean = {} as WeeklySchedule;
  for (const key of DAY_ORDER) {
    const day = schedule[key];
    clean[key as DayKey] = {
      working: Boolean(day.working),
      startTime: /^\d{2}:\d{2}$/.test(day.startTime) ? day.startTime : '08:00',
      endTime: /^\d{2}:\d{2}$/.test(day.endTime) ? day.endTime : '17:00',
      hasLunch: Boolean(day.hasLunch),
      lunchStart: day.hasLunch && /^\d{2}:\d{2}$/.test(day.lunchStart) ? day.lunchStart : '',
      lunchEnd: day.hasLunch && /^\d{2}:\d{2}$/.test(day.lunchEnd) ? day.lunchEnd : '',
    };
  }
  return clean;
}

function computeManagerEmails(employeesOfStore: Employee[]): string[] {
  const set = new Set<string>();
  for (const emp of employeesOfStore) {
    if (emp.active && emp.isManager && emp.email) {
      const normalized = normalizeEmail(emp.email);
      if (normalized) set.add(normalized);
    }
  }
  return Array.from(set).slice(0, 20);
}

function sameStringList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

function mapStoreDoc(id: string, data: Record<string, unknown>): Store {
  return {
    id,
    ownerId: String(data.ownerId ?? ''),
    ownerEmail: String(data.ownerEmail ?? ''),
    name: String(data.name ?? ''),
    managerEmails: Array.isArray(data.managerEmails)
      ? data.managerEmails.map((v) => String(v))
      : [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapEmployeeDoc(id: string, data: Record<string, unknown>): Employee {
  return {
    id,
    storeId: String(data.storeId ?? ''),
    storeName: String(data.storeName ?? ''),
    ownerId: String(data.ownerId ?? ''),
    managerEmails: Array.isArray(data.managerEmails)
      ? data.managerEmails.map((v) => String(v))
      : [],
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    role: String(data.role ?? ''),
    isManager: Boolean(data.isManager),
    birthDate: String(data.birthDate ?? ''),
    photoDataUrl: String(data.photoDataUrl ?? ''),
    active: Boolean(data.active),
    schedule: data.schedule as WeeklySchedule,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapOvertimeDoc(id: string, data: Record<string, unknown>): OvertimeEntry {
  return {
    id,
    storeId: String(data.storeId ?? ''),
    ownerId: String(data.ownerId ?? ''),
    managerEmails: Array.isArray(data.managerEmails)
      ? data.managerEmails.map((v) => String(v))
      : [],
    employeeId: String(data.employeeId ?? ''),
    employeeEmail: String(data.employeeEmail ?? ''),
    createdByEmail: String(data.createdByEmail ?? ''),
    date: String(data.date ?? ''),
    type: (data.type as OvertimeType) ?? 'extra',
    minutes: Number(data.minutes ?? 0),
    note: String(data.note ?? ''),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapTimeOffDoc(id: string, data: Record<string, unknown>): TimeOffEntry {
  return {
    id,
    storeId: String(data.storeId ?? ''),
    storeName: String(data.storeName ?? ''),
    ownerId: String(data.ownerId ?? ''),
    managerEmails: Array.isArray(data.managerEmails)
      ? data.managerEmails.map((v) => String(v))
      : [],
    employeeId: String(data.employeeId ?? ''),
    employeeName: String(data.employeeName ?? ''),
    employeeEmail: String(data.employeeEmail ?? ''),
    startDate: String(data.startDate ?? ''),
    endDate: String(data.endDate ?? ''),
    reason: (data.reason as TimeOffReason) ?? 'outros',
    deductFromBank: Boolean(data.deductFromBank),
    deductedMinutes: Number(data.deductedMinutes ?? 0),
    linkedOvertimeEntryId: String(data.linkedOvertimeEntryId ?? ''),
    note: String(data.note ?? ''),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapReminderDoc(id: string, data: Record<string, unknown>): Reminder {
  return {
    id,
    storeId: String(data.storeId ?? ''),
    storeName: String(data.storeName ?? ''),
    ownerId: String(data.ownerId ?? ''),
    managerEmails: Array.isArray(data.managerEmails)
      ? data.managerEmails.map((v) => String(v))
      : [],
    date: String(data.date ?? ''),
    time: String(data.time ?? ''),
    title: String(data.title ?? ''),
    note: String(data.note ?? ''),
    done: Boolean(data.done),
    createdByEmail: String(data.createdByEmail ?? ''),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function subscribeUserStores(
  userId: string,
  userEmail: string,
  onData: (stores: Store[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const email = normalizeEmail(userEmail);
  const ownedMap = new Map<string, Store>();
  const managedMap = new Map<string, Store>();
  let ownedReady = false;
  let managedReady = !email;

  const emit = () => {
    if (!ownedReady || !managedReady) return;
    const merged = new Map<string, Store>();
    for (const [k, v] of ownedMap) merged.set(k, v);
    for (const [k, v] of managedMap) merged.set(k, v);
    const list = Array.from(merged.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
    onData(list);
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      query(collection(db, 'stores'), where('ownerId', '==', userId)),
      (snap) => {
        ownedMap.clear();
        snap.docs.forEach((d) => ownedMap.set(d.id, mapStoreDoc(d.id, d.data())));
        ownedReady = true;
        emit();
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, 'stores');
      },
    ),
  );

  if (email) {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'stores'), where('managerEmails', 'array-contains', email)),
        (snap) => {
          managedMap.clear();
          snap.docs.forEach((d) => managedMap.set(d.id, mapStoreDoc(d.id, d.data())));
          managedReady = true;
          emit();
        },
        (error) => {
          if (onError) onError(error);
          handleFirestoreError(error, OperationType.LIST, 'stores');
        },
      ),
    );
  }

  return () => unsubs.forEach((u) => u());
}

export function subscribeUserEmployees(
  userId: string,
  userEmail: string,
  onData: (employees: Employee[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const email = normalizeEmail(userEmail);
  const ownedMap = new Map<string, Employee>();
  const managedMap = new Map<string, Employee>();
  const selfMap = new Map<string, Employee>();

  let ownedReady = false;
  let managedReady = !email;
  let selfReady = !email;

  const emit = () => {
    if (!ownedReady || !managedReady || !selfReady) return;
    const merged = new Map<string, Employee>();
    for (const [k, v] of ownedMap) merged.set(k, v);
    for (const [k, v] of managedMap) merged.set(k, v);
    for (const [k, v] of selfMap) merged.set(k, v);
    const list = Array.from(merged.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
    onData(list);
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      query(collection(db, 'employees'), where('ownerId', '==', userId)),
      (snap) => {
        ownedMap.clear();
        snap.docs.forEach((d) => ownedMap.set(d.id, mapEmployeeDoc(d.id, d.data())));
        ownedReady = true;
        emit();
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, 'employees');
      },
    ),
  );

  if (email) {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'employees'), where('managerEmails', 'array-contains', email)),
        (snap) => {
          managedMap.clear();
          snap.docs.forEach((d) => managedMap.set(d.id, mapEmployeeDoc(d.id, d.data())));
          managedReady = true;
          emit();
        },
        (error) => {
          if (onError) onError(error);
          handleFirestoreError(error, OperationType.LIST, 'employees');
        },
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'employees'), where('email', '==', email)),
        (snap) => {
          selfMap.clear();
          snap.docs.forEach((d) => selfMap.set(d.id, mapEmployeeDoc(d.id, d.data())));
          selfReady = true;
          emit();
        },
        (error) => {
          if (onError) onError(error);
          handleFirestoreError(error, OperationType.LIST, 'employees');
        },
      ),
    );
  }

  return () => unsubs.forEach((u) => u());
}

export function subscribeUserOvertimeEntries(
  userId: string,
  userEmail: string,
  onData: (entries: OvertimeEntry[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const email = normalizeEmail(userEmail);
  const ownedMap = new Map<string, OvertimeEntry>();
  const managedMap = new Map<string, OvertimeEntry>();
  const selfMap = new Map<string, OvertimeEntry>();

  let ownedReady = false;
  let managedReady = !email;
  let selfReady = !email;

  const emit = () => {
    if (!ownedReady || !managedReady || !selfReady) return;
    const merged = new Map<string, OvertimeEntry>();
    for (const [k, v] of ownedMap) merged.set(k, v);
    for (const [k, v] of managedMap) merged.set(k, v);
    for (const [k, v] of selfMap) merged.set(k, v);
    const list = Array.from(merged.values()).sort((a, b) => b.date.localeCompare(a.date));
    onData(list);
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      query(collection(db, 'overtimeEntries'), where('ownerId', '==', userId)),
      (snap) => {
        ownedMap.clear();
        snap.docs.forEach((d) => ownedMap.set(d.id, mapOvertimeDoc(d.id, d.data())));
        ownedReady = true;
        emit();
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, 'overtimeEntries');
      },
    ),
  );

  if (email) {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'overtimeEntries'), where('managerEmails', 'array-contains', email)),
        (snap) => {
          managedMap.clear();
          snap.docs.forEach((d) => managedMap.set(d.id, mapOvertimeDoc(d.id, d.data())));
          managedReady = true;
          emit();
        },
        (error) => {
          if (onError) onError(error);
          handleFirestoreError(error, OperationType.LIST, 'overtimeEntries');
        },
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'overtimeEntries'), where('employeeEmail', '==', email)),
        (snap) => {
          selfMap.clear();
          snap.docs.forEach((d) => selfMap.set(d.id, mapOvertimeDoc(d.id, d.data())));
          selfReady = true;
          emit();
        },
        (error) => {
          if (onError) onError(error);
          handleFirestoreError(error, OperationType.LIST, 'overtimeEntries');
        },
      ),
    );
  }

  return () => unsubs.forEach((u) => u());
}

export function subscribeUserTimeOffs(
  userId: string,
  userEmail: string,
  onData: (entries: TimeOffEntry[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const email = normalizeEmail(userEmail);
  const ownedMap = new Map<string, TimeOffEntry>();
  const managedMap = new Map<string, TimeOffEntry>();
  const selfMap = new Map<string, TimeOffEntry>();

  let ownedReady = false;
  let managedReady = !email;
  let selfReady = !email;

  const emit = () => {
    if (!ownedReady || !managedReady || !selfReady) return;
    const merged = new Map<string, TimeOffEntry>();
    for (const [k, v] of ownedMap) merged.set(k, v);
    for (const [k, v] of managedMap) merged.set(k, v);
    for (const [k, v] of selfMap) merged.set(k, v);
    const list = Array.from(merged.values()).sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    onData(list);
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      query(collection(db, 'timeOffs'), where('ownerId', '==', userId)),
      (snap) => {
        ownedMap.clear();
        snap.docs.forEach((d) => ownedMap.set(d.id, mapTimeOffDoc(d.id, d.data())));
        ownedReady = true;
        emit();
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, 'timeOffs');
      },
    ),
  );

  if (email) {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'timeOffs'), where('managerEmails', 'array-contains', email)),
        (snap) => {
          managedMap.clear();
          snap.docs.forEach((d) => managedMap.set(d.id, mapTimeOffDoc(d.id, d.data())));
          managedReady = true;
          emit();
        },
        (error) => {
          if (onError) onError(error);
          handleFirestoreError(error, OperationType.LIST, 'timeOffs');
        },
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'timeOffs'), where('employeeEmail', '==', email)),
        (snap) => {
          selfMap.clear();
          snap.docs.forEach((d) => selfMap.set(d.id, mapTimeOffDoc(d.id, d.data())));
          selfReady = true;
          emit();
        },
        (error) => {
          if (onError) onError(error);
          handleFirestoreError(error, OperationType.LIST, 'timeOffs');
        },
      ),
    );
  }

  return () => unsubs.forEach((u) => u());
}

export function subscribeUserReminders(
  userId: string,
  userEmail: string,
  onData: (reminders: Reminder[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const email = normalizeEmail(userEmail);
  const ownedMap = new Map<string, Reminder>();
  const managedMap = new Map<string, Reminder>();

  let ownedReady = false;
  let managedReady = !email;

  const emit = () => {
    if (!ownedReady || !managedReady) return;
    const merged = new Map<string, Reminder>();
    for (const [k, v] of ownedMap) merged.set(k, v);
    for (const [k, v] of managedMap) merged.set(k, v);
    const list = Array.from(merged.values()).sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      const timeCmp = (a.time || '99:99').localeCompare(b.time || '99:99');
      if (timeCmp !== 0) return timeCmp;
      return a.title.localeCompare(b.title, 'pt-BR');
    });
    onData(list);
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      query(collection(db, 'reminders'), where('ownerId', '==', userId)),
      (snap) => {
        ownedMap.clear();
        snap.docs.forEach((d) => ownedMap.set(d.id, mapReminderDoc(d.id, d.data())));
        ownedReady = true;
        emit();
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, 'reminders');
      },
    ),
  );

  if (email) {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'reminders'), where('managerEmails', 'array-contains', email)),
        (snap) => {
          managedMap.clear();
          snap.docs.forEach((d) => managedMap.set(d.id, mapReminderDoc(d.id, d.data())));
          managedReady = true;
          emit();
        },
        (error) => {
          if (onError) onError(error);
          handleFirestoreError(error, OperationType.LIST, 'reminders');
        },
      ),
    );
  }

  return () => unsubs.forEach((u) => u());
}

export async function createStore(
  ownerId: string,
  ownerEmail: string,
  name: string,
): Promise<Store> {
  const ref = doc(collection(db, 'stores'));
  const path = `stores/${ref.id}`;
  const cleanName = truncateUtf8(name.trim(), 80);
  const cleanEmail = normalizeEmail(ownerEmail);
  try {
    await setDoc(ref, {
      ownerId,
      ownerEmail: cleanEmail,
      name: cleanName,
      managerEmails: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      id: ref.id,
      ownerId,
      ownerEmail: cleanEmail,
      name: cleanName,
      managerEmails: [],
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function renameStore(
  store: Store,
  newName: string,
  storeEmployees: Employee[],
  storeTimeOffs: TimeOffEntry[] = [],
  storeReminders: Reminder[] = [],
): Promise<void> {
  const path = `stores/${store.id}`;
  const cleanName = truncateUtf8(newName.trim(), 80);
  try {
    const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [
      (batch) =>
        batch.update(doc(db, 'stores', store.id), {
          name: cleanName,
          updatedAt: serverTimestamp(),
        }),
    ];
    for (const emp of storeEmployees) {
      ops.push((batch) =>
        batch.update(doc(db, 'employees', emp.id), {
          storeName: cleanName,
          updatedAt: serverTimestamp(),
        }),
      );
    }
    for (const to of storeTimeOffs) {
      ops.push((batch) =>
        batch.update(doc(db, 'timeOffs', to.id), {
          storeName: cleanName,
          updatedAt: serverTimestamp(),
        }),
      );
    }
    for (const rem of storeReminders) {
      ops.push((batch) =>
        batch.update(doc(db, 'reminders', rem.id), {
          storeName: cleanName,
          updatedAt: serverTimestamp(),
        }),
      );
    }
    await commitInChunks(ops);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStoreCascade(
  storeId: string,
  storeEmployees: Employee[],
  storeEntries: OvertimeEntry[],
  storeTimeOffs: TimeOffEntry[] = [],
  storeReminders: Reminder[] = [],
): Promise<void> {
  const path = `stores/${storeId}`;
  try {
    const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
    for (const rem of storeReminders) {
      ops.push((batch) => batch.delete(doc(db, 'reminders', rem.id)));
    }
    for (const to of storeTimeOffs) {
      ops.push((batch) => batch.delete(doc(db, 'timeOffs', to.id)));
    }
    for (const entry of storeEntries) {
      ops.push((batch) => batch.delete(doc(db, 'overtimeEntries', entry.id)));
    }
    for (const emp of storeEmployees) {
      ops.push((batch) => batch.delete(doc(db, 'employees', emp.id)));
    }
    ops.push((batch) => batch.delete(doc(db, 'stores', storeId)));
    await commitInChunks(ops);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface EmployeeInput {
  name: string;
  email: string;
  role: string;
  isManager: boolean;
  birthDate: string;
  photoDataUrl: string;
  active: boolean;
  schedule: WeeklySchedule;
}

export async function createEmployeeForStore(
  store: Store,
  storeEmployees: Employee[],
  storeEntries: OvertimeEntry[],
  input: EmployeeInput,
  storeTimeOffs: TimeOffEntry[] = [],
  storeReminders: Reminder[] = [],
): Promise<string> {
  const ref = doc(collection(db, 'employees'));
  const path = `employees/${ref.id}`;
  const cleanEmail = normalizeEmail(input.email);
  const cleanStoreName = truncateUtf8(store.name.trim(), 80);

  const syntheticNewEmp: Employee = {
    id: ref.id,
    storeId: store.id,
    storeName: cleanStoreName,
    ownerId: store.ownerId,
    managerEmails: store.managerEmails,
    name: truncateUtf8(input.name.trim(), 100),
    email: cleanEmail,
    role: truncateUtf8(input.role.trim(), 80),
    isManager: Boolean(input.isManager),
    birthDate: input.birthDate,
    photoDataUrl: input.photoDataUrl.slice(0, 200000),
    active: Boolean(input.active),
    schedule: sanitizeSchedule(input.schedule),
  };

  const nextManagerEmails = computeManagerEmails([...storeEmployees, syntheticNewEmp]);
  const managersChanged = !sameStringList(store.managerEmails, nextManagerEmails);

  const payload = {
    storeId: store.id,
    storeName: cleanStoreName,
    ownerId: store.ownerId,
    managerEmails: nextManagerEmails,
    name: syntheticNewEmp.name,
    email: cleanEmail,
    role: syntheticNewEmp.role,
    isManager: syntheticNewEmp.isManager,
    birthDate: syntheticNewEmp.birthDate,
    photoDataUrl: syntheticNewEmp.photoDataUrl,
    active: syntheticNewEmp.active,
    schedule: syntheticNewEmp.schedule,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  let phase = 'init';
  try {
    if (!managersChanged) {
      phase = 'setDoc';
      await setDoc(ref, payload);
      return ref.id;
    }

    phase = 'primaryBatch';
    const primaryBatch = writeBatch(db);
    primaryBatch.set(ref, payload);
    primaryBatch.update(doc(db, 'stores', store.id), {
      managerEmails: nextManagerEmails,
      updatedAt: serverTimestamp(),
    });
    await primaryBatch.commit();

    phase = 'syncOps';
    const syncOps: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
    for (const emp of storeEmployees) {
      syncOps.push((batch) =>
        batch.update(doc(db, 'employees', emp.id), {
          managerEmails: nextManagerEmails,
          storeName: cleanStoreName,
          updatedAt: serverTimestamp(),
        }),
      );
    }
    for (const entry of storeEntries) {
      syncOps.push((batch) =>
        batch.update(doc(db, 'overtimeEntries', entry.id), {
          managerEmails: nextManagerEmails,
          employeeEmail: entry.employeeEmail,
          createdByEmail: entry.createdByEmail || '',
          updatedAt: serverTimestamp(),
        }),
      );
    }
    for (const to of storeTimeOffs) {
      syncOps.push((batch) =>
        batch.update(doc(db, 'timeOffs', to.id), {
          managerEmails: nextManagerEmails,
          storeName: cleanStoreName,
          employeeEmail: to.employeeEmail,
          employeeName: truncateUtf8(to.employeeName, 100),
          updatedAt: serverTimestamp(),
        }),
      );
    }
    for (const rem of storeReminders) {
      syncOps.push((batch) =>
        batch.update(doc(db, 'reminders', rem.id), {
          managerEmails: nextManagerEmails,
          storeName: cleanStoreName,
          updatedAt: serverTimestamp(),
        }),
      );
    }
    if (syncOps.length > 0) {
      await commitInChunks(syncOps);
    }
    return ref.id;
  } catch (error) {
    let storeDiag = 'unchecked';
    try {
      const storeSnap = await getDocFromServer(doc(db, 'stores', store.id));
      if (!storeSnap.exists()) {
        storeDiag = 'missing';
      } else {
        const sData = storeSnap.data();
        storeDiag = `exists(ownerMatch=${sData.ownerId === store.ownerId},ownerEmailLen=${String(sData.ownerEmail || '').length},hasCreatedAt=${Boolean(sData.createdAt)},mgrLen=${Array.isArray(sData.managerEmails) ? sData.managerEmails.length : -1})`;
      }
    } catch (readErr) {
      storeDiag = `readErr:${readErr instanceof Error ? readErr.message : String(readErr)}`;
    }
    const enc = new TextEncoder();
    const schedOk = DAY_ORDER.every((k) => {
      const d = syntheticNewEmp.schedule[k];
      return (
        typeof d.working === 'boolean' &&
        typeof d.hasLunch === 'boolean' &&
        d.startTime.length === 5 &&
        d.endTime.length === 5 &&
        d.lunchStart.length <= 5 &&
        d.lunchEnd.length <= 5
      );
    });
    const diag = `phase=${phase};mgrChg=${managersChanged};empCount=${storeEmployees.length};ownerEqUid=${store.ownerId === auth.currentUser?.uid};storeIdOk=${/^[a-zA-Z0-9_-]+$/.test(store.id)};birthOk=${/^\d{4}-\d{2}-\d{2}$/.test(syntheticNewEmp.birthDate)};schedOk=${schedOk};photoBytes=${enc.encode(syntheticNewEmp.photoDataUrl).length};nameBytes=${enc.encode(syntheticNewEmp.name).length};roleBytes=${enc.encode(syntheticNewEmp.role).length};storeNameBytes=${enc.encode(cleanStoreName).length};storeSrv=${storeDiag}`;
    const baseMsg = error instanceof Error ? error.message : String(error);
    handleFirestoreError(new Error(`${baseMsg} [${diag}]`), OperationType.CREATE, path);
  }
}

export async function updateEmployeeForStore(
  store: Store,
  employeeId: string,
  storeEmployees: Employee[],
  storeEntries: OvertimeEntry[],
  input: EmployeeInput,
  storeTimeOffs: TimeOffEntry[] = [],
  storeReminders: Reminder[] = [],
): Promise<void> {
  const path = `employees/${employeeId}`;
  const cleanEmail = normalizeEmail(input.email);
  const cleanName = truncateUtf8(input.name.trim(), 100);
  const cleanRole = truncateUtf8(input.role.trim(), 80);
  const cleanStoreName = truncateUtf8(store.name.trim(), 80);
  const existingEmp = storeEmployees.find((e) => e.id === employeeId);
  const emailChanged = existingEmp ? existingEmp.email !== cleanEmail : false;
  const nameChanged = existingEmp ? existingEmp.name !== cleanName : false;

  const updatedList = storeEmployees.map((emp) =>
    emp.id === employeeId
      ? {
          ...emp,
          name: cleanName,
          email: cleanEmail,
          role: cleanRole,
          isManager: Boolean(input.isManager),
          active: Boolean(input.active),
        }
      : emp,
  );
  const nextManagerEmails = computeManagerEmails(updatedList);
  const managersChanged = !sameStringList(store.managerEmails, nextManagerEmails);

  try {
    const primaryBatch = writeBatch(db);
    primaryBatch.update(doc(db, 'employees', employeeId), {
      name: cleanName,
      email: cleanEmail,
      role: cleanRole,
      isManager: Boolean(input.isManager),
      birthDate: input.birthDate,
      photoDataUrl: input.photoDataUrl.slice(0, 200000),
      active: Boolean(input.active),
      schedule: sanitizeSchedule(input.schedule),
      managerEmails: nextManagerEmails,
      storeName: cleanStoreName,
      updatedAt: serverTimestamp(),
    });

    if (managersChanged) {
      primaryBatch.update(doc(db, 'stores', store.id), {
        managerEmails: nextManagerEmails,
        updatedAt: serverTimestamp(),
      });
    }
    await primaryBatch.commit();

    const syncOps: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
    if (managersChanged) {
      for (const emp of storeEmployees) {
        if (emp.id === employeeId) continue;
        syncOps.push((batch) =>
          batch.update(doc(db, 'employees', emp.id), {
            managerEmails: nextManagerEmails,
            storeName: cleanStoreName,
            updatedAt: serverTimestamp(),
          }),
        );
      }
      for (const rem of storeReminders) {
        syncOps.push((batch) =>
          batch.update(doc(db, 'reminders', rem.id), {
            managerEmails: nextManagerEmails,
            storeName: cleanStoreName,
            updatedAt: serverTimestamp(),
          }),
        );
      }
    }

    if (managersChanged || emailChanged) {
      for (const entry of storeEntries) {
        const nextEmpEmail =
          entry.employeeId === employeeId ? cleanEmail : entry.employeeEmail;
        if (managersChanged || entry.employeeId === employeeId) {
          syncOps.push((batch) =>
            batch.update(doc(db, 'overtimeEntries', entry.id), {
              managerEmails: nextManagerEmails,
              employeeEmail: nextEmpEmail,
              createdByEmail: entry.createdByEmail || '',
              updatedAt: serverTimestamp(),
            }),
          );
        }
      }
    }

    if (managersChanged || emailChanged || nameChanged) {
      for (const to of storeTimeOffs) {
        if (managersChanged || to.employeeId === employeeId) {
          syncOps.push((batch) =>
            batch.update(doc(db, 'timeOffs', to.id), {
              managerEmails: nextManagerEmails,
              storeName: cleanStoreName,
              employeeEmail: to.employeeId === employeeId ? cleanEmail : to.employeeEmail,
              employeeName:
                to.employeeId === employeeId ? cleanName : truncateUtf8(to.employeeName, 100),
              updatedAt: serverTimestamp(),
            }),
          );
        }
      }
    }

    if (syncOps.length > 0) {
      await commitInChunks(syncOps);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteEmployeeAndSyncStore(
  store: Store,
  employeeId: string,
  storeEmployees: Employee[],
  storeEntries: OvertimeEntry[],
  storeTimeOffs: TimeOffEntry[] = [],
  storeReminders: Reminder[] = [],
): Promise<void> {
  const path = `employees/${employeeId}`;
  const cleanStoreName = truncateUtf8(store.name.trim(), 80);
  const remainingEmployees = storeEmployees.filter((e) => e.id !== employeeId);
  const nextManagerEmails = computeManagerEmails(remainingEmployees);
  const managersChanged = !sameStringList(store.managerEmails, nextManagerEmails);

  try {
    const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [
      (batch) => batch.delete(doc(db, 'employees', employeeId)),
    ];

    if (managersChanged) {
      ops.push((batch) =>
        batch.update(doc(db, 'stores', store.id), {
          managerEmails: nextManagerEmails,
          updatedAt: serverTimestamp(),
        }),
      );
      for (const emp of remainingEmployees) {
        ops.push((batch) =>
          batch.update(doc(db, 'employees', emp.id), {
            managerEmails: nextManagerEmails,
            storeName: cleanStoreName,
            updatedAt: serverTimestamp(),
          }),
        );
      }
      for (const rem of storeReminders) {
        ops.push((batch) =>
          batch.update(doc(db, 'reminders', rem.id), {
            managerEmails: nextManagerEmails,
            storeName: cleanStoreName,
            updatedAt: serverTimestamp(),
          }),
        );
      }
    }

    for (const entry of storeEntries) {
      if (entry.employeeId === employeeId) {
        ops.push((batch) => batch.delete(doc(db, 'overtimeEntries', entry.id)));
      } else if (managersChanged) {
        ops.push((batch) =>
          batch.update(doc(db, 'overtimeEntries', entry.id), {
            managerEmails: nextManagerEmails,
            employeeEmail: entry.employeeEmail,
            createdByEmail: entry.createdByEmail || '',
            updatedAt: serverTimestamp(),
          }),
        );
      }
    }

    for (const to of storeTimeOffs) {
      if (to.employeeId === employeeId) {
        ops.push((batch) => batch.delete(doc(db, 'timeOffs', to.id)));
      } else if (managersChanged) {
        ops.push((batch) =>
          batch.update(doc(db, 'timeOffs', to.id), {
            managerEmails: nextManagerEmails,
            storeName: cleanStoreName,
            employeeEmail: to.employeeEmail,
            employeeName: truncateUtf8(to.employeeName, 100),
            updatedAt: serverTimestamp(),
          }),
        );
      }
    }

    await commitInChunks(ops);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface OvertimeInput {
  employeeId: string;
  date: string;
  type: OvertimeType;
  minutes: number;
  note: string;
}

export async function createOvertimeEntryForStore(
  store: Store,
  employee: Employee,
  actorEmail: string,
  input: OvertimeInput,
): Promise<string> {
  const ref = doc(collection(db, 'overtimeEntries'));
  const path = `overtimeEntries/${ref.id}`;
  const clampedMinutes = Math.max(1, Math.min(1440, Math.round(input.minutes)));
  try {
    await setDoc(ref, {
      storeId: store.id,
      ownerId: store.ownerId,
      managerEmails: store.managerEmails,
      employeeId: employee.id,
      employeeEmail: normalizeEmail(employee.email),
      createdByEmail: normalizeEmail(actorEmail),
      date: input.date,
      type: input.type,
      minutes: clampedMinutes,
      note: truncateUtf8(input.note.trim(), 300),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createSelfOvertimeEntry(
  employee: Employee,
  actorEmail: string,
  input: Omit<OvertimeInput, 'employeeId'>,
): Promise<string> {
  const ref = doc(collection(db, 'overtimeEntries'));
  const path = `overtimeEntries/${ref.id}`;
  const clampedMinutes = Math.max(1, Math.min(1440, Math.round(input.minutes)));
  const normalizedActor = normalizeEmail(actorEmail);
  try {
    await setDoc(ref, {
      storeId: employee.storeId,
      ownerId: employee.ownerId,
      managerEmails: employee.managerEmails,
      employeeId: employee.id,
      employeeEmail: normalizedActor,
      createdByEmail: normalizedActor,
      date: input.date,
      type: input.type,
      minutes: clampedMinutes,
      note: truncateUtf8(input.note.trim(), 300),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteOvertimeEntry(entryId: string): Promise<void> {
  const path = `overtimeEntries/${entryId}`;
  try {
    await deleteDoc(doc(db, 'overtimeEntries', entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface TimeOffInput {
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: TimeOffReason;
  deductFromBank: boolean;
  deductedMinutes: number;
  note: string;
}

export async function createTimeOffForStore(
  store: Store,
  employee: Employee,
  actorEmail: string,
  input: TimeOffInput,
): Promise<string> {
  const toRef = doc(collection(db, 'timeOffs'));
  const path = `timeOffs/${toRef.id}`;
  const shouldDeduct = Boolean(input.deductFromBank) && input.deductedMinutes > 0;
  const clampedMinutes = shouldDeduct
    ? Math.max(1, Math.min(1440, Math.round(input.deductedMinutes)))
    : 0;

  try {
    const batch = writeBatch(db);
    let linkedOvertimeEntryId = '';

    if (shouldDeduct && clampedMinutes > 0) {
      const otRef = doc(collection(db, 'overtimeEntries'));
      linkedOvertimeEntryId = otRef.id;
      const reasonSuffix =
        input.reason === 'banco_horas'
          ? 'Folga agendada (banco de horas)'
          : 'Ausência agendada (desconto banco)';
      const otNote = input.note.trim()
        ? truncateUtf8(`${reasonSuffix}: ${input.note.trim()}`, 300)
        : reasonSuffix;

      batch.set(otRef, {
        storeId: store.id,
        ownerId: store.ownerId,
        managerEmails: store.managerEmails,
        employeeId: employee.id,
        employeeEmail: normalizeEmail(employee.email),
        createdByEmail: normalizeEmail(actorEmail),
        date: input.startDate,
        type: 'compensacao',
        minutes: clampedMinutes,
        note: otNote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(toRef, {
      storeId: store.id,
      storeName: truncateUtf8(store.name.trim(), 80),
      ownerId: store.ownerId,
      managerEmails: store.managerEmails,
      employeeId: employee.id,
      employeeName: truncateUtf8(employee.name, 100),
      employeeEmail: normalizeEmail(employee.email),
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      deductFromBank: shouldDeduct,
      deductedMinutes: clampedMinutes,
      linkedOvertimeEntryId,
      note: truncateUtf8(input.note.trim(), 300),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return toRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteTimeOffAndSync(timeOff: TimeOffEntry): Promise<void> {
  const path = `timeOffs/${timeOff.id}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'timeOffs', timeOff.id));
    if (timeOff.linkedOvertimeEntryId) {
      batch.delete(doc(db, 'overtimeEntries', timeOff.linkedOvertimeEntryId));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface ReminderInput {
  date: string;
  time: string;
  title: string;
  note: string;
  done?: boolean;
}

export async function createReminderForStore(
  store: Store,
  actorEmail: string,
  input: ReminderInput,
): Promise<string> {
  const ref = doc(collection(db, 'reminders'));
  const path = `reminders/${ref.id}`;
  const cleanTime = /^\d{2}:\d{2}$/.test(input.time) ? input.time : '';
  try {
    await setDoc(ref, {
      storeId: store.id,
      storeName: truncateUtf8(store.name.trim(), 80),
      ownerId: store.ownerId,
      managerEmails: store.managerEmails,
      date: input.date,
      time: cleanTime,
      title: truncateUtf8(input.title.trim(), 140),
      note: truncateUtf8(input.note.trim(), 300),
      done: Boolean(input.done),
      createdByEmail: normalizeEmail(actorEmail),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateReminderForStore(
  reminderId: string,
  input: ReminderInput,
): Promise<void> {
  const path = `reminders/${reminderId}`;
  const cleanTime = /^\d{2}:\d{2}$/.test(input.time) ? input.time : '';
  try {
    await updateDoc(doc(db, 'reminders', reminderId), {
      date: input.date,
      time: cleanTime,
      title: truncateUtf8(input.title.trim(), 140),
      note: truncateUtf8(input.note.trim(), 300),
      done: Boolean(input.done),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleReminderDone(reminderId: string, done: boolean): Promise<void> {
  const path = `reminders/${reminderId}`;
  try {
    await updateDoc(doc(db, 'reminders', reminderId), {
      done,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteReminder(reminderId: string): Promise<void> {
  const path = `reminders/${reminderId}`;
  try {
    await deleteDoc(doc(db, 'reminders', reminderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
