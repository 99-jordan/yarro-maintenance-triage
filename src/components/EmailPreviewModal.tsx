import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Send, Eye, FileText, Calendar, DollarSign, AlertTriangle, TrendingUp, Minus, Clock } from 'lucide-react';
import { Update, Landlord } from '@/lib/api/types';
import { format } from 'date-fns';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: () => Promise<void>;
  update?: Update;
  landlord?: Landlord;
  emailType: 'update' | 'weekly-summary';
  weeklySummary?: any;
  loading?: boolean;
}

const EmailPreviewModal = ({ 
  isOpen, 
  onClose, 
  onSend, 
  update, 
  landlord, 
  emailType, 
  weeklySummary,
  loading = false 
}: EmailPreviewModalProps) => {
  const [activeTab, setActiveTab] = useState('preview');

  const generateUpdateEmailContent = () => {
    if (!update || !landlord) return { subject: '', htmlBody: '', textBody: '' };

    const eventDate = new Date(update.eventDate);
    const cost = update.costPennies ? (update.costPennies / 100).toFixed(2) : null;
    
    const subject = `Property Update: ${update.title}`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Property Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .update-details { background: #fff; padding: 20px; border: 1px solid #e9ecef; border-radius: 6px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #f1f3f4; }
          .detail-label { font-weight: bold; color: #6c757d; }
          .detail-value { color: #333; }
          .priority-high { color: #dc3545; }
          .priority-normal { color: #28a745; }
          .priority-low { color: #6c757d; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Property Update</h1>
            <p>Dear ${landlord.name},</p>
            <p>Here's an update regarding your property:</p>
          </div>
          
          <div class="update-details">
            <div class="detail-row">
              <span class="detail-label">Title:</span>
              <span class="detail-value">${update.title}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Category:</span>
              <span class="detail-value">${update.category.charAt(0).toUpperCase() + update.category.slice(1)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Priority:</span>
              <span class="detail-value priority-${update.priority}">${update.priority.charAt(0).toUpperCase() + update.priority.slice(1)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${eventDate.toLocaleDateString()}</span>
            </div>
            ${cost ? `
            <div class="detail-row">
              <span class="detail-label">Cost:</span>
              <span class="detail-value">£${cost}</span>
            </div>
            ` : ''}
            <div class="detail-row" style="border-bottom: none;">
              <span class="detail-label">Description:</span>
              <span class="detail-value">${update.description}</span>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated update from your property management team.</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
Property Update

Dear ${landlord.name},

Here's an update regarding your property:

Title: ${update.title}
Category: ${update.category.charAt(0).toUpperCase() + update.category.slice(1)}
Priority: ${update.priority.charAt(0).toUpperCase() + update.priority.slice(1)}
Date: ${eventDate.toLocaleDateString()}
${cost ? `Cost: £${cost}` : ''}
Description: ${update.description}

This is an automated update from your property management team.
If you have any questions, please don't hesitate to contact us.
    `;

    return { subject, htmlBody, textBody };
  };

  const generateWeeklySummaryEmailContent = () => {
    if (!landlord || !weeklySummary) return { subject: '', htmlBody: '', textBody: '' };

    const weekStart = new Date(weeklySummary.weekStart);
    const weekEnd = new Date(weeklySummary.weekEnd);
    const totalCost = (weeklySummary.totalCostPennies / 100).toFixed(2);
    
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
              <div class="summary-number">${weeklySummary.totalUpdates}</div>
              <div class="summary-label">Total Updates</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">£${totalCost}</div>
              <div class="summary-label">Total Cost</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">${weeklySummary.updatesByCategory.maintenance}</div>
              <div class="summary-label">Maintenance</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">${weeklySummary.updatesByCategory.rent}</div>
              <div class="summary-label">Rent</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">${weeklySummary.updatesByCategory.inspection}</div>
              <div class="summary-label">Inspections</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">${weeklySummary.updatesByCategory.general}</div>
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
- Total Updates: ${weeklySummary.totalUpdates}
- Total Cost: £${totalCost}
- Maintenance: ${weeklySummary.updatesByCategory.maintenance}
- Rent: ${weeklySummary.updatesByCategory.rent}
- Inspections: ${weeklySummary.updatesByCategory.inspection}
- General: ${weeklySummary.updatesByCategory.general}

This is an automated weekly summary from your property management team.
If you have any questions, please don't hesitate to contact us.
    `;

    return { subject, htmlBody, textBody };
  };

  const getEmailContent = () => {
    if (emailType === 'update') {
      return generateUpdateEmailContent();
    } else {
      return generateWeeklySummaryEmailContent();
    }
  };

  const emailContent = getEmailContent();

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'maintenance': return <AlertTriangle className="h-4 w-4" />;
      case 'rent': return <DollarSign className="h-4 w-4" />;
      case 'inspection': return <Eye className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <TrendingUp className="h-4 w-4" />;
      case 'normal': return <Clock className="h-4 w-4" />;
      case 'low': return <Minus className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleSend = async () => {
    await onSend();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Preview
          </DialogTitle>
          <DialogDescription>
            Preview the email before sending to {landlord?.name || 'landlord'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="html" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                HTML
              </TabsTrigger>
              <TabsTrigger value="text" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Text
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 h-[calc(90vh-200px)] overflow-y-auto">
              <TabsContent value="preview" className="h-full">
                <div className="bg-white border rounded-lg p-4">
                  <div className="mb-4 pb-4 border-b">
                    <h3 className="font-semibold text-lg mb-2">To: {landlord?.email}</h3>
                    <h4 className="font-medium text-gray-700">Subject: {emailContent.subject}</h4>
                  </div>
                  
                  {emailType === 'update' && update && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {getCategoryIcon(update.category)}
                        <span className="font-medium capitalize">{update.category}</span>
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getPriorityIcon(update.priority)}
                          {update.priority}
                        </Badge>
                      </div>
                      <h3 className="font-semibold mb-2">{update.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {format(new Date(update.eventDate), 'MMM d, yyyy')}
                        {update.costPennies && ` • £${(update.costPennies / 100).toFixed(2)}`}
                      </p>
                      <p className="text-sm">{update.description}</p>
                    </div>
                  )}

                  {emailType === 'weekly-summary' && weeklySummary && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold mb-2">Weekly Summary</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Total Updates:</span> {weeklySummary.totalUpdates}
                        </div>
                        <div>
                          <span className="font-medium">Total Cost:</span> £{(weeklySummary.totalCostPennies / 100).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Maintenance:</span> {weeklySummary.updatesByCategory.maintenance}
                        </div>
                        <div>
                          <span className="font-medium">Rent:</span> {weeklySummary.updatesByCategory.rent}
                        </div>
                      </div>
                    </div>
                  )}

                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: emailContent.htmlBody }}
                  />
                </div>
              </TabsContent>

              <TabsContent value="html" className="h-full">
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto h-full">
                  <pre>{emailContent.htmlBody}</pre>
                </div>
              </TabsContent>

              <TabsContent value="text" className="h-full">
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto h-full">
                  <pre>{emailContent.textBody}</pre>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={loading}
            className="bg-gradient-primary"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailPreviewModal; 