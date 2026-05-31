import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudentLoadingStateProps {
  title: string;
  description?: string;
}

interface StudentMessageStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function StudentLoadingState({ title, description }: StudentLoadingStateProps) {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
      <div className="space-y-3">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
    </div>
  );
}

export function StudentEmptyState({ title, description, actionLabel, onAction }: StudentMessageStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button type="button" variant="outline" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function StudentErrorState({ title, description, actionLabel, onAction }: StudentMessageStateProps) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-8 text-center text-destructive">
      <AlertTriangle className="mx-auto h-8 w-8" />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm opacity-90">{description}</p>
      {actionLabel && onAction && (
        <Button type="button" variant="destructive" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
