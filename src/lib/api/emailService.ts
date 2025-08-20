import { supabase } from './supabaseAdapter';
import { 
  WeeklySummary, 
  EmailTemplate, 
  EmailSendResult, 
  WeeklySummaryResult,
  Update,
  Landlord,
  Property,
  UpdateCategory
} from './types';
import { mailerSendService } from './mailerSendService';

export class EmailService {
  private static instance: EmailService;

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  // Generate weekly summaries for all landlords
  async generateWeeklySummaries(weekStart?: string): Promise<WeeklySummaryResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's agency
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) {
        throw new Error('User profile not found or no agency assigned');
      }

      // Calculate week dates
      const startDate = weekStart ? new Date(weekStart) : this.getWeekStart();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      // Get all landlords for the agency
      const { data: landlords } = await supabase
        .from('landlords')
        .select('*')
        .eq('agency_id', profile.agency_id);

      if (!landlords) return { summaries: [], emailsSent: 0, errors: [] };

      const summaries: WeeklySummary[] = [];
      const errors: string[] = [];

      for (const landlord of landlords) {
        try {
          const summary = await this.generateLandlordSummary(
            landlord,
            startDate,
            endDate,
            profile.agency_id
          );
          if (summary) {
            summaries.push(summary);
          }
        } catch (error) {
          errors.push(`Failed to generate summary for ${landlord.name}: ${error}`);
        }
      }

      return { summaries, emailsSent: 0, errors };
    } catch (error) {
      console.error('GenerateWeeklySummaries error:', error);
      throw error;
    }
  }

  // Send weekly summaries to all landlords
  async sendWeeklySummaries(weekStart?: string): Promise<EmailSendResult> {
    try {
      const { summaries } = await this.generateWeeklySummaries(weekStart);
      let emailsSent = 0;
      const errors: string[] = [];

      for (const summary of summaries) {
        try {
          const result = await this.sendWeeklySummaryEmail(summary);
          if (result.success) {
            emailsSent += result.recipientCount;
            // Mark summary as sent
            await this.markSummaryAsSent(summary.id);
          } else {
            errors.push(`Failed to send summary for ${summary.landlordId}: ${result.error}`);
          }
        } catch (error) {
          errors.push(`Error sending summary for ${summary.landlordId}: ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        recipientCount: emailsSent,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      console.error('SendWeeklySummaries error:', error);
      throw error;
    }
  }

  // Generate summary for a specific landlord
  private async generateLandlordSummary(
    landlord: any,
    startDate: Date,
    endDate: Date,
    agencyId: string
  ): Promise<WeeklySummary | null> {
    // Get all updates for this landlord in the date range
    const { data: updates } = await supabase
      .from('updates')
      .select(`
        *,
        properties!inner(address_line1, city, postcode)
      `)
      .eq('landlord_id', landlord.id)
      .eq('agency_id', agencyId)
      .gte('event_date', startDate.toISOString())
      .lte('event_date', endDate.toISOString())
      .order('event_date', { ascending: false });

    if (!updates || updates.length === 0) {
      return null; // No updates for this week
    }

    // Calculate summary statistics
    const totalCostPennies = updates.reduce((sum, update) => sum + (update.cost_pennies || 0), 0);
    const updatesByCategory: Record<UpdateCategory, number> = {
      maintenance: 0,
      rent: 0,
      inspection: 0,
      general: 0
    };

    const propertiesWithUpdates = new Set<string>();
    
    updates.forEach(update => {
      updatesByCategory[update.category]++;
      propertiesWithUpdates.add(update.property_id);
    });

    // Create or update summary record
    const summaryData = {
      agency_id: agencyId,
      landlord_id: landlord.id,
      week_start: startDate.toISOString(),
      week_end: endDate.toISOString(),
      total_updates: updates.length,
      total_cost_pennies: totalCostPennies,
      updates_by_category: updatesByCategory,
      properties_with_updates: Array.from(propertiesWithUpdates)
    };

    const { data: existingSummary } = await supabase
      .from('weekly_summaries')
      .select('id')
      .eq('landlord_id', landlord.id)
      .eq('week_start', startDate.toISOString())
      .single();

    if (existingSummary) {
      // Update existing summary
      const { data } = await supabase
        .from('weekly_summaries')
        .update(summaryData)
        .eq('id', existingSummary.id)
        .select()
        .single();

      return this.mapSummaryFromDB(data);
    } else {
      // Create new summary
      const { data } = await supabase
        .from('weekly_summaries')
        .insert([{ ...summaryData, id: crypto.randomUUID() }])
        .select()
        .single();

      return this.mapSummaryFromDB(data);
    }
  }

  // Send email for a specific weekly summary
  private async sendWeeklySummaryEmail(summary: WeeklySummary): Promise<EmailSendResult> {
    try {
      // Get landlord details
      const { data: landlord } = await supabase
        .from('landlords')
        .select('*')
        .eq('id', summary.landlordId)
        .single();

      if (!landlord) {
        throw new Error('Landlord not found');
      }

      // Get default email template
      const { data: template } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_default', true)
        .single();

      if (!template) {
        throw new Error('No default email template found');
      }

      // Generate email content
      const emailContent = this.generateWeeklySummaryEmail(
        landlord,
        summary,
        template
      );

      // Send email using Supabase Edge Functions or external service
      const result = await this.sendEmail(
        landlord.email,
        emailContent.subject,
        emailContent.htmlBody,
        emailContent.textBody
      );

      return result;
    } catch (error) {
      console.error('SendWeeklySummaryEmail error:', error);
      throw error;
    }
  }

  // Generate email content for weekly summary
  private generateWeeklySummaryEmail(
    landlord: any,
    summary: WeeklySummary,
    template: any
  ): { subject: string; htmlBody: string; textBody: string } {
    const weekStart = new Date(summary.weekStart);
    const weekEnd = new Date(summary.weekEnd);
    
    const subject = template.subject
      .replace('{{landlord_name}}', landlord.name)
      .replace('{{week_start}}', weekStart.toLocaleDateString())
      .replace('{{week_end}}', weekEnd.toLocaleDateString());

    const totalCost = (summary.totalCostPennies / 100).toFixed(2);
    
    const htmlBody = template.html_body
      .replace('{{landlord_name}}', landlord.name)
      .replace('{{week_start}}', weekStart.toLocaleDateString())
      .replace('{{week_end}}', weekEnd.toLocaleDateString())
      .replace('{{total_updates}}', summary.totalUpdates.toString())
      .replace('{{total_cost}}', `£${totalCost}`)
      .replace('{{maintenance_count}}', summary.updatesByCategory.maintenance.toString())
      .replace('{{rent_count}}', summary.updatesByCategory.rent.toString())
      .replace('{{inspection_count}}', summary.updatesByCategory.inspection.toString())
      .replace('{{general_count}}', summary.updatesByCategory.general.toString());

    const textBody = template.text_body
      .replace('{{landlord_name}}', landlord.name)
      .replace('{{week_start}}', weekStart.toLocaleDateString())
      .replace('{{week_end}}', weekEnd.toLocaleDateString())
      .replace('{{total_updates}}', summary.totalUpdates.toString())
      .replace('{{total_cost}}', `£${totalCost}`)
      .replace('{{maintenance_count}}', summary.updatesByCategory.maintenance.toString())
      .replace('{{rent_count}}', summary.updatesByCategory.rent.toString())
      .replace('{{inspection_count}}', summary.updatesByCategory.inspection.toString())
      .replace('{{general_count}}', summary.updatesByCategory.general.toString());

    return { subject, htmlBody, textBody };
  }

  // Send individual email
  async sendEmail(
    to: string, 
    subject: string, 
    htmlBody: string, 
    textBody?: string
  ): Promise<EmailSendResult> {
    try {
      // Use Supabase Edge Functions for email sending
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to,
          subject,
          html: htmlBody,
          text: textBody || this.stripHtml(htmlBody)
        }
      });

      if (error) throw error;

      return {
        success: true,
        messageId: data?.messageId,
        recipientCount: 1
      };
    } catch (error) {
      console.error('SendEmail error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recipientCount: 0
      };
    }
  }

  // Send bulk emails
  async sendBulkEmail(
    recipients: string[], 
    subject: string, 
    htmlBody: string, 
    textBody?: string
  ): Promise<EmailSendResult> {
    try {
      const results = await Promise.allSettled(
        recipients.map(recipient => 
          this.sendEmail(recipient, subject, htmlBody, textBody)
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failed = results.filter(r => r.status === 'rejected' || !r.value?.success);

      return {
        success: failed.length === 0,
        recipientCount: successful.length,
        error: failed.length > 0 ? `${failed.length} emails failed to send` : undefined
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

  // Get weekly summary for a landlord
  async getWeeklySummary(landlordId: string, weekStart: string): Promise<WeeklySummary | null> {
    try {
      const { data, error } = await supabase
        .from('weekly_summaries')
        .select('*')
        .eq('landlord_id', landlordId)
        .eq('week_start', weekStart)
        .single();

      if (error || !data) return null;

      return this.mapSummaryFromDB(data);
    } catch (error) {
      console.error('GetWeeklySummary error:', error);
      return null;
    }
  }

  // List weekly summaries
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

      return data.map(this.mapSummaryFromDB);
    } catch (error) {
      console.error('ListWeeklySummaries error:', error);
      throw error;
    }
  }

  // Email template management
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name');

      if (error) throw error;

      return data.map(this.mapTemplateFromDB);
    } catch (error) {
      console.error('GetEmailTemplates error:', error);
      throw error;
    }
  }

  async createEmailTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate> {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .insert([{ ...template, id: crypto.randomUUID() }])
        .select()
        .single();

      if (error) throw error;

      return this.mapTemplateFromDB(data);
    } catch (error) {
      console.error('CreateEmailTemplate error:', error);
      throw error;
    }
  }

  async updateEmailTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return this.mapTemplateFromDB(data);
    } catch (error) {
      console.error('UpdateEmailTemplate error:', error);
      throw error;
    }
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('DeleteEmailTemplate error:', error);
      throw error;
    }
  }

  // Helper methods
  private getWeekStart(date: Date = new Date()): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  private markSummaryAsSent(summaryId: string): Promise<void> {
    return supabase
      .from('weekly_summaries')
      .update({
        sent_at: new Date().toISOString(),
        sent_channel: 'email'
      })
      .eq('id', summaryId);
  }

  private mapSummaryFromDB(data: any): WeeklySummary {
    return {
      id: data.id,
      agencyId: data.agency_id,
      landlordId: data.landlord_id,
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
  }

  private mapTemplateFromDB(data: any): EmailTemplate {
    return {
      id: data.id,
      agencyId: data.agency_id,
      name: data.name,
      subject: data.subject,
      htmlBody: data.html_body,
      textBody: data.text_body,
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}

export const emailService = EmailService.getInstance(); 