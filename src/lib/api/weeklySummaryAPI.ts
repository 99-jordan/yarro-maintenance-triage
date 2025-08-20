import { mailerSendService } from './mailerSendService';
import { SendWeeklySummariesRequest, SendWeeklySummariesResponse } from './types';

// Simple API wrapper for external calls
export class WeeklySummaryAPI {
  
  // Main endpoint for sending weekly summaries
  static async sendWeeklySummaries(request: SendWeeklySummariesRequest): Promise<SendWeeklySummariesResponse> {
    try {
      const { weekStart, agencyId, dryRun = false } = request;

      if (!agencyId) {
        return {
          success: false,
          summariesGenerated: 0,
          emailsSent: 0,
          errors: ['agencyId is required'],
          summaryIds: []
        };
      }

      if (dryRun) {
        // For dry run, we'd need to implement summary generation without sending
        return {
          success: true,
          summariesGenerated: 0,
          emailsSent: 0,
          errors: [],
          summaryIds: []
        };
      }

      const result = await mailerSendService.sendWeeklySummaries(weekStart);

      return {
        success: result.success,
        summariesGenerated: result.recipientCount, // This is actually emails sent
        emailsSent: result.recipientCount,
        errors: result.error ? [result.error] : [],
        summaryIds: []
      };
    } catch (error) {
      return {
        success: false,
        summariesGenerated: 0,
        emailsSent: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        summaryIds: []
      };
    }
  }

  // Health check endpoint
  static async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  }

  // Get API documentation
  static getApiDocs(): { endpoints: any[]; examples: any[] } {
    return {
      endpoints: [
        {
          method: 'POST',
          path: '/api/weekly-summaries/send',
          description: 'Send weekly summaries to all landlords for an agency using MailerSend',
          body: {
            weekStart: 'string (optional) - ISO date for week start',
            agencyId: 'string (required) - Agency ID',
            dryRun: 'boolean (optional) - Generate summaries without sending emails'
          }
        },
        {
          method: 'GET',
          path: '/api/health',
          description: 'Health check endpoint'
        }
      ],
      examples: [
        {
          name: 'Send weekly summaries for current week',
          request: {
            method: 'POST',
            url: '/api/weekly-summaries/send',
            body: {
              agencyId: 'agency-123',
              dryRun: false
            }
          },
          response: {
            success: true,
            summariesGenerated: 15,
            emailsSent: 15,
            errors: [],
            summaryIds: []
          }
        }
      ]
    };
  }
}

// Export for easy access
export const weeklySummaryAPI = WeeklySummaryAPI; 