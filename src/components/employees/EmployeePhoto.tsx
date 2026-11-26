import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Camera, Eye, Loader2 } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client";
import {
  EMPLOYEE_PHOTO_MAX_BYTES,
  EMPLOYEE_PHOTO_TYPES,
  employeeQuery,
  hrKey,
  uploadEmployeePhoto,
  type Employee,
} from "@/lib/api/hr";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Employee avatar; owner, hr_admin and the employee themselves can replace it (06 §4). */
export function EmployeePhoto({
  employee,
  organizationId,
  canEdit,
}: {
  employee: Pick<Employee, "id" | "firstName" | "lastName" | "photoUrl">;
  organizationId: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const fullName = `${employee.firstName} ${employee.lastName}`;

  const upload = useMutation({
    mutationFn: (file: File) => uploadEmployeePhoto(employee.id, file),
    onSuccess: (updated) => {
      queryClient.setQueryData(employeeQuery(organizationId, employee.id).queryKey, (prev) =>
        prev ? { ...prev, photoUrl: updated.photoUrl } : prev,
      );
      toast.success(t("employee.photoUpdated"));
      return queryClient.invalidateQueries({ queryKey: [...hrKey(organizationId), "employees"] });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const onFile = (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!EMPLOYEE_PHOTO_TYPES.includes(file.type)) {
      toast.error(t("employee.photoType"));
      return;
    }
    if (file.size > EMPLOYEE_PHOTO_MAX_BYTES) {
      toast.error(t("employee.photoTooLarge"));
      return;
    }
    upload.mutate(file);
  };

  const avatar = (
    <Avatar className="h-24 w-24 bg-warning ring-2 ring-border ring-offset-2 ring-offset-background">
      {employee.photoUrl && (
        <AvatarImage src={employee.photoUrl} alt={fullName} className="object-cover" />
      )}
      <AvatarFallback className="bg-warning text-2xl font-semibold text-warning-foreground">
        {employee.firstName[0]}
        {employee.lastName[0]}
      </AvatarFallback>
    </Avatar>
  );

  if (!canEdit && !employee.photoUrl) return <div className="shrink-0">{avatar}</div>;

  return (
    <div className="relative h-24 w-24 shrink-0">
      {avatar}
      {upload.isPending && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40">
          <Loader2 className="h-6 w-6 animate-spin text-background" />
        </div>
      )}
      {canEdit && (
        <input
          ref={fileRef}
          type="file"
          accept={EMPLOYEE_PHOTO_TYPES.join(",")}
          className="hidden"
          data-testid="employee-photo-input"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={upload.isPending}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={t("employee.editPhotoAria")}
          >
            {canEdit ? <Camera className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem className="cursor-pointer" onSelect={() => fileRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" /> {t("employee.changePhoto")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={!employee.photoUrl}
            onSelect={() => setViewerOpen(true)}
          >
            <Eye className="mr-2 h-4 w-4" /> {t("employee.viewFullSize")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[95vw] border-none bg-transparent p-0 shadow-none [&>button]:text-white [&>button]:opacity-100">
          <DialogHeader className="sr-only">
            <DialogTitle>{fullName}</DialogTitle>
          </DialogHeader>
          {employee.photoUrl && (
            <img
              src={employee.photoUrl}
              alt={fullName}
              className="mx-auto max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
