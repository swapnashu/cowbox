import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "pink";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-pink-50 text-pink-700 border border-pink-200/80 font-medium",
    pink: "bg-gradient-to-r from-pink-500/10 to-rose-500/10 text-pink-600 border border-pink-200 font-medium",
    secondary: "bg-slate-100 text-slate-700 border border-slate-200",
    destructive: "bg-red-50 text-red-700 border border-red-200",
    outline: "text-slate-700 border border-slate-200 bg-white",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium",
    warning: "bg-amber-50 text-amber-700 border border-amber-200 font-medium",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs transition-colors select-none",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
