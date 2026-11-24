// Skills catalogue (06-api-reference §4 « Compétences », module `hr`) and talent
// management (§9 « Talents », module `talents`): skills matrix and succession plans.
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api, apiRequest } from "@/lib/api/client";

export const SKILLS_MATRIX_PAGE_SIZE = 25;
export const SUCCESSION_PAGE_SIZE = 20;
export const SKILL_LEVELS = [1, 2, 3, 4, 5] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const talentsKey = (organizationId: string) => ["org", organizationId, "talents"] as const;

// ------------------------------------------------------------------ Catalogue

export interface Skill {
  id: string;
  name: string;
  category: string | null;
}

export interface SkillInput {
  /** 2 to 120 characters, unique regardless of case. */
  name: string;
  category?: string | null;
}

export const skillsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...talentsKey(organizationId), "skills"],
    queryFn: () => api.all<Skill>("/org/skills"),
  });

const skillPath = (id: string) => `/org/skills/${encodeURIComponent(id)}`;

export function createSkill(input: SkillInput) {
  return api.post<Skill>("/org/skills", input);
}

export function updateSkill(id: string, input: Partial<SkillInput>) {
  return api.patch<Skill>(skillPath(id), input);
}

/** Also removes every assessment of this skill. */
export function deleteSkill(id: string) {
  return api.delete(skillPath(id));
}

// ------------------------------------------------------------------ Matrix

export interface SkillsMatrixEmployee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  departmentId: string | null;
  /** Skill id → level (1..5); absent when not assessed. */
  levels: Record<string, number>;
}

export interface SkillsMatrix {
  skills: Skill[];
  employees: SkillsMatrixEmployee[];
}

export interface SkillsMatrixFilters {
  page: number;
  departmentId?: string;
}

/** Paginates the employees: every one for owner / hr_admin, the team for a manager. */
export const skillsMatrixQuery = (organizationId: string, filters: SkillsMatrixFilters) =>
  queryOptions({
    queryKey: [...talentsKey(organizationId), "matrix", filters],
    queryFn: async () => {
      const { data, meta } = await apiRequest<{
        data: SkillsMatrix;
        meta: { lastPage?: number; total?: number };
      }>("/org/talents/skills-matrix", {
        method: "GET",
        query: {
          page: filters.page,
          perPage: SKILLS_MATRIX_PAGE_SIZE,
          "filter[departmentId]": filters.departmentId,
        },
      });
      return { ...data, lastPage: meta?.lastPage ?? 1 };
    },
    placeholderData: keepPreviousData,
  });

export interface SkillsMatrixEntry {
  employeeId: string;
  skillId: string;
  /** `null` removes the assessment. */
  level: SkillLevel | null;
}

/** 1 to 500 distinct cells, all or nothing (owner, hr_admin). */
export function updateSkillsMatrix(entries: SkillsMatrixEntry[]) {
  return api.put<{ updated: number; removed: number }>("/org/talents/skills-matrix", { entries });
}

// ------------------------------------------------------------------ Succession

export const READINESS = ["ready_now", "1_2_years", "3_plus_years"] as const;
export type Readiness = (typeof READINESS)[number];

export interface SuccessionPerson {
  id: string;
  name: string | null;
}

export interface SuccessionPlan {
  id: string;
  positionTitle: string;
  currentEmployee: SuccessionPerson | null;
  successorEmployee: SuccessionPerson | null;
  readiness: Readiness | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SuccessionInput {
  positionTitle: string;
  currentEmployeeId?: string | null;
  successorEmployeeId?: string | null;
  readiness?: Readiness | null;
  notes?: string | null;
}

export interface SuccessionFilters {
  page: number;
  readiness?: Readiness;
}

export const successionQuery = (organizationId: string, filters: SuccessionFilters) =>
  queryOptions({
    queryKey: [...talentsKey(organizationId), "succession", filters],
    queryFn: () =>
      api.list<SuccessionPlan>("/org/talents/succession", {
        page: filters.page,
        perPage: SUCCESSION_PAGE_SIZE,
        "filter[readiness]": filters.readiness,
      }),
    placeholderData: keepPreviousData,
  });

const successionPath = (id: string) => `/org/talents/succession/${encodeURIComponent(id)}`;

export function createSuccessionPlan(input: SuccessionInput) {
  return api.post<SuccessionPlan>("/org/talents/succession", input);
}

/** `null` clears a field. */
export function updateSuccessionPlan(id: string, input: Partial<SuccessionInput>) {
  return api.patch<SuccessionPlan>(successionPath(id), input);
}

export function deleteSuccessionPlan(id: string) {
  return api.delete(successionPath(id));
}

/** Badge classes of a readiness (semantic tokens). */
export const READINESS_CLASS: Record<Readiness, string> = {
  ready_now: "bg-success/15 text-success",
  "1_2_years": "bg-warning/15 text-warning",
  "3_plus_years": "bg-muted text-muted-foreground",
};
