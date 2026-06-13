import React, { useState, useRef, useEffect } from 'react';

interface GlassSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface GlassSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: GlassSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function GlassSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  className = '',
  disabled = false,
}: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full px-3 py-2 rounded-lg glass-input text-left text-sm font-body flex items-center justify-between gap-2 transition-colors ${
          disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
        } ${!selected ? 'text-gray-500' : 'text-white'}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && options.length > 0 && (
        <div className="absolute z-[60] left-0 right-0 mt-1 glass-strong rounded-xl py-1 max-h-[220px] overflow-y-auto animate-scale-in shadow-2xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => {
                if (!opt.disabled) {
                  onChange(opt.value);
                  setOpen(false);
                }
              }}
              className={`w-full px-3 py-2 text-left text-sm font-body transition-colors ${
                opt.disabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : opt.value === value
                    ? 'text-biu-primary bg-white/5'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
