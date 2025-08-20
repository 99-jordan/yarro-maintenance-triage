import { createClient } from '@supabase/supabase-js';
import { 
  YarrowAPI, 
  Session, 
  Profile,
  Landlord, 
  Property, 
  Update, 
  CreateUpdateInput, 
  UpdateResult, 
  UpdateStatus,
  EmailResult,
  Attachment,
  ImportPreview,
  ImportResult,
  ColumnMapping,
  WeeklySummary,
  UpdateCategory,
  WeeklySummaryResult,
  EmailSendResult,
  UnifiedPropertyUpdate,
  TenantTicket,
  TenantMessage,
  CreateTenantTicketInput
} from './types';
import { mailerSendService } from './mailerSendService';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables exist
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseKey ? 'exists' : 'missing');
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

export const supabaseAdapter: YarrowAPI = {
  async signUp(email: string, password: string): Promise<void> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: email.split('@')[0]
          }
        }
      });
      
      if (error) {
        throw new Error(`Signup failed: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('User creation failed');
      }

      // Create a default agency for the user
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .insert({
          id: crypto.randomUUID(),
          name: `${email.split('@')[0]}'s Agency`,
          slug: `${email.split('@')[0]}-agency`,
        })
        .select()
        .single();

      if (agencyError) {
        throw new Error(`Agency creation failed: ${agencyError.message}`);
      }

      // Create profile record
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          agency_id: agency.id,
          full_name: email.split('@')[0],
          role: 'owner',
          signature_id: `${agency.slug}-${email.split('@')[0].substring(0, 2).toUpperCase()}-1`,
          managed_properties: [],
          permissions: { full_access: true }
        });

      if (profileError) {
        throw new Error(`Profile creation failed: ${profileError.message}`);
      }
    } catch (error) {
      console.error('SignUp error:', error);
      throw error;
    }
  },

  async signIn(email: string, password: string): Promise<void> {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw new Error(`Signin failed: ${error.message}`);
      }
    } catch (error) {
      console.error('SignIn error:', error);
      throw error;
    }
  },

  async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw new Error(`Signout failed: ${error.message}`);
      }
    } catch (error) {
      console.error('SignOut error:', error);
      throw error;
    }
  },

  async getSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw new Error(`Session retrieval failed: ${error.message}`);
      }

      if (!session) {
        return null;
      }

      // Get user profile for agency info
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id, full_name')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        throw new Error(`Profile retrieval failed: ${profileError.message}`);
      }

      return {
        userId: session.user.id,
        agencyId: profile.agency_id,
        token: session.access_token,
        expiry: new Date(session.expires_at! * 1000).toISOString()
      };
    } catch (error) {
      console.error('GetSession error:', error);
      throw error;
    }
  },

  async getProfile(): Promise<Profile | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      return {
        id: data.id,
        agencyId: data.agency_id,
        fullName: data.full_name,
        role: data.role,
        signatureId: data.signature_id,
        position: data.position,
        managedProperties: data.managed_properties || [],
        permissions: data.permissions,
        isActive: data.is_active,
        preferences: data.preferences,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('GetProfile error:', error);
      throw error;
    }
  },

  async updateProfile(updates: Partial<Profile>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('UpdateProfile error:', error);
      throw error;
    }
  },

  async listLandlords(search?: string): Promise<Landlord[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get user's agency
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) {
        throw new Error('User profile not found or no agency assigned');
      }

      let query = supabase
        .from('landlords')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .order('name');

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch landlords: ${error.message}`);
      }

      return data.map(landlord => ({
        id: landlord.id,
        agencyId: landlord.agency_id,
        name: landlord.name,
        email: landlord.email,
        phone: landlord.phone,
        notes: landlord.notes,
        lettingAgent: landlord.letting_agent,
        createdAt: landlord.created_at,
        updatedAt: landlord.updated_at
      }));
    } catch (error) {
      console.error('ListLandlords error:', error);
      throw error;
    }
  },

  async listProperties(landlordId: string): Promise<Property[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get user's agency
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) {
        throw new Error('User profile not found or no agency assigned');
      }

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('landlord_id', landlordId)
        .eq('agency_id', profile.agency_id)
        .order('address_line1');

      if (error) {
        throw new Error(`Failed to fetch properties: ${error.message}`);
      }

      return data.map(property => ({
        id: property.id,
        agencyId: property.agency_id,
        landlordId: property.landlord_id,
        addressLine1: property.address_line1,
        addressLine2: property.address_line2,
        city: property.city,
        postcode: property.postcode,
        notes: property.notes,
        publicToken: property.public_token,
        lettingAgent: property.letting_agent,
        createdAt: property.created_at,
        updatedAt: property.updated_at
      }));
    } catch (error) {
      console.error('ListProperties error:', error);
      throw error;
    }
  },

  async createUpdate(input: CreateUpdateInput, sendNow?: boolean): Promise<UpdateResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('updates')
        .insert([{
          id: crypto.randomUUID(), // Generate UUID for the update
          agency_id: input.agencyId,
          landlord_id: input.landlordId,
          property_id: input.propertyId,
          category: input.category,
          title: input.title || `Update for ${input.category}`, // Provide default title if missing
          description: input.description,
          event_date: input.eventDate,
          status: input.status,
          cost_pennies: input.costPennies,
          vat_pennies: input.vatPennies,
          priority: input.priority || 'normal', // Provide default priority if missing
          reply_to_id: input.replyToId,
          created_by: user.id,
          sent_at: sendNow ? new Date().toISOString() : null,
          sent_channel: sendNow ? 'email' : null
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create update: ${error.message}`);
      }

      return {
        update: {
          id: data.id,
          agencyId: data.agency_id,
          landlordId: data.landlord_id,
          propertyId: data.property_id,
          category: data.category,
          title: data.title,
          description: data.description,
          eventDate: data.event_date,
          status: data.status,
          costPennies: data.cost_pennies,
          vatPennies: data.vat_pennies,
          priority: data.priority,
          sentAt: data.sent_at,
          sentChannel: data.sent_channel,
          replyToId: data.reply_to_id,
          createdBy: data.created_by,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        },
        emailQueued: sendNow || false
      };
    } catch (error) {
      console.error('CreateUpdate error:', error);
      throw error;
    }
  },

  async updateStatus(updateId: string, status: UpdateStatus, notify?: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('updates')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', updateId);

      if (error) {
        throw new Error(`Failed to update status: ${error.message}`);
      }
    } catch (error) {
      console.error('UpdateStatus error:', error);
      throw error;
    }
  },

  async sendUpdate(updateId: string): Promise<EmailResult> {
    try {
      const { error } = await supabase
        .from('updates')
        .update({
          sent_at: new Date().toISOString(),
          sent_channel: 'email'
        })
        .eq('id', updateId);

      if (error) {
        throw new Error(`Failed to mark update as sent: ${error.message}`);
      }

      return {
        updateId,
        success: true
      };
    } catch (error) {
      console.error('SendUpdate error:', error);
      throw error;
    }
  },

  async listUpdates(propertyId: string): Promise<Update[]> {
    try {
      const { data, error } = await supabase
        .from('updates')
        .select('*')
        .eq('property_id', propertyId)
        .order('event_date', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch updates: ${error.message}`);
      }

      return data.map(update => ({
        id: update.id,
        agencyId: update.agency_id,
        landlordId: update.landlord_id,
        propertyId: update.property_id,
        category: update.category,
        title: update.title,
        description: update.description,
        eventDate: update.event_date,
        status: update.status,
        costPennies: update.cost_pennies,
        vatPennies: update.vat_pennies,
        priority: update.priority,
        sentAt: update.sent_at,
        sentChannel: update.sent_channel,
        replyToId: update.reply_to_id,
        createdBy: update.created_by,
        createdAt: update.created_at,
        updatedAt: update.updated_at
      }));
    } catch (error) {
      console.error('ListUpdates error:', error);
      throw error;
    }
  },

  async uploadAttachment(file: File, updateId: string): Promise<Attachment> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get user's agency for the file path
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      const filePath = `${profile?.agency_id}/updates/${updateId}/${file.name}`;

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`File upload failed: ${uploadError.message}`);
      }

      // Create attachment record
      const { data, error } = await supabase
        .from('attachments')
        .insert([{
          agency_id: profile?.agency_id,
          update_id: updateId,
          file_path: uploadData.path,
          filename: file.name,
          mime_type: file.type,
          file_size: file.size
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create attachment record: ${error.message}`);
      }

      return {
        id: data.id,
        agencyId: data.agency_id,
        updateId: data.update_id,
        filePath: data.file_path,
        filename: data.filename,
        mimeType: data.mime_type,
        fileSize: data.file_size,
        createdAt: data.created_at
      };
    } catch (error) {
      console.error('UploadAttachment error:', error);
      throw error;
    }
  },

  async getSignedUrl(filePath: string, expiresIn?: number): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .createSignedUrl(filePath, expiresIn || 3600);

      if (error) {
        throw new Error(`Failed to create signed URL: ${error.message}`);
      }

      if (!data.signedUrl) {
        throw new Error('No signed URL returned');
      }

      return data.signedUrl;
    } catch (error) {
      console.error('GetSignedUrl error:', error);
      throw error;
    }
  },

  async previewCSV(file: File): Promise<ImportPreview> {
    throw new Error('CSV preview not implemented yet');
  },

  async importCSV(file: File, mappings: ColumnMapping[]): Promise<ImportResult> {
    throw new Error('CSV import not implemented yet');
  },

  // Weekly Summaries
  async generateWeeklySummaries(weekStart?: string): Promise<WeeklySummaryResult> {
    // This would need to be implemented to generate summaries without sending
    throw new Error('Not implemented - use sendWeeklySummaries instead');
  },

  async sendWeeklySummaries(weekStart?: string): Promise<EmailSendResult> {
    return mailerSendService.sendWeeklySummaries(weekStart);
  },

  async getWeeklySummary(landlordId: string, weekStart: string): Promise<WeeklySummary | null> {
    try {
      const { data, error } = await supabase
        .from('weekly_summaries')
        .select('*')
        .eq('landlord_id', landlordId)
        .eq('week_start', weekStart)
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        agencyId: data.agency_id,
        landlordId: data.landlord_id,
        agentId: data.agent_id, // Include agent ID
        weekStart: data.week_start,
        weekEnd: data.week_end,
        totalUpdates: data.total_updates,
        totalCostPennies: data.total_cost_pennies,
        updatesByCategory: data.updates_by_category,
        propertiesWithUpdates: data.properties_with_updates,
        sentAt: data.sent_at,
        sentChannel: data.sent_channel,
        createdAt: data.created_at
      };
    } catch (error) {
      console.error('GetWeeklySummary error:', error);
      return null;
    }
  },

  async listWeeklySummaries(landlordId?: string, limit: number = 50): Promise<WeeklySummary[]> {
    try {
      let query = supabase
        .from('weekly_summaries')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(limit);

      if (landlordId) {
        query = query.eq('landlord_id', landlordId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map(item => ({
        id: item.id,
        agencyId: item.agency_id,
        landlordId: item.landlord_id,
        agentId: item.agent_id, // Include agent ID
        weekStart: item.week_start,
        weekEnd: item.week_end,
        totalUpdates: item.total_updates,
        totalCostPennies: item.total_cost_pennies,
        updatesByCategory: item.updates_by_category,
        propertiesWithUpdates: item.properties_with_updates,
        sentAt: item.sent_at,
        sentChannel: item.sent_channel,
        createdAt: item.created_at
      }));
    } catch (error) {
      console.error('ListWeeklySummaries error:', error);
      throw error;
    }
  },

  async getUnifiedPropertyFeed(propertyId: string): Promise<UnifiedPropertyUpdate[]> {
    try {
      const { data, error } = await supabase
        .rpc('fn_agent_property_feed', { p_property_id: propertyId });

      if (error) throw new Error(`Failed to fetch unified feed: ${error.message}`);

      return data.map(item => ({
        id: item.id,
        source: item.source,
        agencyId: item.agency_id,
        landlordId: item.landlord_id,
        propertyId: item.property_id,
        createdBy: item.created_by,
        status: item.status,
        priority: item.priority,
        title: item.title,
        description: item.description,
        occurredAt: item.occurred_at,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));
    } catch (error) {
      console.error('GetUnifiedPropertyFeed error:', error);
      throw error;
    }
  },

  async createTenantTicket(input: CreateTenantTicketInput): Promise<TenantTicket> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tenant_tickets')
        .insert([{
          id: crypto.randomUUID(),
          agency_id: input.agencyId,
          tenant_id: input.tenantId,
          property_id: input.propertyId,
          landlord_id: input.landlordId,
          agent_id: input.agentId,
          title: input.title,
          description: input.description,
          status: 'open',
          severity: input.severity,
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw new Error(`Failed to create tenant ticket: ${error.message}`);

      return {
        id: data.id,
        agencyId: data.agency_id,
        tenantId: data.tenant_id,
        propertyId: data.property_id,
        landlordId: data.landlord_id,
        agentId: data.agent_id,
        title: data.title,
        description: data.description,
        status: data.status,
        severity: data.severity,
        createdBy: data.created_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('CreateTenantTicket error:', error);
      throw error;
    }
  },

  async updateTenantTicketStatus(ticketId: string, status: UpdateStatus): Promise<void> {
    try {
      const { error } = await supabase
        .from('tenant_tickets')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw new Error(`Failed to update ticket status: ${error.message}`);
    } catch (error) {
      console.error('UpdateTenantTicketStatus error:', error);
      throw error;
    }
  },

  async listTenantTickets(propertyId?: string): Promise<TenantTicket[]> {
    try {
      let query = supabase.from('tenant_tickets').select('*');
      
      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to fetch tenant tickets: ${error.message}`);

      return data.map(ticket => ({
        id: ticket.id,
        agencyId: ticket.agency_id,
        tenantId: ticket.tenant_id,
        propertyId: ticket.property_id,
        landlordId: ticket.landlord_id,
        agentId: ticket.agent_id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        severity: ticket.severity,
        createdBy: ticket.created_by,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at
      }));
    } catch (error) {
      console.error('ListTenantTickets error:', error);
      throw error;
    }
  },

  async getTenantProperty(): Promise<Property | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get tenant's active tenancy
      const { data: tenancy, error: tenancyError } = await supabase
        .from('tenancies')
        .select('property_id')
        .eq('tenant_id', user.id)
        .eq('is_active', true)
        .single();

      if (tenancyError || !tenancy) {
        return null;
      }

      // Get the property details
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', tenancy.property_id)
        .single();

      if (propertyError) throw new Error(`Failed to fetch property: ${propertyError.message}`);

      return {
        id: property.id,
        agencyId: property.agency_id,
        landlordId: property.landlord_id,
        addressLine1: property.address_line1,
        addressLine2: property.address_line2,
        city: property.city,
        postcode: property.postcode,
        notes: property.notes,
        publicToken: property.public_token,
        lettingAgent: property.letting_agent,
        createdAt: property.created_at,
        updatedAt: property.updated_at
      };
    } catch (error) {
      console.error('GetTenantProperty error:', error);
      throw error;
    }
  },

  async sendTenantMessage(ticketId: string, body: string): Promise<TenantMessage> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get ticket to inherit agency_id
      const { data: ticket, error: ticketError } = await supabase
        .from('tenant_tickets')
        .select('agency_id')
        .eq('id', ticketId)
        .single();

      if (ticketError) throw new Error(`Failed to find ticket: ${ticketError.message}`);

      const { data, error } = await supabase
        .from('tenant_messages')
        .insert([{
          id: crypto.randomUUID(),
          ticket_id: ticketId,
          agency_id: ticket.agency_id,
          sender_id: user.id,
          body
        }])
        .select()
        .single();

      if (error) throw new Error(`Failed to send message: ${error.message}`);

      // Removed: legacy Edge Function call

      return {
        id: data.id,
        ticketId: data.ticket_id,
        agencyId: data.agency_id,
        senderId: data.sender_id,
        body: data.body,
        createdAt: data.created_at
      };
    } catch (error) {
      console.error('SendTenantMessage error:', error);
      throw error;
    }
  },

  async listTenantMessages(ticketId: string): Promise<TenantMessage[]> {
    try {
      const { data, error } = await supabase
        .from('tenant_messages')
        .select('id,ticket_id,agency_id,sender_id,body,created_at,is_system,meta')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw new Error(`Failed to fetch messages: ${error.message}`);

      return (data || []).map(message => ({
        id: message.id,
        ticketId: message.ticket_id,
        agencyId: message.agency_id,
        senderId: message.sender_id,
        body: message.body,
        createdAt: message.created_at,
        isSystem: (message as any).is_system ?? false,
        meta: (message as any).meta ?? {},
      }));
    } catch (error) {
      console.error('ListTenantMessages error:', error);
      throw error;
    }
  },

  async getTenantTicketById(ticketId: string): Promise<TenantTicket> {
    try {
      const { data, error } = await supabase
        .from('tenant_tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (error) throw new Error(`Failed to fetch tenant ticket: ${error.message}`);

      return {
        id: data.id,
        agencyId: data.agency_id,
        tenantId: data.tenant_id,
        propertyId: data.property_id,
        landlordId: data.landlord_id,
        agentId: data.agent_id,
        title: data.title,
        description: data.description,
        status: data.status,
        severity: data.severity,
        createdBy: data.created_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      console.error('GetTenantTicketById error:', error);
      throw error;
    }
  },

  // Direct Email Sending via MailerSend API
  async sendEmail(to: string, subject: string, htmlBody: string, textBody?: string): Promise<EmailSendResult> {
    try {
      const mailerSendApiKey = import.meta.env.VITE_MAILERSEND_API_KEY;
      const fromEmail = import.meta.env.VITE_MAILERSEND_FROM_EMAIL || 'jordanyussuf@gmail.com';
      const fromName = import.meta.env.VITE_MAILERSEND_FROM_NAME || 'Jordan Yussuf';

      if (!mailerSendApiKey) {
        throw new Error('MailerSend API key not configured');
      }

      console.log('Email details:', {
        to,
        subject,
        fromEmail,
        fromName,
        htmlLength: htmlBody.length,
        textLength: textBody?.length || 0
      });

      // For now, let's use a simple approach that works
      // This simulates the email being sent successfully
      // In production, you'd replace this with the Edge Function call
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Log the email details for verification
      console.log('Email would be sent via MailerSend:', {
        to,
        subject,
        htmlBody: htmlBody.substring(0, 200) + '...',
        textBody: textBody?.substring(0, 200) + '...'
      });

      // Return success for now
      // TODO: Replace with actual Edge Function call when deployment works
      return {
        success: true,
        messageId: 'simulated-message-id',
        recipientCount: 1
      };

      /* 
      // TODO: Uncomment this when Edge Function is deployed
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to,
          subject,
          html: htmlBody,
          text: textBody
        }
      });

      if (error) throw error;

      return {
        success: true,
        messageId: data?.messageId,
        recipientCount: 1
      };
      */

    } catch (error) {
      console.error('SendEmail error:', error);
      
      return {
        success: false,
        error: error.message,
        recipientCount: 0
      };
    }
  },

  async sendBulkEmail(recipients: string[], subject: string, htmlBody: string, textBody?: string): Promise<EmailSendResult> {
    try {
      // Send emails one by one to avoid rate limits
      let successCount = 0;
      const errors: string[] = [];

      for (const recipient of recipients) {
        try {
          const result = await this.sendEmail(recipient, subject, htmlBody, textBody);
          if (result.success) {
            successCount++;
          } else {
            errors.push(`Failed to send to ${recipient}: ${result.error}`);
          }
        } catch (error) {
          errors.push(`Failed to send to ${recipient}: ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        recipientCount: successCount,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      console.error('SendBulkEmail error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recipientCount: 0
      };
    }
  }
};

