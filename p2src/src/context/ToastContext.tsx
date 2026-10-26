import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-bottom-2 ${
              toast.type === 'success'
                ? 'bg-[#111722]/95 border-emerald-500/30 text-emerald-300'
                : toast.type === 'error'
                ? 'bg-[#111722]/95 border-[#E5093A]/40 text-rose-300'
                : 'bg-[#111722]/95 border-white/10 text-[#F5F7FA]'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0 text-[#E5093A] mt-0.5" />}
            {toast.type === 'info' && <Info className="w-5 h-5 shrink-0 text-cyan-400 mt-0.5" />}
            <p className="text-xs font-medium leading-relaxed flex-1 text-slate-100">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white transition-colors p-0.5"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
