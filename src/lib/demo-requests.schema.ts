import { z } from "zod";

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

export type SchemaLang = "fr" | "en";

const MESSAGES = {
  fr: {
    fullNameMin: "Nom trop court",
    fullNameMax: "Nom trop long",
    email: "Adresse e-mail invalide",
    emailMax: "Adresse e-mail trop longue",
    phone: "Téléphone requis",
    phoneMax: "Téléphone trop long",
    companyName: "Nom d'entreprise requis",
    companyNameMax: "Nom d'entreprise trop long",
    companySize: "Veuillez sélectionner la taille de l'entreprise",
    messageMax: "Message trop long",
  },
  en: {
    fullNameMin: "Name is too short",
    fullNameMax: "Name is too long",
    email: "Invalid email address",
    emailMax: "Email address is too long",
    phone: "Phone number is required",
    phoneMax: "Phone number is too long",
    companyName: "Company name is required",
    companyNameMax: "Company name is too long",
    companySize: "Please select your company size",
    messageMax: "Message is too long",
  },
} as const;

/** Construit le schéma de demande de démo avec des messages dans la langue donnée. */
export function createDemoRequestSchema(lang: SchemaLang = "fr") {
  const m = MESSAGES[lang] ?? MESSAGES.fr;
  return z.object({
    fullName: z.string().trim().min(2, m.fullNameMin).max(120, m.fullNameMax),
    email: z.string().trim().email(m.email).max(255, m.emailMax),
    phone: z.string().trim().min(1, m.phone).max(40, m.phoneMax),
    companyName: z.string().trim().min(2, m.companyName).max(160, m.companyNameMax),
    companySize: z.enum(COMPANY_SIZES, {
      errorMap: () => ({ message: m.companySize }),
    }),
    message: z.string().trim().max(2000, m.messageMax).optional().or(z.literal("")),
  });
}

/** Schéma par défaut (FR) — source de vérité côté serveur. */
export const demoRequestSchema = createDemoRequestSchema("fr");

export type DemoRequestInput = z.infer<typeof demoRequestSchema>;
