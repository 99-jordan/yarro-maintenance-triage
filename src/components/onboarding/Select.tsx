import { Select as UiSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Option { value: string; label: string; }

interface Props {
  id: string;
  label: string;
  value?: string;
  onValueChange?: (v: string) => void;
  options: Option[];
  disabled?: boolean;
}

export function Select({ id, label, value, onValueChange, options, disabled }: Props) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <UiSelect value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </UiSelect>
    </div>
  );
}


