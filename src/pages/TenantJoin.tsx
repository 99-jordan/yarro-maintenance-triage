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
import { Home, Mail, Key, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { supabase } from '@/lib/api/supabaseAdapter';

const tenantJoinSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  passcode: z.string().min(1, 'Passcode is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type TenantJoinFormData = z.infer<typeof tenantJoinSchema>;

const TenantJoin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [propertyInfo, setPropertyInfo] = useState<{ 
    address: string; 
    agency: string; 
    agent?: string;
  } | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const api = useApi();

  const form = useForm<TenantJoinFormData>({
    resolver: zodResolver(tenantJoinSchema),
    defaultValues: {
      email: searchParams.get('email') || '',
      passcode: searchParams.get('code') || '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: TenantJoinFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Call tenant join RPC function
      const { data: result, error: rpcError } = await supabase
        .rpc('join_as_tenant', {
          p_email: data.email,
          p_passcode: data.passcode,
          p_password: data.password
        });

      if (rpcError) {
        if (rpcError.message.includes('invalid')) {
          setError('Invalid email or passcode. Please check your invitation details.');
        } else if (rpcError.message.includes('already exists')) {
          setError('An account with this email already exists. Please try signing in instead.');
        } else {
          setError(rpcError.message);
        }
        return;
      }

      setSuccess(true);
      
      // After a brief delay, redirect to tenant portal
      setTimeout(() => {
        navigate('/tenant', { 
          state: { 
            message: 'Welcome to your tenant portal! You can now manage your tenancy and submit requests.',
            newTenant: true
          }
        });
      }, 2000);

    } catch (err) {
      console.error('Tenant join error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to validate passcode and get property info
  const validatePasscode = async () => {
    const email = form.getValues('email');
    const passcode = form.getValues('passcode');
    
    if (!email || !passcode) return;

    try {
      const { data: result, error } = await supabase
        .rpc('validate_tenant_invite', {
          p_email: email,
          p_passcode: passcode
        });

      if (error) {
        setPropertyInfo(null);
        return;
      }

      setPropertyInfo(result);
    } catch (err) {
      console.error('Validation error:', err);
      setPropertyInfo(null);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold text-green-700">Welcome Home!</h2>
              <p className="text-gray-600">
                Your tenant account has been created successfully. You'll be redirected to your portal.
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
            <Home className="h-6 w-6 text-indigo-600" />
            <CardTitle className="text-2xl font-bold text-center">Access Your Portal</CardTitle>
          </div>
          <CardDescription className="text-center">
            Create your tenant account to manage your tenancy
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

            {propertyInfo && (
              <Alert>
                <Home className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div><strong>Property:</strong> {propertyInfo.address}</div>
                    <div><strong>Managed by:</strong> {propertyInfo.agency}</div>
                    {propertyInfo.agent && (
                      <div><strong>Your agent:</strong> {propertyInfo.agent}</div>
                    )}
                  </div>
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
                placeholder="your.email@example.com"
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
                Access Code
              </Label>
              <Input
                id="passcode"
                type="text"
                placeholder="Enter your access code"
                {...form.register('passcode')}
                onBlur={validatePasscode}
                disabled={isLoading}
              />
              {form.formState.errors.passcode && (
                <p className="text-sm text-red-600">{form.formState.errors.passcode.message}</p>
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
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Access My Portal'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-gray-600 text-center">
            Already have an account?{' '}
            <Button 
              variant="link" 
              className="p-0 h-auto font-normal"
              onClick={() => navigate('/tenant/auth')}
            >
              Sign in here
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default TenantJoin;
