import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface ResolveIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => Promise<void>;
  isSubmitting: boolean;
}

export function ResolveIncidentModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
}: ResolveIncidentModalProps) {
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setErrorMessage(null);
      // Foco automático no campo de notas
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fechar ao pressionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const trimmedLength = notes.trim().length;
  const isValid = trimmedLength >= 10 && trimmedLength <= 2000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    try {
      setErrorMessage(null);
      await onConfirm(notes.trim());
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Falha ao registrar a resolução do incidente.');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resolve-modal-title"
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-zinc-100">
        {/* Botão de Fechar */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Fechar modal de resolução"
          className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Título */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="resolve-modal-title" className="text-lg font-bold text-white">
              Resolver Incidente
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Obrigatório documentar a causa-raiz e a ação corretiva aplicada.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div
            className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="resolution-notes"
                className="text-xs font-semibold uppercase tracking-wider text-zinc-300"
              >
                Notas de Resolução *
              </label>
              <span
                className={`text-xs font-mono ${
                  trimmedLength < 10
                    ? 'text-amber-400'
                    : trimmedLength > 2000
                      ? 'text-red-400'
                      : 'text-zinc-500'
                }`}
              >
                {trimmedLength}/10 mín. (máx. 2000)
              </span>
            </div>

            <textarea
              id="resolution-notes"
              ref={textareaRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              rows={4}
              placeholder="Descreva detalhadamente o diagnóstico, a solução aplicada e as medidas preventivas adotadas..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none font-sans"
              required
            />
            {trimmedLength > 0 && trimmedLength < 10 && (
              <p className="text-xs text-amber-400 mt-1">
                Faltam {10 - trimmedLength} caracteres para atingir o mínimo obrigatório.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors rounded-xl border border-zinc-800 hover:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-zinc-600 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors rounded-xl shadow-lg shadow-emerald-950/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Finalizando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Confirmar Resolução</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
