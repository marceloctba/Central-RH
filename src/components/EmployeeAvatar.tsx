import { useState } from 'react';
import { getInitials } from '../utils/schedule';

interface EmployeeAvatarProps {
  name: string;
  photoDataUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<EmployeeAvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-20 w-20 text-lg',
};

const PALETTES = [
  'bg-slate-800 text-white',
  'bg-blue-700 text-white',
  'bg-emerald-700 text-white',
  'bg-amber-700 text-white',
  'bg-indigo-700 text-white',
  'bg-cyan-700 text-white',
];

function getColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

export function EmployeeAvatar({
  name,
  photoDataUrl,
  size = 'md',
  className = '',
}: EmployeeAvatarProps) {
  const [imgError, setImgError] = useState(false);

  if (photoDataUrl && !imgError) {
    return (
      <img
        src={photoDataUrl}
        alt={`Foto de ${name}`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${SIZE_CLASSES[size]} rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100 ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${SIZE_CLASSES[size]} ${getColorClass(name)} rounded-full flex items-center justify-center font-display font-semibold tracking-tight shrink-0 select-none ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
