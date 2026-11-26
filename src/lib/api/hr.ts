// Departments and employees — 06-api-reference §4 and §5.
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export const EMPLOYEES_PAGE_SIZE = 24;

export type EmployeeStatus = "active" | "on_leave" | "suspended" | "terminated";

export interface EmployeeAddress {
  line1?: string;
  city?: string;
  country?: string;
}

export interface EmergencyContact {
  name?: string;
  phone?: string;
  relation?: string;
}

/** Only the first six fields are always present: the rest depends on the reader (06 §4). */
export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  departmentId: string | null;
  photoUrl: string | null;
  userId?: string | null;
  employeeNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  managerId?: string | null;
  hireDate?: string | null;
  endDate?: string | null;
  status?: EmployeeStatus;
  leaveBalance?: number;
  birthDate?: string | null;
  address?: EmployeeAddress;
  emergencyContact?: EmergencyContact;
}

export interface EmployeeInput {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  departmentId?: string | null;
  managerId?: string | null;
  hireDate?: string | null;
  status?: EmployeeStatus;
  birthDate?: string | null;
  address?: EmployeeAddress;
  emergencyContact?: EmergencyContact;
}

export interface EmployeeFilters {
  page: number;
  q?: string;
  status?: EmployeeStatus;
  departmentId?: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  managerId: string | null;
  parentDepartmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentInput {
  name: string;
  description: string | null;
  managerId: string | null;
}

/** Every HR query of an organization, to refresh them together after a change. */
export const hrKey = (organizationId: string) => ["org", organizationId, "hr"] as const;

export const departmentsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...hrKey(organizationId), "departments"],
    queryFn: () => api.all<Department>("/org/departments"),
  });

export const employeesQuery = (organizationId: string, filters: EmployeeFilters) =>
  queryOptions({
    queryKey: [...hrKey(organizationId), "employees", "page", filters],
    queryFn: () =>
      api.list<Employee>("/org/employees", {
        page: filters.page,
        perPage: EMPLOYEES_PAGE_SIZE,
        q: filters.q,
        "filter[status]": filters.status,
        "filter[departmentId]": filters.departmentId,
      }),
    placeholderData: keepPreviousData,
  });

/** Every employee the reader may see, for department counts and head selection. */
export const allEmployeesQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...hrKey(organizationId), "employees", "all"],
    queryFn: () => api.all<Employee>("/org/employees"),
  });

export const eligibleManagersQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...hrKey(organizationId), "employees", "managers"],
    queryFn: () => api.all<Employee>("/org/employees/managers"),
  });

export const employeeQuery = (organizationId: string, id: string) =>
  queryOptions({
    queryKey: [...hrKey(organizationId), "employees", "detail", id],
    queryFn: () => api.get<Employee>(`/org/employees/${encodeURIComponent(id)}`),
    retry: false,
  });

/** Records counted against the plan quota: terminated employees are not (07 §1.1). */
export const employeeHeadcountQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...hrKey(organizationId), "employees", "headcount"],
    queryFn: async () => {
      const [all, terminated] = await Promise.all([
        api.list<Employee>("/org/employees", { perPage: 1 }),
        api.list<Employee>("/org/employees", { perPage: 1, "filter[status]": "terminated" }),
      ]);
      return (all.meta.total ?? 0) - (terminated.meta.total ?? 0);
    },
  });

export function createEmployee(input: EmployeeInput) {
  return api.post<Employee>("/org/employees", input);
}

export function updateEmployee(id: string, input: EmployeeInput) {
  return api.patch<Employee>(`/org/employees/${encodeURIComponent(id)}`, input);
}

export function createDepartment(input: DepartmentInput) {
  return api.post<Department>("/org/departments", input);
}

export function updateDepartment(id: string, input: DepartmentInput) {
  return api.patch<Department>(`/org/departments/${encodeURIComponent(id)}`, input);
}

/** A department holding employees can only be deleted by moving them elsewhere. */
export function deleteDepartment(id: string, reassignTo?: string) {
  return api.delete(`/org/departments/${encodeURIComponent(id)}`, {
    query: { reassignTo },
  });
}

// ---------------------------------------------------------------- Contracts (06 §5)

export type ContractType = "cdi" | "cdd" | "stage" | "freelance" | "apprenticeship" | "daily";
export type ContractStatus = "draft" | "active" | "suspended" | "terminated";

/** `salary`, `currency` and `notes` are only sent to owner, hr_admin and the employee. */
export interface Contract {
  id: string;
  employeeId: string;
  type: ContractType;
  status: ContractStatus;
  startDate: string;
  endDate: string | null;
  trialPeriodEnd: string | null;
  weeklyHours: number | null;
  hasDocument: boolean;
  salary?: number | null;
  currency?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractInput {
  employeeId?: string;
  type: ContractType;
  status: Exclude<ContractStatus, "terminated">;
  startDate: string;
  endDate: string | null;
  trialPeriodEnd: string | null;
  salary: number | null;
  weeklyHours: number | null;
  notes: string | null;
}

export interface SignedUrl {
  url: string;
  expiresIn: number;
}

export const contractsQuery = (organizationId: string, employeeId?: string) =>
  queryOptions({
    queryKey: [...hrKey(organizationId), "contracts", employeeId ?? "all"],
    queryFn: () => api.all<Contract>("/org/contracts", { "filter[employeeId]": employeeId }),
  });

const contractPath = (id: string) => `/org/contracts/${encodeURIComponent(id)}`;

export function createContract(input: ContractInput) {
  return api.post<Contract>("/org/contracts", input);
}

/** The employee of a contract never changes. */
export function updateContract(id: string, { employeeId: _employeeId, ...input }: ContractInput) {
  return api.patch<Contract>(contractPath(id), input);
}

export function deleteContract(id: string) {
  return api.delete(contractPath(id));
}

export function terminateContract(id: string, endDate: string) {
  return api.post<Contract>(`${contractPath(id)}/terminate`, { endDate });
}

export function contractDocumentUrl(id: string) {
  return api.get<SignedUrl>(`${contractPath(id)}/document`);
}

export function uploadContractDocument(id: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return api.post<Contract>(`${contractPath(id)}/document`, form);
}

// ---------------------------------------------------- Employee import and export (06 §4)

export type ImportAction = "create" | "update" | "skip" | "error";

export interface ImportPreview {
  importToken: string;
  expiresIn: number;
  summary: Record<ImportAction | "total", number>;
  rows: { line: number; action: ImportAction; name: string; employeeId: string | null }[];
  errors: { line: number; field: string; rule: string; message: string }[];
}

export interface ImportReport {
  created: number;
  updated: number;
  skipped: number;
}

export function previewEmployeeImport(file: File) {
  const form = new FormData();
  form.append("file", file);
  return api.post<ImportPreview>("/org/employees/import/preview", form);
}

export function commitEmployeeImport(importToken: string, idempotencyKey: string) {
  return api.post<ImportReport>(
    "/org/employees/import/commit",
    { importToken },
    { idempotencyKey },
  );
}

/** Asynchronous: the file link is sent by e-mail (202). */
export function exportEmployees(format: "csv" | "xlsx") {
  return api.post<{ jobId: string }>("/org/employees/export", { format });
}

// ------------------------------------------------------- NFC badges (06 §6, timeclock module)

/** `uid` is masked by the API (`••••6B3E`). */
export interface NfcBadge {
  id: string;
  employeeId: string;
  uid: string;
  isActive: boolean;
  assignedAt: string;
  revokedAt: string | null;
}

export interface NfcBadgeEvent {
  id: string;
  employeeId: string;
  badgeId: string;
  uid: string;
  event: string;
  reason: string | null;
  actorUserId: string | null;
  createdAt: string;
}

const badgePath = (employeeId: string) => `/org/employees/${encodeURIComponent(employeeId)}/badge`;

export const employeeBadgeQuery = (organizationId: string, employeeId: string) =>
  queryOptions({
    queryKey: [...hrKey(organizationId), "badge", employeeId],
    queryFn: () => api.get<NfcBadge | null>(badgePath(employeeId)),
  });

export const badgeEventsQuery = (organizationId: string, employeeId: string) =>
  queryOptions({
    queryKey: [...hrKey(organizationId), "badge", employeeId, "events"],
    queryFn: () => api.all<NfcBadgeEvent>("/org/timeclock/badge-events", { employeeId }),
  });

/** Replaces the employee's current badge, if any. */
export function assignBadge(employeeId: string, badgeUid: string, idempotencyKey: string) {
  return api.post<NfcBadge>(badgePath(employeeId), { badgeUid }, { idempotencyKey });
}

export function revokeBadge(employeeId: string) {
  return api.delete(badgePath(employeeId));
}

// ------------------------------------------------- Directory (06 §4, added 2026-11-23)

/** A colleague as every member may see them: active and on leave only. */
export interface DirectoryEntry {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  departmentId: string | null;
  photoUrl: string | null;
}

/** Every colleague, sorted by last then first name, for selectors and names. */
export const directoryQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...hrKey(organizationId), "directory"],
    queryFn: () => api.all<DirectoryEntry>("/org/employees/directory"),
  });

/** `POST /org/employees/:id/photo` (O H · self): PNG, JPEG or WebP, 2 MB at most. */
export const EMPLOYEE_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const EMPLOYEE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export function uploadEmployeePhoto(id: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return api.post<Employee>(`/org/employees/${encodeURIComponent(id)}/photo`, form);
}
