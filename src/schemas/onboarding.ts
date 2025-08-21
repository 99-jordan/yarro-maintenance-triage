import { z } from "zod";

export const emailZ = z.string().trim().toLowerCase().email();
export const nameZ = z.string().trim().min(2).max(120);
export const passcodeZ = z.string().trim().min(12).max(32);
export const slugZ = z.string().trim().min(3).max(30).regex(/^[a-z0-9]+$/, "Use lowercase letters and numbers only");
export const uuidZ = z.string().uuid();
export const phoneZ = z.string().trim().optional().refine(v => !v || v.length >= 7, "Phone looks too short");
export const postcodeZ = z.string().trim().min(3).max(12);
export const roleZ = z.enum(["owner", "manager", "agent"]);

export const AgencySignUpSchema = z.object({ name: nameZ, slug: slugZ });
export const AgentInviteRowSchema = z.object({ email: emailZ, role: roleZ.default("agent") });
export const AgentInvitesFormSchema = z.object({
  invites: z.array(AgentInviteRowSchema).min(1).max(100),
  expiresAt: z.date().refine(d => d.getTime() > Date.now(), "Expiry must be in the future"),
});
export const AgentJoinSchema = z.object({ agencySlug: slugZ, email: emailZ, passcode: passcodeZ });

export const LandlordSchema = z.object({ name: nameZ, email: emailZ, phone: phoneZ });
export const PropertySchema = z.object({
  addressLine1: z.string().trim().min(3).max(160),
  addressLine2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(2).max(80),
  postcode: postcodeZ,
  landlordId: uuidZ.optional(),
  externalCode: z.string().trim().max(40).regex(/^[A-Za-z0-9_]*$/, "Use letters numbers or underscore").optional(),
});
export const TenantSchema = z.object({ name: nameZ, email: emailZ, phone: phoneZ });
export const TenancySchema = z.object({
  propertyId: uuidZ,
  landlordId: uuidZ.optional(),
  tenantEmail: emailZ,
  startDate: z.coerce.date().default(() => new Date()),
});
export const TenantInviteSchema = z.object({
  propertyId: uuidZ,
  landlordId: uuidZ,
  email: emailZ,
  expiresAt: z.date().refine(d => d.getTime() > Date.now(), "Expiry must be in the future"),
});
export const TenantJoinSchema = z.object({ email: emailZ, passcode: passcodeZ });

export type AgencySignUpInput = z.infer<typeof AgencySignUpSchema>;
export type AgentInvitesInput = z.infer<typeof AgentInvitesFormSchema>;
export type AgentJoinInput = z.infer<typeof AgentJoinSchema>;
export type LandlordInput = z.infer<typeof LandlordSchema>;
export type PropertyInput = z.infer<typeof PropertySchema>;
export type TenantInput = z.infer<typeof TenantSchema>;
export type TenancyInput = z.infer<typeof TenancySchema>;
export type TenantInviteInput = z.infer<typeof TenantInviteSchema>;
export type TenantJoinInput = z.infer<typeof TenantJoinSchema>;

export function generatePasscode(length = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const a = alphabet.length;
  let out = "";
  const cryptoObj: any = typeof crypto !== "undefined" ? crypto : null;
  if (cryptoObj && "getRandomValues" in cryptoObj) {
    const buf = new Uint32Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i++) out += alphabet[buf[i] % a];
    return out;
  }
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * a)];
  return out;
}


