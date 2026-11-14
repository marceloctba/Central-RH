import { Store as StoreIcon, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { Store } from '../types';

interface StoreModalProps {
  open: boolean;
  store: Store | null; // null = create, Store = rename
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}

export function StoreModal({ open, store, onSave, onClose }: StoreModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(store ? store.name : '');
  }, [open, store]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError('Informe o nome da loja.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(clean);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? `Não foi possível salvar a loja: ${err.message}` : 'Erro ao salvar loja.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <StoreIcon className="w-5 h-5 text-blue-700" />
            <h2 id="store-modal-title" className="text-base font-bold text-slate-900">
              {store ? 'Renomear Loja' : 'Cadastrar Nova Loja'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="store-name-input" className="block text-sm font-medium text-slate-800 mb-1.5">
              Nome da loja
            </label>
            <input
              id="store-name-input"
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Loja Centro, Filial Shopping..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
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
              {saving ? 'Salvando...' : store ? 'Salvar nome' : 'Criar loja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
