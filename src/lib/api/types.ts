// ---------- ENUMS ----------
export type UserRole = 'owner' | 'agent' | 'tenant' | 'specialist';
export type UpdateCategory = 'maintenance' | 'rent' | 'inspection' | 'general';
export type UpdateStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';
export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';

// ---------- CORE ENTITIES ----------
export interface Agency {
  id: string;
  name: string;
  slug: string;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  agencyId: string;
  fullName: string;
  role: UserRole;
  signatureId: string;
  position?: string;
  managedProperties: string[]; // Array of property IDs they manage
  permissions?: Record<string, unknown>;
  isActive: boolean;
  preferences?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Landlord {
  id: string;
  agencyId: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  lettingAgent?: string; // NEW: References profile.id
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  agencyId: string;
  landlordId: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  notes?: string;
  publicToken?: string;
  lettingAgent?: string; // NEW: References profile.id (auto-synced with landlord)
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  agencyId: string;
  updateId: string;
  filePath: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface Update {
  id: string;
  agencyId: string;
  landlordId: string;
  propertyId: string;
  category: UpdateCategory;
  title: string;
  description: string;
  eventDate: string; // ISO
  status: UpdateStatus;
  costPennies?: number;
  vatPennies?: number;
  priority: PriorityLevel;
  sentAt?: string; // ISO
  sentChannel?: string;
  replyToId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

// ---------- INPUT / RESULT TYPES ----------
export interface CreateUpdateInput extends Omit<Update, 'id' | 'sentAt' | 'sentChannel' | 'attachments' | 'createdAt' | 'updatedAt'> {
  attachments?: File[];
}

export interface UpdateResult {
  update: Update;
  emailQueued: boolean;
}

export interface EmailResult {
  updateId: string;
  success: boolean;
  error?: string;
}

export interface ColumnMapping {
  src: string;
  dest: keyof Landlord | keyof Property;
}

export interface ImportPreview {
  rows: number;
  landlordsDetected: number;
  propertiesDetected: number;
  duplicates: number;
}

export interface ImportResult {
  landlordsCreated: number;
  propertiesCreated: number;
  landlordsUpdated: number;
}

// ---------- EMAIL & WEEKLY SUMMARIES ----------
export interface WeeklySummary {
  id: string;
  agencyId: string;
  landlordId: string;
  weekStart: string; // ISO date
  weekEnd: string; // ISO date
  totalUpdates: number;
  totalCostPennies: number;
  updatesByCategory: Record<UpdateCategory, number>;
  propertiesWithUpdates: string[];
  sentAt?: string;
  sentChannel?: string;
  createdAt: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  recipientCount: number;
}

export interface WeeklySummaryResult {
  summaries: WeeklySummary[];
  emailsSent: number;
  errors: string[];
}

// MailerSend API types based on their documentation
export interface MailerSendEmailRequest {
  from: {
    email: string;
    name?: string;
  };
  to: Array<{
    email: string;
    name?: string;
  }>;
  subject: string;
  html?: string;
  text?: string;
  template_id?: string;
  variables?: Array<{
    email: string;
    substitutions: Array<{
      var: string;
      value: string;
    }>;
  }>;
  attachments?: Array<{
    content: string; // base64 encoded
    filename: string;
  }>;
}

export interface MailerSendEmailResponse {
  message_id: string;
  message: string;
}

// API Request/Response types
export interface SendWeeklySummariesRequest {
  weekStart?: string;
  agencyId?: string;
  templateId?: string;
  dryRun?: boolean;
}

export interface SendWeeklySummariesResponse {
  success: boolean;
  summariesGenerated: number;
  emailsSent: number;
  errors: string[];
  summaryIds: string[];
}

// ---------- TENANT ENTITIES ----------
export interface TenantTicket {
  id: string;
  agencyId: string;
  tenantId: string;
  propertyId: string;
  landlordId: string;
  agentId?: string;
  title: string;
  description: string;
  status: UpdateStatus;
  severity: PriorityLevel;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantMessage {
  id: string;
  ticketId: string;
  agencyId: string;
  senderId: string;
  body: string;
  createdAt: string;
  // System/assistant messages support (present when inserted by Edge Function)
  isSystem?: boolean;
  meta?: Record<string, unknown>;
}

export interface CreateTenantTicketInput {
  agencyId: string;
  tenantId: string;
  propertyId: string;
  landlordId: string;
  agentId?: string;
  title: string;
  description: string;
  severity: PriorityLevel;
}

// ---------- UNIFIED FEED ----------
export interface UnifiedPropertyUpdate {
  id: string;
  source: 'manager_update' | 'tenant_ticket';
  agencyId: string;
  landlordId: string;
  propertyId: string;
  createdBy: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  occurredAt: string; // ISO
  createdAt: string;
  updatedAt: string;
}

// ---------- SESSION ----------
export interface Session {
  userId: string;
  agencyId: string;
  token: string;
  expiry: string; // ISO
}

// ---------- API INTERFACE ----------
export interface YarrowAPI {
  // Auth
  signUp(email: string, password: string, fullName: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;

  // Profiles
  getProfile(): Promise<Profile | null>;
  updateProfile(updates: Partial<Profile>): Promise<void>;

  // Landlords / Properties
  listLandlords(search?: string): Promise<Landlord[]>;
  listProperties(landlordId?: string): Promise<Property[]>;

  // Updates
  createUpdate(input: CreateUpdateInput, sendNow?: boolean): Promise<UpdateResult>;
  updateStatus(updateId: string, status: UpdateStatus, notify?: boolean): Promise<void>;
  sendUpdate(updateId: string): Promise<EmailResult>;
  listUpdates(propertyId: string): Promise<Update[]>;

  // Unified feed for agents/owners
  getUnifiedPropertyFeed(propertyId: string): Promise<UnifiedPropertyUpdate[]>;

  // Tenant ticket management
  createTenantTicket(input: CreateTenantTicketInput): Promise<TenantTicket>;
  updateTenantTicketStatus(ticketId: string, status: UpdateStatus): Promise<void>;
  listTenantTickets(propertyId?: string): Promise<TenantTicket[]>;
  getTenantProperty(): Promise<Property | null>;
  getTenantTicketById(ticketId: string): Promise<TenantTicket>; // NEW

  // Tenant messaging
  sendTenantMessage(ticketId: string, body: string): Promise<TenantMessage>;
  listTenantMessages(ticketId: string): Promise<TenantMessage[]>;

  // Attachments
  uploadAttachment(file: File, updateId: string): Promise<Attachment>;
  getSignedUrl(filePath: string, expiresIn?: number): Promise<string>;

  // CSV Import
  previewCSV(file: File): Promise<ImportPreview>;
  importCSV(file: File, mappings: ColumnMapping[]): Promise<ImportResult>;

  // Weekly Summaries
  generateWeeklySummaries(weekStart?: string): Promise<WeeklySummaryResult>;
  sendWeeklySummaries(weekStart?: string): Promise<EmailSendResult>;
  getWeeklySummary(landlordId: string, weekStart: string): Promise<WeeklySummary | null>;
  listWeeklySummaries(landlordId?: string, limit?: number): Promise<WeeklySummary[]>;

  // Direct Email Sending via MailerSend
  sendEmail(to: string, subject: string, htmlBody: string, textBody?: string): Promise<EmailSendResult>;
  sendBulkEmail(recipients: string[], subject: string, htmlBody: string, textBody?: string): Promise<EmailSendResult>;
}