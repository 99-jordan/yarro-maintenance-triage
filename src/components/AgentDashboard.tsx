import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotifications } from '@/hooks/useNotifications';
import { Property, TenantTicket, UnifiedPropertyUpdate } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  MessageSquare, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Home,
  User,
  Wrench,
  Calendar,
  Filter,
  Search,
  MoreVertical,
  ChevronRight,
  Moon,
  Sun
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import PropertyJournalModal from './PropertyJournalModal';

interface AgentDashboardProps {
  selectedLandlordId: string;
}

const AgentDashboard = ({ selectedLandlordId }: AgentDashboardProps) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tickets, setTickets] = useState<TenantTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [agentId, setAgentId] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const api = useApi();
  const { toast } = useToast();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(agentId);

  useEffect(() => {
    if (selectedLandlordId) {
      loadDashboardData();
      // Get current user's agent ID
      api.getProfile().then(profile => {
        if (profile) {
          setAgentId(profile.id);
        }
      });
    }
  }, [selectedLandlordId, api]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProperties(),
        loadRecentTickets()
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProperties = async () => {
    try {
      const data = await api.listProperties(selectedLandlordId);
      setProperties(data);
      
      // Load unread counts for each property
      const counts: Record<string, number> = {};
      for (const property of data) {
        try {
          const feed = await api.getUnifiedPropertyFeed(property.id);
          // Count unread messages (this is a simplified approach)
          const recentTickets = feed.filter(item => 
            item.source === 'tenant_ticket' && 
            new Date(item.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          );
          counts[property.id] = recentTickets.length;
        } catch (error) {
          counts[property.id] = 0;
        }
      }
      setUnreadCounts(counts);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };



  const loadRecentTickets = async () => {
    try {
      const allTickets: TenantTicket[] = [];
      for (const property of properties) {
        try {
          const propertyTickets = await api.listTenantTickets(property.id);
          allTickets.push(...propertyTickets);
        } catch (error) {
          console.error(`Error loading tickets for property ${property.id}:`, error);
        }
      }
      setTickets(allTickets.slice(0, 10)); // Show recent 10
    } catch (error) {
      console.error('Error loading tickets:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-amber-100 text-amber-800';
      case 'resolved':
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

  const unreadNotifications = notifications.filter(n => !n.read).length;

  if (loading && properties.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Agent Dashboard</h1>
            <p className={`mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Manage properties and tenant requests</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {isDarkMode ? 'Light' : 'Dark'}
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-full">
        {/* Main Content */}
        <div className="flex-1 p-6">
          <Tabs defaultValue="overview" className="h-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="notifications" className="relative">
                Notifications
                {unreadNotifications > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs">
                    {unreadNotifications}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tickets">Recent Tickets</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((property) => (
                  <Card 
                    key={property.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedProperty(property)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Home className="h-5 w-5 text-blue-600" />
                          <CardTitle className="text-lg">{property.addressLine1}</CardTitle>
                        </div>
                        {unreadCounts[property.id] > 0 && (
                          <Badge variant="destructive" className="h-6 w-6 p-0 text-xs">
                            {unreadCounts[property.id]}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <Home className="h-4 w-4 mr-2" />
                          {property.addressLine1}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <User className="h-4 w-4 mr-2" />
                          {property.city}, {property.postcode}
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <Badge variant="secondary">
                            {property.propertyType}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Bell className="h-5 w-5 mr-2" />
                    Recent Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {notifications.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p>No notifications</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-4 rounded-lg border ${
                              notification.read ? 'bg-white' : 'bg-blue-50 border-blue-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Wrench className="h-4 w-4 text-blue-600" />
                                  <span className="font-medium text-sm">{notification.title}</span>
                                  <Badge className={getPriorityColor(notification.priority)}>
                                    {notification.priority}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">
                                  {notification.description}
                                </p>
                                <div className="flex items-center text-xs text-gray-500">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                                </div>
                              </div>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tickets" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Recent Tickets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {tickets.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p>No recent tickets</p>
                        </div>
                      ) : (
                        tickets.map((ticket) => (
                          <div key={ticket.id} className="p-4 rounded-lg border bg-white">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="font-medium">{ticket.title}</span>
                                  <Badge className={getStatusColor(ticket.status)}>
                                    {ticket.status.replace('_', ' ')}
                                  </Badge>
                                  <Badge className={getPriorityColor(ticket.priority)}>
                                    {ticket.priority}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">
                                  {ticket.description}
                                </p>
                                <div className="flex items-center text-xs text-gray-500">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {format(new Date(ticket.createdAt), 'MMM d, h:mm a')}
                                </div>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  const property = properties.find(p => p.id === ticket.propertyId);
                                  if (property) setSelectedProperty(property);
                                }}
                              >
                                View
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Property Modal */}
      {selectedProperty && (
        <PropertyJournalModal
          property={selectedProperty}
          isOpen={!!selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </div>
  );
};

export default AgentDashboard;
