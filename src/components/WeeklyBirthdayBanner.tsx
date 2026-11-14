import { Cake, ChevronRight } from 'lucide-react';
import type { BirthdayMatch } from '../utils/schedule';
import { EmployeeAvatar } from './EmployeeAvatar';

interface WeeklyBirthdayBannerProps {
  matches: BirthdayMatch[];
  onOpenBirthdays: () => void;
}

export function WeeklyBirthdayBanner({ matches, onOpenBirthdays }: WeeklyBirthdayBannerProps) {
  if (matches.length === 0) return null;

  return (
    <section
      aria-label="Lembrete de aniversariantes da semana"
      className="no-print mb-6 bg-amber-50/90 border border-amber-200 rounded-xl px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      <div className="flex items-start sm:items-center gap-3.5">
        <div className="h-9 w-9 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
          <Cake className="w-4.5 h-4.5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-950">
            {matches.length === 1
              ? '1 aniversariante nesta semana'
              : `${matches.length} aniversariantes nesta semana`}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {matches.map((m) => (
              <div key={m.employee.id} className="inline-flex items-center gap-2 text-xs text-amber-900">
                <EmployeeAvatar
                  name={m.employee.name}
                  photoDataUrl={m.employee.photoDataUrl}
                  size="sm"
                  className="h-6 w-6 text-[10px]"
                />
                <span className="font-medium">{m.employee.name}</span>
                <span aria-hidden="true" className="text-amber-400">
                  ·
                </span>
                <span className="font-mono tabular-nums">
                  {m.dayOfWeekLabel} ({m.dateFormatted})
                </span>
                {m.isToday && (
                  <span className="font-semibold text-amber-950 underline decoration-amber-400 underline-offset-2">
                    Aniversário hoje
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenBirthdays}
        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:text-amber-950 whitespace-nowrap shrink-0 cursor-pointer"
      >
        Ver calendário
        <ChevronRight className="w-4 h-4" />
      </button>
    </section>
  );
}
