import { useEffect, useState, useRef } from "react";
import { useApi } from "@/hooks/useApi";
import { TenantTicket, TenantMessage, UpdateStatus } from "@/lib/api/types";
import { subscribeToPropertyFeed } from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Clock, AlertCircle, CheckCircle2, User, Wrench, MessageCircle, Bot, UserRound, X } from "lucide-react";
import AIHelpPanel from './AIHelpPanel';
import { supabase } from '@/lib/api/supabaseAdapter';
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface TicketThreadProps {
  ticket: TenantTicket;
  onChanged: () => void;
  mode?: 'ai' | 'agent';
  onModeChange?: (mode: 'ai' | 'agent') => void;
  viewerRole?: 'tenant' | 'agent'; // To determine if viewer is tenant or agent
  onClose?: () => void; // For closing the dialog in agent mode
}

const TicketThread = ({ ticket, onChanged, mode = 'ai', onModeChange, viewerRole = 'tenant', onClose }: TicketThreadProps) => {
  const api = useApi();
  const { toast } = useToast();
  const [messages, setMessages] = useState<TenantMessage[]>([]);
  const isSystem = (m: TenantMessage) => (m as any).isSystem === true;
  const isFromTenant = (senderId: string) => senderId === ticket.tenantId;
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    
    // Subscribe to realtime updates for this ticket's messages
    const unsubscribe = subscribeToPropertyFeed(ticket.propertyId, () => {
      loadMessages();
      onChanged();
    });
    // Directly subscribe to this ticket's message changes for true chat realtime
    const channel = supabase
      .channel(`tenant_messages_${ticket.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenant_messages', filter: `ticket_id=eq.${ticket.id}` }, () => {
        loadMessages();
        onChanged();
      })
      .subscribe();
    
    return () => {
      unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [ticket.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const messageList = await api.listTenantMessages(ticket.id);
      setMessages(messageList);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      await api.sendTenantMessage(ticket.id, newMessage.trim());
      setNewMessage("");
      toast({
        title: "Message Sent",
        description: "Your message has been sent to the property management team."
      });
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Send Failed",
        description: "Failed to send your message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'in_progress':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'resolved':
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
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
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

  // moved above as function

  return (
    <div className={`${viewerRole === 'agent' ? 'h-[85vh]' : 'h-full'} flex justify-center bg-gray-50`}>
      <div className="w-full max-w-4xl flex flex-col h-full">
        {/* Header - ChatGPT style */}
        <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200">
          <div className="relative">
            {viewerRole === 'agent' && onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="absolute right-0 top-0 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <div className="text-center">
              <h1 className="text-xl font-medium text-gray-900">{ticket.title}</h1>
              <div className="flex items-center justify-center space-x-3 mt-1 text-sm text-gray-500">
                <span className="capitalize">{ticket.severity} priority</span>
                <span>•</span>
                <span className="capitalize">{ticket.status.replace('_', ' ')}</span>
                <span>•</span>
                <span>{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Messages - ChatGPT center column style */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          <div className="messages-container max-w-3xl mx-auto px-6 py-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="text-sm text-gray-500 font-medium">Loading conversation...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                <MessageCircle className="h-10 w-10 text-indigo-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Start the conversation</h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                Send a message to communicate with your property manager or use the AI troubleshooter below.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="group">
                {isFromTenant(m.senderId) ? (
                  /* Tenant messages - right aligned */
                  <div className="flex justify-end">
                    <div className="flex items-start space-x-3 max-w-[75%]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-end space-x-2 mb-1">
                          <span className="text-xs text-gray-500">
                            {format(new Date(m.createdAt), 'h:mm a')}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {viewerRole === 'agent' ? 'Tenant' : 'You'}
                          </span>
                        </div>
                        
                        <div className="bg-blue-600 text-white rounded-lg px-4 py-3">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                          
                          {/* Show image if present */}
                          {(m as any).meta?.imageUrl && (
                            <div className="mt-3">
                              <img 
                                src={(m as any).meta.imageUrl} 
                                alt="Attachment" 
                                className="max-w-64 rounded-lg border border-white/20"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-medium">
                            T
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* AI/Agent messages - left aligned */
                  <div className="flex items-start space-x-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={`text-xs font-medium ${
                          isSystem(m) ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {isSystem(m) ? 'AI' : 'A'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    
                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {isSystem(m) ? 'AI Assistant' : 'Property Manager'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(m.createdAt), 'h:mm a')}
                        </span>
                      </div>
                      
                      <div className={`rounded-lg px-4 py-3 ${
                        isSystem(m) 
                          ? 'bg-gray-50 border border-gray-200' 
                          : 'bg-green-50 border border-green-200'
                      }`}>
                        <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{m.body}</p>
                        
                        {/* Show image if present */}
                        {(m as any).meta?.imageUrl && (
                          <div className="mt-3">
                            <img 
                              src={(m as any).meta.imageUrl} 
                              alt="Attachment" 
                              className="max-w-64 rounded-lg border border-gray-200"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        </div>
        
        {/* AI Panel - only show in AI mode, centered */}
        {mode === 'ai' && (
          <div className="border-t border-gray-200 bg-white">
            <div className="max-w-3xl mx-auto px-6 py-4">
              <AIHelpPanel ticketId={ticket.id} tenantId={ticket.tenantId} onNewMessage={loadMessages} />
            </div>
          </div>
        )}

        {/* Message Input - ChatGPT style bottom */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white">
          <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="relative">
              {/* Mode Switch Buttons - integrated into input area */}
              {onModeChange && (
                <div className="absolute -top-10 left-0 flex space-x-1 mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onModeChange('ai')}
                    className={`text-xs px-3 py-1 ${
                      mode === 'ai' 
                        ? 'bg-gray-100 text-gray-900' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Bot className="h-3 w-3 mr-1" />
                    AI
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onModeChange('agent')}
                    className={`text-xs px-3 py-1 ${
                      mode === 'agent' 
                        ? 'bg-gray-100 text-gray-900' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <UserRound className="h-3 w-3 mr-1" />
                    Agent
                  </Button>
                </div>
              )}
              
              <div className="flex items-end space-x-3">
                <div className="flex-1 relative">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={mode === 'ai' ? "Message AI assistant..." : "Message property management..."}
                    disabled={sending}
                    className="w-full rounded-xl border-gray-300 focus:border-gray-400 focus:ring-gray-400 px-4 py-3 pr-12 resize-none"
                  />
                </div>
                <Button
                  onClick={mode === 'ai' ? undefined : handleSendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="rounded-lg px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketThread;

