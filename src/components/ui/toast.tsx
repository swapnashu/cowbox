"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextType {
  toast: (options: Omit<ToastData, "id">) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const toast = useCallback(({ title, description, variant }: Omit<ToastData, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, variant }].slice(-5));

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getVariantStyles = (variant: ToastVariant) => {
    switch (variant) {
      case "success":
        return { border: "border-l-emerald-500", icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> };
      case "error":
        return { border: "border-l-red-500", icon: <XCircle className="h-5 w-5 text-red-500" /> };
      case "warning":
        return { border: "border-l-amber-500", icon: <AlertTriangle className="h-5 w-5 text-amber-500" /> };
      case "info":
        return { border: "border-l-blue-500", icon: <Info className="h-5 w-5 text-blue-500" /> };
    }
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((t) => {
          const { border, icon } = getVariantStyles(t.variant);
          return (
            <div
              key={t.id}
              className={`bg-white shadow-lg rounded-xl overflow-hidden border border-slate-200 border-l-4 ${border} animate-in slide-in-from-right-8 fade-in duration-300 pointer-events-auto`}
            >
              <div className="p-4 flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{icon}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900">{t.title}</h4>
                  {t.description && <p className="text-xs text-slate-500 mt-1">{t.description}</p>}
                </div>
                <button
                  onClick={() => removeToast(t.id)}
                  className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
