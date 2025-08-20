import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  UserPlus, 
  Mail, 
  Copy, 
  Trash2, 
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useProfile } from '@/contexts/ProfileContext';
import { format } from 'date-fns';
import { supabase } from '@/lib/api/supabaseAdapter';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['agent'], { required_error: 'Please select a role' }),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface Invite {
  id: string;
  email: string;
  role: string;
  passcode: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

const TeamInvites = () => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const api = useApi();
  const { profile, agency } = useProfile();

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'agent',
    },
  });

  const fetchInvites = async () => {
    try {
      setIsLoadingInvites(true);
      const { data, error } = await supabase
        .rpc('list_agent_invites')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invites:', error);
        setError('Failed to load invites');
        return;
      }

      setInvites(data || []);
    } catch (err) {
      console.error('Error fetching invites:', err);
      setError('Failed to load invites');
    } finally {
      setIsLoadingInvites(false);
    }
  };

  useEffect(() => {
    if (profile?.role === 'owner') {
      fetchInvites();
    }
  }, [profile]);

  const onSubmit = async (data: InviteFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: result, error: rpcError } = await supabase
        .rpc('create_agent_invite', {
          p_email: data.email,
          p_role: data.role
        });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // Refresh invites list
      await fetchInvites();
      
      // Reset form and close dialog
      form.reset();
      setIsDialogOpen(false);

      // Optionally send email invite
      if (result?.passcode) {
        try {
          await supabase.functions.invoke('onboarding-mailer', {
            body: {
              type: 'agent_invite',
              email: data.email,
              agencyName: agency?.name,
              inviteUrl: `${import.meta.env.VITE_PUBLIC_APP_URL}/join?email=${encodeURIComponent(data.email)}&code=${result.passcode}`
            }
          });
        } catch (emailError) {
          console.warn('Email sending failed:', emailError);
          // Don't fail the whole operation if email fails
        }
      }

    } catch (err) {
      console.error('Invite creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setIsLoading(false);
    }
  };

  const copyInviteLink = async (invite: Invite) => {
    const inviteUrl = `${import.meta.env.VITE_PUBLIC_APP_URL}/join?email=${encodeURIComponent(invite.email)}&code=${invite.passcode}`;
    
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .rpc('revoke_agent_invite', {
          p_invite_id: inviteId
        });

      if (error) {
        throw new Error(error.message);
      }

      await fetchInvites();
    } catch (err) {
      console.error('Revoke error:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke invite');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'pending':
        return 'outline';
      case 'accepted':
        return 'default';
      case 'expired':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (profile?.role !== 'owner') {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Only agency owners can manage team invites.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-gray-600">Invite agents to join your agency</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New Agent</DialogTitle>
              <DialogDescription>
                Send an invitation to join your agency team
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="agent@example.com"
                  {...form.register('email')}
                  disabled={isLoading}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={form.watch('role')}
                  onValueChange={(value) => form.setValue('role', value as 'agent')}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Invite'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Invitations</CardTitle>
              <CardDescription>
                Manage pending and completed invitations
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInvites}
              disabled={isLoadingInvites}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingInvites ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoadingInvites ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
              <p className="text-gray-600">Loading invitations...</p>
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-600">No invitations sent yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>{invite.role}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(invite.status)} className="flex items-center gap-1 w-fit">
                        {getStatusIcon(invite.status)}
                        {invite.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(invite.createdAt), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{format(new Date(invite.expiresAt), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {invite.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyInviteLink(invite)}
                              className="flex items-center gap-1"
                            >
                              {copiedId === invite.id ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                              {copiedId === invite.id ? 'Copied!' : 'Copy Link'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => revokeInvite(invite.id)}
                              className="flex items-center gap-1 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                              Revoke
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamInvites;
