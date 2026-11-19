import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface MomentVideoFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  className?: string;
}

export function MomentVideoField({
  value,
  onChange,
  error = false,
  className,
}: MomentVideoFieldProps) {
  return (
    <label className={cn("flex flex-col gap-2 text-sm", className)}>
      <span>{m.moments_video_input_label()}</span>
      <input
        type="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={m.moments_video_input_placeholder()}
        className="w-full rounded-xl border border-border bg-background px-3 py-2"
        aria-invalid={error}
        aria-label={m.moments_video_input_label()}
      />
      {error ? (
        <span role="alert" className="text-sm text-destructive">
          {m.moments_video_invalid_url()}
        </span>
      ) : null}
    </label>
  );
}
