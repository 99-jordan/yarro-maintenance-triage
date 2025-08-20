import { supabase } from './supabaseAdapter';
import { 
  MailerSendEmailRequest,
  MailerSendEmailResponse,
  EmailSendResult,
  WeeklySummary,
  UpdateCategory
} from './types';

// Get environment variables
const mailerSendApiKey = import.meta.env.VITE_MAILERSEND_API_KEY;
const mailerSendFromEmail = import.meta.env.VITE_MAILERSEND_FROM_EMAIL || 'noreply@youragency.com';
const mailerSendFromName = import.meta.env.VITE_MAILERSEND_FROM_NAME || 'Your Agency';

if (!mailerSendApiKey) {
  throw new Error('Missing MailerSend API key');
}

export class MailerSendService {
  private static instance: MailerSendService;
  private readonly apiUrl = 'https://api.mailersend.com/v1';
  private readonly apiKey: string;

  private constructor() {
    this.apiKey = mailerSendApiKey;
  }

  static getInstance(): MailerSendService {
    if (!MailerSendService.instance) {
      MailerSendService.instance = new MailerSendService();
    }
    return MailerSendService.instance;
  }

  // Send email via MailerSend API
  async sendEmail(
    to: string, 
    subject: string, 
    htmlBody: string, 
    textBody?: string
  ): Promise<EmailSendResult> {
    try {
      const request: MailerSendEmailRequest = {
        from: {
          email: mailerSendFromEmail,
          name: mailerSendFromName
        },
        to: [
          {
            email: to
          }
        ],
        subject,
        html: htmlBody,
        text: textBody || this.stripHtml(htmlBody)
      };

      const response = await fetch(`${this.apiUrl}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `MailerSend API returned ${response.status}`);
      }

      const result: MailerSendEmailResponse = await response.json();

      return {
        success: true,
        messageId: result.message_id,
        recipientCount: 1
      };
    } catch (error) {
      console.error('MailerSend sendEmail error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recipientCount: 0
      };
    }
  }

  // Send bulk emails via MailerSend API
  async sendBulkEmail(
    recipients: string[], 
    subject: string, 
    htmlBody: string, 
    textBody?: string
  ): Promise<EmailSendResult> {
    try {
      const request: MailerSendEmailRequest = {
        from: {
          email: mailerSendFromEmail,
          name: mailerSendFromName
        },
        to: recipients.map(email => ({ email })),
        subject,
        html: htmlBody,
        text: textBody || this.stripHtml(htmlBody)
      };

      const response = await fetch(`${this.apiUrl}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `MailerSend API returned ${response.status}`);
      }

      const result: MailerSendEmailResponse = await response.json();

      return {
        success: true,
        messageId: result.message_id,
        recipientCount: recipients.length
      };
    } catch (error) {
      console.error('MailerSend sendBulkEmail error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recipientCount: 0
      };
    }
  }

  // Send weekly summaries to all landlords
  async sendWeeklySummaries(weekStart?: string): Promise<EmailSendResult> {
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

      if (!landlords || landlords.length === 0) {
        return { success: true, recipientCount: 0 };
      }

      let emailsSent = 0;
      const errors: string[] = [];

      for (const landlord of landlords) {
        try {
          const summary = await this.generateLandlordSummary(
            landlord,
            startDate,
            endDate,
            profile.agency_id,
            user.id // Pass the current user's ID as agent_id
          );

          if (summary) {
            const emailContent = this.generateWeeklySummaryEmail(landlord, summary);
            const result = await this.sendEmail(
              landlord.email,
              emailContent.subject,
              emailContent.htmlBody,
              emailContent.textBody
            );

            if (result.success) {
              emailsSent++;
              await this.markSummaryAsSent(summary.id);
            } else {
              errors.push(`Failed to send email to ${landlord.name}: ${result.error}`);
            }
          }
        } catch (error) {
          errors.push(`Error processing ${landlord.name}: ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        recipientCount: emailsSent,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      console.error('SendWeeklySummaries error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recipientCount: 0
      };
    }
  }

  // Generate summary for a specific landlord
  private async generateLandlordSummary(
    landlord: any,
    startDate: Date,
    endDate: Date,
    agencyId: string,
    agentId: string // Add agent ID parameter
  ): Promise<WeeklySummary | null> {
    // Get all updates for this landlord in the date range
    const { data: updates } = await supabase
      .from('updates')
      .select('*')
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
      agent_id: agentId, // Include agent ID
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

  // Generate email content for weekly summary
  private generateWeeklySummaryEmail(landlord: any, summary: WeeklySummary) {
    const weekStart = new Date(summary.weekStart);
    const weekEnd = new Date(summary.weekEnd);
    const totalCost = (summary.totalCostPennies / 100).toFixed(2);
    
    const subject = `Weekly Property Update - ${weekStart.toLocaleDateString()} to ${weekEnd.toLocaleDateString()}`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Weekly Property Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
          .summary-item { background: #fff; padding: 15px; border: 1px solid #e9ecef; border-radius: 6px; text-align: center; }
          .summary-number { font-size: 24px; font-weight: bold; color: #007bff; }
          .summary-label { font-size: 14px; color: #6c757d; margin-top: 5px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Weekly Property Update</h1>
            <p>Dear ${landlord.name},</p>
            <p>Here's your weekly property update for the period <strong>${weekStart.toLocaleDateString()}</strong> to <strong>${weekEnd.toLocaleDateString()}</strong>.</p>
          </div>
          
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-number">${summary.totalUpdates}</div>
              <div class="summary-label">Total Updates</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">£${totalCost}</div>
              <div class="summary-label">Total Cost</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">${summary.updatesByCategory.maintenance}</div>
              <div class="summary-label">Maintenance</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">${summary.updatesByCategory.rent}</div>
              <div class="summary-label">Rent</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">${summary.updatesByCategory.inspection}</div>
              <div class="summary-label">Inspections</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">${summary.updatesByCategory.general}</div>
              <div class="summary-label">General</div>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated weekly summary from your property management team.</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
Weekly Property Update

Dear ${landlord.name},

Here's your weekly property update for the period ${weekStart.toLocaleDateString()} to ${weekEnd.toLocaleDateString()}.

Summary:
- Total Updates: ${summary.totalUpdates}
- Total Cost: £${totalCost}
- Maintenance: ${summary.updatesByCategory.maintenance}
- Rent: ${summary.updatesByCategory.rent}
- Inspections: ${summary.updatesByCategory.inspection}
- General: ${summary.updatesByCategory.general}

This is an automated weekly summary from your property management team.
If you have any questions, please don't hesitate to contact us.
    `;

    return { subject, htmlBody, textBody };
  }

  // Helper methods
  private getWeekStart(date: Date = new Date()): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}

export const mailerSendService = MailerSendService.getInstance(); 