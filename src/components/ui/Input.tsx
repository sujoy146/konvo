import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col w-full">
        {label && <label className="mb-1 text-sm font-medium text-gray-700">{label}</label>}
        <input
          ref={ref}
          className={`px-3 py-2 border rounded-xl bg-white/40 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/70 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-colors ${
            error ? "border-red-500 focus:ring-red-500" : "border-white/50"
          } ${className}`}
          {...props}
        />
        {error && <span className="mt-1 text-xs text-red-500">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
