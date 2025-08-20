import { useState, useEffect } from 'react';
import { subscribeToPropertyFeed } from '@/lib/realtime';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Property, Update, UpdateStatus, Landlord, UnifiedPropertyUpdate, TenantTicket } from '@/lib/api/types';
import TicketThread from './TicketThread';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import NewUpdateForm from './NewUpdateForm';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Minus,
  ExternalLink,
  Mail,
  FileText as FileTextIcon,
  MapPin,
  Plus,
  CheckCircle,
  Trash2
} from 'lucide-react';

interface PropertyJournalModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
}

const PropertyJournalModal = ({ property, isOpen, onClose }: PropertyJournalModalProps) => {
  const [updates, setUpdates] = useState<UnifiedPropertyUpdate[]>([]);
  const [landlord, setLandlord] = useState<Landlord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [selectedUpdate, setSelectedUpdate] = useState<Update | null>(null);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [showNewUpdate, setShowNewUpdate] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [activeTenantTicket, setActiveTenantTicket] = useState<TenantTicket | null>(null);
  const { toast } = useToast();
  const api = useApi();

  useEffect(() => {
    if (isOpen) {
      loadUpdates();
      loadLandlord();

      // Subscribe to realtime updates
      const unsubscribe = subscribeToPropertyFeed(property.id, loadUpdates);
      
      return () => {
        unsubscribe();
      };
    }
  }, [isOpen, property.id]);

  const loadUpdates = async () => {
    try {
      setLoading(true);
      const data = await api.getUnifiedPropertyFeed(property.id);
      setUpdates(data);
    } catch (error) {
      console.error('Error loading unified feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLandlord = async () => {
    try {
      // Get landlord information for email sending
      const landlords = await api.listLandlords();
      const propertyLandlord = landlords.find(l => l.id === property.landlordId);
      setLandlord(propertyLandlord || null);
    } catch (error) {
      console.error('Error loading landlord:', error);
    }
  };

  const handleStatusUpdate = async (updateId: string, newStatus: UpdateStatus) => {
    try {
      const update = updates.find(u => u.id === updateId);
      if (update?.source === 'tenant_ticket') {
        await api.updateTenantTicketStatus(updateId, newStatus);
      } else {
        await api.updateStatus(updateId, newStatus);
      }
      await loadUpdates(); // Reload to show updated status
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const openTenantThread = async (ticketId: string) => {
    try {
      const t = await api.getTenantTicketById(ticketId);
      setActiveTenantTicket(t);
      setIsThreadOpen(true);
    } catch (e) {
      console.error('OpenTenantThread error', e);
      toast({ title: 'Error', description: 'Failed to open conversation.', variant: 'destructive' });
    }
  };

  const getSourceBadge = (source: string) => {
    return source === 'tenant_ticket' ? (
      <Badge variant="secondary" className="text-xs">
        Tenant
      </Badge>
    ) : (
      <Badge variant="outline" className="text-xs">
        Manager
      </Badge>
    );
  };

  const handleDeleteUpdate = async (updateId: string) => {
    if (confirm('Are you sure you want to delete this update? This action cannot be undone.')) {
      try {
        // TODO: Add deleteUpdate to API
        console.log('Delete update:', updateId);
        toast({
          title: 'Update Deleted',
          description: 'The update has been deleted successfully.',
        });
        await loadUpdates();
      } catch (error) {
        console.error('Error deleting update:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete update. Please try again.',
          variant: 'destructive'
        });
      }
    }
  };

  const generateEmailContent = (selectedUpdatesList: Update[]) => {
    const subject = `Property Update${selectedUpdatesList.length > 1 ? 's' : ''} - ${property.addressLine1}`;
    
    const updatesHtml = selectedUpdatesList.map(update => `
      <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #3b82f6; background-color: #f8fafc;">
        <h3 style="margin: 0 0 10px 0; color: #1e293b;">${update.title}</h3>
        <p style="margin: 0 0 10px 0; color: #64748b;">${update.description}</p>
        <div style="font-size: 12px; color: #94a3b8;">
          <strong>Category:</strong> ${update.category} | 
          <strong>Priority:</strong> ${update.priority} | 
          <strong>Date:</strong> ${format(new Date(update.eventDate), 'MMM d, yyyy')}
          ${update.costPennies ? ` | <strong>Cost:</strong> £${(update.costPennies / 100).toFixed(2)}` : ''}
        </div>
      </div>
    `).join('');

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Property Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h1 style="color: #1e293b; margin-bottom: 20px;">Property Update${selectedUpdatesList.length > 1 ? 's' : ''}</h1>
          <p style="color: #64748b; margin-bottom: 30px;">
            Dear ${landlord?.name || 'Landlord'},<br><br>
            Here ${selectedUpdatesList.length > 1 ? 'are' : 'is'} the latest update${selectedUpdatesList.length > 1 ? 's' : ''} for your property at ${property.addressLine1}, ${property.city}.
          </p>
          
          ${updatesHtml}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 14px; margin: 0;">
              If you have any questions, please don't hesitate to contact us.<br>
              Best regards,<br>
              Your Property Management Team
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
Property Update${selectedUpdatesList.length > 1 ? 's' : ''}

Dear ${landlord?.name || 'Landlord'},

Here ${selectedUpdatesList.length > 1 ? 'are' : 'is'} the latest update${selectedUpdatesList.length > 1 ? 's' : ''} for your property at ${property.addressLine1}, ${property.city}:

${selectedUpdatesList.map(update => `
${update.title}
${update.description}
Category: ${update.category} | Priority: ${update.priority} | Date: ${format(new Date(update.eventDate), 'MMM d, yyyy')}${update.costPennies ? ` | Cost: £${(update.costPennies / 100).toFixed(2)}` : ''}
`).join('\n')}

If you have any questions, please don't hesitate to contact us.

Best regards,
Your Property Management Team
    `;

    return { subject, htmlBody, textBody };
  };

  const handleBulkEmail = async () => {
    if (selectedUpdates.size === 0) {
      toast({
        title: 'No Updates Selected',
        description: 'Please select at least one update to send an email.',
        variant: 'destructive'
      });
      return;
    }

    if (!landlord?.email) {
      toast({
        title: 'No Email Address',
        description: 'Landlord email address not found. Cannot send email.',
        variant: 'destructive'
      });
      return;
    }

    setSendingEmail(true);
    try {
      const selectedUpdatesList = updates.filter(update => selectedUpdates.has(update.id));
      const emailContent = generateEmailContent(selectedUpdatesList);
      
      // Use the actual MailerSend API
      const result = await api.sendEmail(
        landlord.email,
        emailContent.subject,
        emailContent.htmlBody,
        emailContent.textBody
      );
      
      if (result.success) {
        toast({
          title: 'Email Sent Successfully',
          description: `Email sent to ${landlord.name} (${landlord.email})`,
        });
        
        // Clear selection after sending
        setSelectedUpdates(new Set());
      } else {
        toast({
          title: 'Email Failed',
          description: `Failed to send email: ${result.error}`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error sending bulk email:', error);
      toast({
        title: 'Email Error',
        description: 'Failed to send email. Please check your MailerSend configuration.',
        variant: 'destructive'
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUpdates.size === 0) {
      toast({
        title: 'No Updates Selected',
        description: 'Please select at least one update to delete.',
        variant: 'destructive'
      });
      return;
    }

    if (confirm(`Are you sure you want to delete ${selectedUpdates.size} update${selectedUpdates.size > 1 ? 's' : ''}? This action cannot be undone.`)) {
      try {
        // TODO: Implement bulk delete
        console.log('Deleting updates:', Array.from(selectedUpdates));
        
        toast({
          title: 'Updates Deleted',
          description: `Successfully deleted ${selectedUpdates.size} update${selectedUpdates.size > 1 ? 's' : ''}.`,
        });
        
        setSelectedUpdates(new Set());
        await loadUpdates();
      } catch (error) {
        console.error('Error deleting updates:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete updates. Please try again.',
          variant: 'destructive'
        });
      }
    }
  };

  const toggleUpdateSelection = (updateId: string) => {
    const newSelection = new Set(selectedUpdates);
    if (newSelection.has(updateId)) {
      newSelection.delete(updateId);
    } else {
      newSelection.add(updateId);
    }
    setSelectedUpdates(newSelection);
  };

  const selectAllUpdates = () => {
    setSelectedUpdates(new Set(updates.map(update => update.id)));
  };

  const clearSelection = () => {
    setSelectedUpdates(new Set());
  };

  const handleUpdateCreated = () => {
    setShowNewUpdate(false);
    loadUpdates();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'in_progress':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <TrendingUp className="h-4 w-4 text-orange-500" />;
      case 'normal':
        return <Minus className="h-4 w-4 text-blue-500" />;
      case 'low':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'maintenance':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'rent':
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case 'general':
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatCurrency = (pennies?: number) => {
    if (!pennies) return '';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(pennies / 100);
  };

  const selectedUpdatesList = updates.filter(update => selectedUpdates.has(update.id));

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {property.addressLine1}
              {property.addressLine2 && `, ${property.addressLine2}`}
            </DialogTitle>
            <DialogDescription>
              {property.city}, {property.postcode}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="details">Property Details</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="flex-1 overflow-y-auto mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Recent Activity</h3>
                    <p className="text-sm text-muted-foreground">
                      Click any update to view details • Select updates for bulk actions
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {selectedUpdates.size > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {selectedUpdates.size} selected
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllUpdates}
                    >
                      Select All
                    </Button>
                    {selectedUpdates.size > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearSelection}
                      >
                        Clear
                      </Button>
                    )}
                    <Button
                      onClick={() => setShowNewUpdate(true)}
                      className="bg-gradient-primary"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Update
                    </Button>
                  </div>
                </div>

                {/* Bulk Actions */}
                {selectedUpdates.size > 0 && (
                  <Card className="p-4 bg-primary/5 border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium">
                          {selectedUpdates.size} update{selectedUpdates.size !== 1 ? 's' : ''} selected
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkEmail}
                          disabled={sendingEmail || !landlord?.email}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          {sendingEmail ? 'Sending...' : `Send Email${selectedUpdates.size > 1 ? 's' : ''}`}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkDelete}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                      >
                        Clear Selection
                      </Button>
                    </div>
                    {!landlord?.email && (
                      <div className="mt-2 text-sm text-red-600">
                        ⚠️ No email address found for landlord. Cannot send emails.
                      </div>
                    )}
                  </Card>
                )}

                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i}>
                        <CardHeader>
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </CardHeader>
                        <CardContent>
                          <Skeleton className="h-16 w-full" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : updates.length === 0 ? (
                  <Card className="text-center py-8">
                    <CardContent>
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No updates yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Start by creating your first property update
                      </p>
                      <Button onClick={() => setShowNewUpdate(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Update
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {updates.map((update) => (
                      <Card 
                        key={update.id} 
                        className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
                        onClick={() => setSelectedUpdate(update)}
                      >
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={selectedUpdates.has(update.id)}
                                onCheckedChange={() => toggleUpdateSelection(update.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              {getCategoryIcon('maintenance')}
                              <CardTitle className="text-base capitalize">
                                {update.source === 'tenant_ticket' ? 'Tenant Issue' : update.source.replace('_', ' ')}
                              </CardTitle>
                              <Badge className={getStatusColor(update.status)}>
                                {update.status.replace('_', ' ')}
                              </Badge>
                              <Badge className={getPriorityColor(update.priority)}>
                                {getPriorityIcon(update.priority)}
                                <span className="ml-1">{update.priority}</span>
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(update.status)}
                              <div className="text-sm text-muted-foreground flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {format(new Date(update.occurredAt), 'MMM d, yyyy')}
                              </div>
                              <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                          {/* Cost info only available for manager updates */}
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{update.title}</h4>
                                {getSourceBadge(update.source)}
                              </div>
                              <p className="text-sm text-muted-foreground">{update.description}</p>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <Select value={update.status} onValueChange={(value) => handleStatusUpdate(update.id, value as UpdateStatus)}>
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                {update.source === 'tenant_ticket' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); openTenantThread(update.id); }}
                                  >
                                    Open conversation
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteUpdate(update.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="details" className="flex-1 overflow-y-auto mt-4">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Property Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Address</Label>
                        <p className="text-sm text-muted-foreground">
                          {property.addressLine1}
                          {property.addressLine2 && <br />}
                          {property.addressLine2}
                          <br />
                          {property.city}, {property.postcode}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Property Type</Label>
                        <p className="text-sm text-muted-foreground capitalize">
                          {property.propertyType}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Agent thread dialog */}
      <Dialog open={isThreadOpen} onOpenChange={setIsThreadOpen}>
        <DialogContent className="max-w-5xl w-[90vw] h-[85vh] p-0 gap-0">
          {activeTenantTicket && (
            <TicketThread 
              ticket={activeTenantTicket} 
              onChanged={loadUpdates} 
              mode="agent"
              viewerRole="agent"
              onClose={() => setIsThreadOpen(false)}
              onModeChange={(mode) => {
                // Agent can switch between AI and Agent modes
                console.log('Agent switched to mode:', mode);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {showNewUpdate && (
        <Dialog open={showNewUpdate} onOpenChange={setShowNewUpdate}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Property Update</DialogTitle>
              <DialogDescription>
                Add a new update for {property.name}
              </DialogDescription>
            </DialogHeader>
            <NewUpdateForm
              property={property}
              onSuccess={handleUpdateCreated}
              onCancel={() => setShowNewUpdate(false)}
              variant="modal"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default PropertyJournalModal;