import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  Briefcase, 
  MapPin, 
  Phone, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Settings
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/lib/api/supabaseAdapter';

const profileSchema = z.object({
  position: z.string().min(2, 'Position is required'),
  phone: z.string().optional(),
  bio: z.string().optional(),
  specializations: z.array(z.string()).default([]),
  preferredAreas: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const AgentWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();
  const { profile, refreshProfile } = useProfile();

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      position: '',
      phone: '',
      bio: '',
      specializations: [],
      preferredAreas: '',
    },
  });

  useEffect(() => {
    // If profile already has position set, they've completed onboarding
    if (profile?.position && !location.state?.newAgent) {
      navigate('/app');
    }
  }, [profile, navigate, location.state]);

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Call profile update RPC function
      const { error: rpcError } = await supabase
        .rpc('complete_agent_onboarding', {
          p_position: data.position,
          p_phone: data.phone || null,
          p_bio: data.bio || null,
          p_specializations: data.specializations,
          p_preferred_areas: data.preferredAreas || null,
        });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setSuccess(true);
      await refreshProfile();
      
      // After a brief delay, redirect to app
      setTimeout(() => {
        navigate('/app', { 
          replace: true,
          state: { 
            message: 'Welcome! Your onboarding is complete.' 
          }
        });
      }, 2000);

    } catch (err) {
      console.error('Onboarding error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold text-green-700">All Set!</h2>
              <p className="text-gray-600">
                Your profile has been completed. Welcome to your agency platform!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <User className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <p className="text-sm text-gray-600">Tell us about your role</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Job Position
              </Label>
              <Input
                id="position"
                placeholder="e.g. Senior Estate Agent, Property Manager"
                {...form.register('position')}
                disabled={isLoading}
              />
              {form.formState.errors.position && (
                <p className="text-sm text-red-600">{form.formState.errors.position.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number (Optional)
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+44 7XXX XXXXXX"
                {...form.register('phone')}
                disabled={isLoading}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Settings className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">Professional Details</h3>
              <p className="text-sm text-gray-600">Help clients find the right agent</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Professional Bio (Optional)</Label>
              <Textarea
                id="bio"
                placeholder="Tell clients about your experience, approach, and what makes you unique..."
                rows={4}
                {...form.register('bio')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredAreas" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Preferred Areas (Optional)
              </Label>
              <Input
                id="preferredAreas"
                placeholder="e.g. Central London, Kensington, Chelsea"
                {...form.register('preferredAreas')}
                disabled={isLoading}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <CheckCircle className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">Review & Complete</h3>
              <p className="text-sm text-gray-600">Confirm your details</p>
            </div>

            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Position</p>
                <p className="text-gray-900">{form.watch('position') || 'Not specified'}</p>
              </div>
              
              {form.watch('phone') && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Phone</p>
                  <p className="text-gray-900">{form.watch('phone')}</p>
                </div>
              )}
              
              {form.watch('bio') && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Bio</p>
                  <p className="text-gray-900 text-sm">{form.watch('bio')}</p>
                </div>
              )}
              
              {form.watch('preferredAreas') && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Preferred Areas</p>
                  <p className="text-gray-900">{form.watch('preferredAreas')}</p>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Complete Your Profile</CardTitle>
          <CardDescription className="text-center">
            Step {currentStep} of {totalSteps}
          </CardDescription>
          <div className="mt-4">
            <Progress value={progress} className="w-full" />
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {renderStep()}

            <div className="flex justify-between gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1 || isLoading}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={isLoading || !form.watch('position')}
                  className="flex items-center gap-2"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={isLoading || !form.watch('position')}
                  className="flex items-center gap-2"
                >
                  {isLoading ? 'Completing...' : 'Complete Setup'}
                  <CheckCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentWizard;
