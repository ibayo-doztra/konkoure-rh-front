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
