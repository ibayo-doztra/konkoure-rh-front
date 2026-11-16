"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface EmployeeComboboxOption {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  photo_url?: string | null;
  position?: string | null;
}

interface EmployeeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: EmployeeComboboxOption[];
  meOption?: EmployeeComboboxOption | null;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  triggerVariant?: "full" | "minimal";
}

function initials(option: EmployeeComboboxOption | null | undefined): string {
  if (!option) return "?";
  const first = (option.first_name ?? "").trim();
  const last = (option.last_name ?? "").trim();
  const parts = [first, last].filter(Boolean);
  if (parts.length >= 2) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function fullName(option: EmployeeComboboxOption | null | undefined): string {
  if (!option) return "—";
  const name = `${option.first_name ?? ""} ${option.last_name ?? ""}`.trim();
  return name || "—";
}

function SelectedEmployeePreview({
  option,
  label,
  placeholder,
  triggerVariant,
}: {
  option?: EmployeeComboboxOption | null;
  label?: string;
  placeholder?: string;
  triggerVariant?: "full" | "minimal";
}) {
  if (triggerVariant === "minimal") {
    return (
      <div className="min-w-0 text-left">
        {label && <p className="text-xs text-muted-foreground">{label}</p>}
        <p className="truncate text-sm font-medium">
          {option ? fullName(option) : placeholder ?? "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 overflow-hidden">
      <Avatar className="h-8 w-8 shrink-0">
        {option?.photo_url && <AvatarImage src={option.photo_url} alt={fullName(option)} className="object-cover" />}
        <AvatarFallback className="text-xs font-medium">
          {option ? initials(option) : <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 text-left">
        {label && <p className="text-xs text-muted-foreground">{label}</p>}
        <p className="truncate text-sm font-medium">
          {option ? fullName(option) : placeholder ?? "—"}
        </p>
        {option?.email && (
          <p className="truncate text-xs text-muted-foreground">{option.email}</p>
        )}
      </div>
    </div>
  );
}

export function EmployeeCombobox({
  value,
  onChange,
  options,
  meOption,
  label,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  className,
  triggerVariant,
}: EmployeeComboboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const meActive = !value || value === meOption?.id;
  const selected = meActive ? meOption : options.find((o) => o.id === value) ?? null;

  const allOptions: EmployeeComboboxOption[] = meOption ? [meOption, ...options] : options;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-auto w-full justify-between px-3 py-2 font-normal hover:bg-accent",
            className,
          )}
        >
          <SelectedEmployeePreview option={selected} label={label} placeholder={placeholder} triggerVariant={triggerVariant} />
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder ?? t("reviews.searchCollaborator", { defaultValue: "Rechercher un collaborateur…" })}
            className="h-10"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>{emptyMessage ?? t("reviews.noCollaboratorFound", { defaultValue: "Aucun collaborateur trouvé." })}</CommandEmpty>
            <CommandGroup>
              {allOptions.map((option) => {
                const active = value === option.id || (!value && option.id === meOption?.id);
                return (
                  <CommandItem
                    key={option.id}
                    value={fullName(option) + " " + (option.email ?? "") + " " + (option.position ?? "")}
                    onSelect={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 py-2"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      {option.photo_url && <AvatarImage src={option.photo_url} alt={fullName(option)} className="object-cover" />}
                      <AvatarFallback className="text-xs font-medium">{initials(option)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{fullName(option)}</p>
                      {option.email && (
                        <p className="truncate text-xs text-muted-foreground">{option.email}</p>
                      )}
                      {option.position && !option.email && (
                        <p className="truncate text-xs text-muted-foreground">{option.position}</p>
                      )}
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4 shrink-0",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
