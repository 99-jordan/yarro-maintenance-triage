import { useState, useEffect, useCallback } from 'react';
import { useApi } from './useApi';
import { useToast } from './use-toast';
import { supabase } from '@/lib/api/supabaseAdapter';
import { TenantTicket } from '@/lib/api/types';

export interface Notification {
  id: string;
  type: 'new_ticket' | 'new_message' | 'status_update';
  title: string;
  description: string;
  propertyId: string;
  ticketId?: string;
  priority?: string;
  createdAt: string;
  read: boolean;
}

export const useNotifications = (agentId?: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const api = useApi();
  const { toast } = useToast();

  // Load initial notifications
  const loadNotifications = useCallback(async () => {
    if (!agentId) return;

    try {
      // Get properties managed by this agent
      const properties = await api.listProperties();
      const agentProperties = properties.filter(p => p.lettingAgent === agentId);
      
      const allNotifications: Notification[] = [];
      
      for (const property of agentProperties) {
        try {
          // Get recent tickets for this property
          const tickets = await api.listTenantTickets(property.id);
          const recentTickets = tickets.filter(ticket => {
            const ticketDate = new Date(ticket.createdAt);
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return ticketDate > dayAgo;
          });

          // Convert tickets to notifications
          const ticketNotifications = recentTickets.map(ticket => ({
            id: `ticket-${ticket.id}`,
            type: 'new_ticket' as const,
            title: `New ticket: ${ticket.title}`,
            description: ticket.description,
            propertyId: property.id,
            ticketId: ticket.id,
            priority: ticket.priority,
            createdAt: ticket.createdAt,
            read: false
          }));

          allNotifications.push(...ticketNotifications);
        } catch (error) {
          console.error(`Error loading tickets for property ${property.id}:`, error);
        }
      }

      // Sort by creation date
      allNotifications.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setNotifications(allNotifications);
      setUnreadCount(allNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [agentId, api]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!agentId) return;

    loadNotifications();

    // Subscribe to new tenant tickets
    const ticketChannel = supabase
      .channel('agent-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tenant_tickets'
        },
        (payload) => {
          const newTicket = payload.new as TenantTicket;
          
          // Check if this agent manages this property
          api.listProperties().then(properties => {
            const agentProperty = properties.find(p => 
              p.id === newTicket.propertyId && p.lettingAgent === agentId
            );
            
            if (agentProperty) {
              const notification: Notification = {
                id: `ticket-${newTicket.id}`,
                type: 'new_ticket',
                title: `New ticket: ${newTicket.title}`,
                description: newTicket.description,
                propertyId: newTicket.propertyId,
                ticketId: newTicket.id,
                priority: newTicket.priority,
                createdAt: newTicket.createdAt,
                read: false
              };

              setNotifications(prev => [notification, ...prev]);
              setUnreadCount(prev => prev + 1);

              // Show toast notification
              toast({
                title: "New Maintenance Request",
                description: `${newTicket.title} - ${agentProperty.name}`,
                duration: 5000,
              });
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tenant_messages'
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          // Don't notify for AI messages
          if (newMessage.is_system) return;

          // Get ticket and property info
          api.getTenantTicketById(newMessage.ticket_id).then(ticket => {
            if (!ticket) return;
            
            api.listProperties().then(properties => {
              const agentProperty = properties.find(p => 
                p.id === ticket.propertyId && p.lettingAgent === agentId
              );
              
              if (agentProperty) {
                const notification: Notification = {
                  id: `message-${newMessage.id}`,
                  type: 'new_message',
                  title: `New message on: ${ticket.title}`,
                  description: newMessage.body.substring(0, 100) + '...',
                  propertyId: ticket.propertyId,
                  ticketId: ticket.id,
                  createdAt: newMessage.created_at,
                  read: false
                };

                setNotifications(prev => [notification, ...prev]);
                setUnreadCount(prev => prev + 1);

                // Show toast notification
                toast({
                  title: "New Message",
                  description: `${ticket.title} - ${agentProperty.name}`,
                  duration: 3000,
                });
              }
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketChannel);
    };
  }, [agentId, loadNotifications, api, toast]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    refreshNotifications: loadNotifications
  };
};
