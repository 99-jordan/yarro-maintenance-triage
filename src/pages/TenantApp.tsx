import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Property, Profile } from "@/lib/api/types";
import TenantChatLayout from "@/components/TenantChatLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, LogOut, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const TenantApp = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const api = useApi();

  useEffect(() => {
    loadTenantData();
  }, []);

  const loadTenantData = async () => {
    try {
      setLoading(true);
      const profileData = await api.getProfile();
      console.log('Profile data:', profileData); // Debug log
      setProfile(profileData);
      
      if (profileData?.role === 'tenant') {
        try {
          const propertyData = await api.getTenantProperty();
          console.log('Property data:', propertyData); // Debug log
          setProperty(propertyData);
        } catch (propertyError) {
          console.log('Property fetch error:', propertyError);
          // Don't fail if no property found, just set to null
          setProperty(null);
        }
      }
    } catch (error) {
      console.error('Error loading tenant data:', error);
      toast({
        title: "Error",
        description: "Failed to load your tenant information.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your tenant portal...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              Unable to load your profile information.
            </p>
            <Button onClick={() => navigate("/tenant/auth")}>
              Return to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Home className="h-8 w-8 text-indigo-600 mr-3" />
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Tenant Portal</h1>
                  <p className="text-sm text-gray-500">Welcome, {profile.fullName}</p>
                </div>
              </div>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <Card className="text-center">
              <CardHeader>
                <CardTitle className="text-orange-600">No Property Assigned</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  You don't have a property assigned to your account yet.
                </p>
                <p className="text-sm text-gray-500">
                  Please contact your property manager to assign you to a property.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <TenantChatLayout 
      propertyId={property.id} 
      tenantId={profile.id} 
    />
  );
};

export default TenantApp;
