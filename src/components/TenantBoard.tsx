import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Property, TenantTicket } from "@/lib/api/types";
import TenantTicketForm from "./TenantTicketForm";
import TicketThread from "./TicketThread";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { subscribeToPropertyFeed } from "@/lib/realtime";

interface TenantBoardProps {
  property: Property;
}

const TenantBoard = ({ property }: TenantBoardProps) => {
  const api = useApi();
  const [tickets, setTickets] = useState<TenantTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<TenantTicket | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTickets();
    
    // Subscribe to realtime updates
    const unsubscribe = subscribeToPropertyFeed(property.id, loadTickets);
    return () => unsubscribe();
  }, [property.id]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const ticketList = await api.listTenantTickets(property.id);
      setTickets(ticketList);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketCreated = () => {
    setShowNewTicket(false);
    loadTickets();
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Tickets List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Maintenance Requests</h2>
            <p className="text-sm text-gray-600">Submit and track your maintenance issues</p>
          </div>
          <Button 
            onClick={() => setShowNewTicket(!showNewTicket)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {showNewTicket ? "Cancel" : "New Request"}
          </Button>
        </div>

        {showNewTicket && (
          <Card className="border-indigo-200">
            <CardHeader>
              <CardTitle className="text-lg">Submit Maintenance Request</CardTitle>
            </CardHeader>
            <CardContent>
              <TenantTicketForm 
                property={property} 
                onCreated={handleTicketCreated} 
              />
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your requests...</p>
            </div>
          ) : tickets.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No requests yet</h3>
                <p className="text-gray-600 mb-4">
                  Submit your first maintenance request to get started
                </p>
                <Button onClick={() => setShowNewTicket(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Request
                </Button>
              </CardContent>
            </Card>
          ) : (
            tickets.map((ticket) => (
              <Card 
                key={ticket.id} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  activeTicket?.id === ticket.id ? 'ring-2 ring-indigo-500 border-indigo-200' : 'hover:border-indigo-200'
                }`}
                onClick={() => setActiveTicket(ticket)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{ticket.title}</CardTitle>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(ticket.status)}
                      <Badge className={getStatusColor(ticket.status)}>
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <Badge className={getSeverityColor(ticket.severity)}>
                      {ticket.severity} priority
                    </Badge>
                    <span className="text-gray-500">
                      {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {ticket.description}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Ticket Thread */}
      <div className="lg:sticky lg:top-6">
        {activeTicket ? (
          <TicketThread 
            ticket={activeTicket} 
            onChanged={loadTickets} 
          />
        ) : (
          <Card className="h-96 flex items-center justify-center">
            <CardContent className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Request</h3>
              <p className="text-gray-600">
                Choose a maintenance request from the left to view details and messages
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TenantBoard;
