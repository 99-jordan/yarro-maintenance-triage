import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, Mail, Lock, User, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { supabase } from '@/lib/api/supabaseAdapter';

const joinSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  passcode: z.string().min(1, 'Passcode is required'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type JoinFormData = z.infer<typeof joinSchema>;

const AgentJoin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [agencyInfo, setAgencyInfo] = useState<{ name: string; status: string } | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const api = useApi();

  const form = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
    defaultValues: {
      email: searchParams.get('email') || '',
      passcode: searchParams.get('code') || '',
      fullName: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: JoinFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Call agent join RPC function
      const { data: result, error: rpcError } = await supabase
        .rpc('join_agency_as_agent', {
          p_email: data.email,
          p_passcode: data.passcode,
          p_full_name: data.fullName,
          p_password: data.password
        });

      if (rpcError) {
        if (rpcError.message.includes('not live')) {
          setError('This agency is not yet ready to accept new team members. Please check with your agency owner.');
        } else if (rpcError.message.includes('invalid')) {
          setError('Invalid email or passcode. Please check your invitation details.');
        } else {
          setError(rpcError.message);
        }
        return;
      }

      setSuccess(true);
      
      // After a brief delay, redirect to onboarding
      setTimeout(() => {
        navigate('/onboarding', { 
          state: { 
            message: 'Welcome to the team! Complete your profile setup.',
            newAgent: true
          }
        });
      }, 2000);

    } catch (err) {
      console.error('Join error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to validate passcode and get agency info
  const validatePasscode = async () => {
    const email = form.getValues('email');
    const passcode = form.getValues('passcode');
    
    if (!email || !passcode) return;

    try {
      const { data: result, error } = await supabase
        .rpc('validate_agent_invite', {
          p_email: email,
          p_passcode: passcode
        });

      if (error) {
        setAgencyInfo(null);
        return;
      }

      setAgencyInfo(result);
    } catch (err) {
      console.error('Validation error:', err);
      setAgencyInfo(null);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold text-green-700">Welcome to the Team!</h2>
              <p className="text-gray-600">
                Your account has been created successfully. You'll be redirected to complete your profile setup.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 justify-center mb-2">
            <UserPlus className="h-6 w-6 text-indigo-600" />
            <CardTitle className="text-2xl font-bold text-center">Join Your Agency</CardTitle>
          </div>
          <CardDescription className="text-center">
            Use your invitation details to create your account
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {agencyInfo && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Joining: <strong>{agencyInfo.name}</strong>
                  {agencyInfo.status !== 'live' && (
                    <span className="text-orange-600"> (Agency not yet live)</span>
                  )}
                </AlertDescription>
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
                placeholder="your.email@company.com"
                {...form.register('email')}
                onBlur={validatePasscode}
                disabled={isLoading}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="passcode" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Invitation Passcode
              </Label>
              <Input
                id="passcode"
                type="text"
                placeholder="Enter invitation code"
                {...form.register('passcode')}
                onBlur={validatePasscode}
                disabled={isLoading}
              />
              {form.formState.errors.passcode && (
                <p className="text-sm text-red-600">{form.formState.errors.passcode.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Your Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Smith"
                {...form.register('fullName')}
                disabled={isLoading}
              />
              {form.formState.errors.fullName && (
                <p className="text-sm text-red-600">{form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Create Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...form.register('password')}
                disabled={isLoading}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...form.register('confirmPassword')}
                disabled={isLoading}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || (agencyInfo?.status !== 'live')}
            >
              {isLoading ? 'Creating Account...' : 'Join Agency'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-gray-600 text-center">
            Don't have an invitation?{' '}
            <Button 
              variant="link" 
              className="p-0 h-auto font-normal"
              onClick={() => navigate('/signup')}
            >
              Create your own agency
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AgentJoin;
