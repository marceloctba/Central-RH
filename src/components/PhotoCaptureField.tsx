import { Camera, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { EmployeeAvatar } from './EmployeeAvatar';

interface PhotoCaptureFieldProps {
  name: string;
  value: string;
  onChange: (dataUrl: string) => void;
}

function compressCanvasToDataUrl(
  source: HTMLImageElement | HTMLVideoElement,
  srcWidth: number,
  srcHeight: number,
): string {
  const targetSize = 240;
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const minSide = Math.min(srcWidth, srcHeight);
  const sx = (srcWidth - minSide) / 2;
  const sy = (srcHeight - minSide) / 2;
  ctx.drawImage(source, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
  return canvas.toDataURL('image/jpeg', 0.8);
}

export function PhotoCaptureField({ name, value, onChange }: PhotoCaptureFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [startingCamera, setStartingCamera] = useState(false);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setStartingCamera(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Este navegador não oferece acesso à câmera.');
      return;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setStartingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setStartingCamera(false);
      // Attach stream once video element mounts
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setStartingCamera(false);
      setCameraActive(false);
      setCameraError(
        'Não foi possível acessar a câmera. Verifique as permissões do navegador ou envie uma foto do aparelho.',
      );
    }
  };

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
    const dataUrl = compressCanvasToDataUrl(video, video.videoWidth, video.videoHeight);
    if (dataUrl) {
      onChange(dataUrl);
      stopCamera();
    }
  };

  const handleToggleFacing = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    void startCamera(nextMode);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCameraError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCameraError('Selecione um arquivo de imagem válido (JPG, PNG ou WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const dataUrl = compressCanvasToDataUrl(img, img.width, img.height);
        if (dataUrl) {
          onChange(dataUrl);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <EmployeeAvatar name={name || 'Novo'} photoDataUrl={value} size="xl" />
        <div className="flex-1 min-w-0 space-y-2.5">
          <div>
            <p className="text-sm font-medium text-slate-900">Foto do funcionário</p>
            <p className="text-xs text-slate-500">
              Envie uma imagem do aparelho ou tire uma foto na hora pela câmera.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Enviar foto
            </button>
            <button
              type="button"
              disabled={startingCamera}
              onClick={() => void startCamera(facingMode)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              {startingCamera ? 'Abrindo câmera...' : 'Tirar com câmera'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover
              </button>
            )}
          </div>
        </div>
      </div>

      {cameraError && (
        <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {cameraError}
        </p>
      )}

      {cameraActive && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="relative mx-auto w-full max-w-xs aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-300">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-4 rounded-full border-2 border-dashed border-white/60"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleCapturePhoto}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              Capturar foto
            </button>
            <button
              type="button"
              onClick={handleToggleFacing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Alternar câmera
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Fechar câmera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
