import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  actionLabel: string;
  onThisOnly: () => void;
  onAll: () => void;
}

export function RecurrenceActionModal({ open, onOpenChange, actionLabel, onThisOnly, onAll }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Evento recorrente</AlertDialogTitle>
          <AlertDialogDescription>
            Este evento faz parte de uma série recorrente. Como deseja {actionLabel}?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onThisOnly} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
            Apenas este evento
          </AlertDialogAction>
          <AlertDialogAction onClick={onAll}>
            Toda a recorrência
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
