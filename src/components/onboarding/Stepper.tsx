import { ReactNode } from "react";

interface StepperProps {
  steps: string[];
  active: number;
}

export function Stepper({ steps, active }: StepperProps) {
  return (
    <div className="flex items-center gap-4">
      {steps.map((label, idx) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${idx <= active ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{idx + 1}</div>
          <span className={`text-sm ${idx === active ? 'font-semibold' : 'text-gray-600'}`}>{label}</span>
          {idx < steps.length - 1 && <div className="w-8 h-px bg-gray-300" />}
        </div>
      ))}
    </div>
  );
}


