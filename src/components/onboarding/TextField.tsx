import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}

export function TextField({ id, label, type = 'text', placeholder, error, disabled, value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} placeholder={placeholder} disabled={disabled} value={value} onChange={(e) => onChange?.(e.target.value)} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}


