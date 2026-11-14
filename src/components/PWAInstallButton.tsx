import { Download, Share, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'card';
}

export function PWAInstallButton({ variant = 'header' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    const classes =
      variant === 'sidebar'
        ? 'w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer'
        : variant === 'card'
          ? 'w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer'
          : 'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer';

    return (
      <button type="button" onClick={() => void install()} className={classes}>
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Instalar aplicativo</span>
      </button>
    );
  }

  if (isIOS) {
    const classes =
      variant === 'sidebar'
        ? 'w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer'
        : variant === 'card'
          ? 'w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer'
          : 'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer';

    return (
      <>
        <button type="button" onClick={() => setShowIOSGuide(true)} className={classes}>
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>Instalar no iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-blue-700 font-display">Central RH</p>
                  <h3 className="mt-0.5 text-base font-bold text-slate-900">
                    Instalar no iPhone ou iPad
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Fechar instruções"
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ol className="space-y-2.5 text-sm text-slate-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="font-mono text-xs font-bold text-blue-700 mt-0.5">1.</span>
                  <span>
                    Toque no botão{' '}
                    <strong className="inline-flex items-center gap-1 text-slate-900">
                      Compartilhar <Share className="w-3.5 h-3.5 inline" />
                    </strong>{' '}
                    na barra do navegador Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono text-xs font-bold text-blue-700 mt-0.5">2.</span>
                  <span>
                    Role para baixo e toque em{' '}
                    <strong className="text-slate-900">Adicionar à Tela de Início</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono text-xs font-bold text-blue-700 mt-0.5">3.</span>
                  <span>
                    Confirme tocando em <strong className="text-slate-900">Adicionar</strong> para
                    abrir o Central RH em tela cheia.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
