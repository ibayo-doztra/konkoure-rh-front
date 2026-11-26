import { Facebook, Linkedin } from "lucide-react";
import type { SocialProvider } from "@/lib/api/social";

/** Brand name, icon and brand colour of each social network. */
export const PROVIDER_META: Record<
  SocialProvider,
  { label: string; icon: typeof Linkedin; color: string }
> = {
  linkedin: { label: "LinkedIn", icon: Linkedin, color: "text-[#0A66C2]" },
  facebook: { label: "Facebook", icon: Facebook, color: "text-[#1877F2]" },
};
