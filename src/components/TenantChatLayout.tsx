import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { TenantTicket } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, MessageCircle, Clock, CheckCircle2, AlertCircle, User, Wrench, Home, LogOut, Bot, UserRound, ChevronLeft, ChevronRight } from 'lucide-react';
import TicketThread from './TicketThread';
import TenantTicketForm from './TenantTicketForm';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface TenantChatLayoutProps {
  propertyId: string;
  tenantId: string;
}

const TenantChatLayout = ({ propertyId, tenantId }: TenantChatLayoutProps) => {
  const [tickets, setTickets] = useState<TenantTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TenantTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [currentMode, setCurrentMode] = useState<'ai' | 'agent'>('ai');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const api = useApi();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadTickets();
  }, [propertyId]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const ticketList = await api.listTenantTickets(propertyId);
      setTickets(ticketList);
      // Auto-select first ticket if none selected
      if (!selectedTicket && ticketList.length > 0) {
        setSelectedTicket(ticketList[0]);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your tickets. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="h-3 w-3 text-emerald-500" />;
      case 'in_progress':
        return <AlertCircle className="h-3 w-3 text-amber-500" />;
      case 'resolved':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'normal':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'low':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/tenant/auth");
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out."
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleNewTicketSuccess = () => {
    setShowNewTicket(false);
    loadTickets();
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Home className="h-5 w-5 text-emerald-600" />
              {!sidebarCollapsed && <span className="font-semibold text-gray-900">Support Center</span>}
            </div>
            <div className="flex items-center space-x-2">
              {!sidebarCollapsed && (
                <Button
                  onClick={() => setShowNewTicket(true)}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-3"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Ticket
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="h-8 w-8 p-0"
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {!sidebarCollapsed && (
            <p className="text-sm text-gray-600">
              Manage your maintenance requests and get help from our AI assistant
            </p>
          )}
          {sidebarCollapsed && (
            <Button
              onClick={() => setShowNewTicket(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-2"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Tickets List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-3 bg-gray-100 rounded-lg animate-pulse">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No tickets yet</p>
                <p className="text-gray-400 text-xs">Create your first support ticket</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`cursor-pointer transition-all duration-200 border rounded-lg ${
                      selectedTicket?.id === ticket.id
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${sidebarCollapsed ? 'p-2' : 'p-3'}`}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    {sidebarCollapsed ? (
                      <div className="flex justify-center">
                        {getStatusIcon(ticket.status)}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center space-x-2 mb-1">
                          {getStatusIcon(ticket.status)}
                          <span className="text-sm font-medium text-gray-900 truncate flex-1">
                            {ticket.title}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{format(new Date(ticket.createdAt), 'MMM d')}</span>
                          <Badge className={`text-xs px-2 py-1 ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          {sidebarCollapsed ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full p-2 text-gray-500 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <User className="h-3 w-3" />
                <span>Tenant Portal</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-xs text-gray-500 hover:text-red-600"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {selectedTicket ? (
          <TicketThread 
            ticket={selectedTicket} 
            onChanged={loadTickets}
            mode={currentMode}
            onModeChange={setCurrentMode}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center">
                <MessageCircle className="h-12 w-12 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                Welcome to Support
              </h2>
              <p className="text-gray-600 mb-6">
                Select a ticket from the sidebar to view the conversation or create a new ticket to get help with maintenance issues.
              </p>
              <Button
                onClick={() => setShowNewTicket(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Ticket
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create New Ticket</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewTicket(false)}
              >
                ✕
              </Button>
            </div>
            <TenantTicketForm 
              propertyId={propertyId}
              onCreated={handleNewTicketSuccess}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantChatLayout;
