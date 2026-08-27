import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "success" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer";
    
    const variants = {
      default: "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm hover:from-pink-600 hover:to-rose-600 focus-visible:ring-pink-400 active:scale-[0.98]",
      success: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm hover:from-emerald-600 hover:to-teal-700 focus-visible:ring-emerald-400 active:scale-[0.98]",
      destructive: "bg-red-500 text-white shadow-sm hover:bg-red-600 focus-visible:ring-red-400 active:scale-[0.98]",
      outline: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-pink-50/60 hover:text-pink-600 hover:border-pink-200 focus-visible:ring-pink-400",
      secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 focus-visible:ring-slate-400",
      ghost: "hover:bg-pink-50 hover:text-pink-600 text-slate-600",
      link: "text-pink-600 underline-offset-4 hover:underline",
    };

    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-lg px-6 text-base",
      icon: "h-9 w-9",
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
