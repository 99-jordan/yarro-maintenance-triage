import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom"; // HashRouter prevents deep-link 404s on static hosting
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProfileProvider } from "./contexts/ProfileContext";
import { APIProvider } from "./hooks/useApi";
import { api } from "./lib/api";
import Auth from "./pages/Auth";
import AppLayout from "./pages/App";
import NotFound from "./pages/NotFound";
import TenantAuth from "./pages/TenantAuth";
import TenantApp from "./pages/TenantApp";
import AgencySignUp from "./pages/AgencySignUp";
import AgentJoin from "./pages/AgentJoin";
import AgentWizard from "./pages/AgentWizard";
import TenantJoin from "./pages/TenantJoin";
import AgencySettings from "./pages/AgencySettings";
import TeamInvites from "./pages/TeamInvites";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/api/supabaseAdapter";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, requiredRole }: { 
  children: React.ReactNode;
  requiredRole?: 'agent' | 'owner' | 'tenant';
}) => {
  const { session, loading } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [inferredRole, setInferredRole] = useState<'agent' | 'owner' | 'tenant' | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      if (!session) {
        setChecking(false);
        return;
      }
      try {
        const profile = await api.getProfile();
        setRole(profile?.role ?? null);
      } finally {
        setChecking(false);
      }
    };
    checkRole();
  }, [session]);

  // Infer role from email domain as a fallback without touching RLS-protected tables
  useEffect(() => {
    const infer = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || '';
      if (!email) {
        setInferredRole(null);
        return;
      }
      if (email.endsWith('@tenant.com')) {
        setInferredRole('tenant');
      } else {
        // Treat non-tenant as agent/owner for routing purposes
        setInferredRole('agent');
      }
    };
    infer();
  }, [session]);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  // If specific role required, check it using profile role if present, otherwise inferred role
  if (requiredRole) {
    const effectiveRole = role ?? inferredRole;
    if (effectiveRole !== requiredRole) {
      // Avoid redirecting to the same path which causes loops
      if (effectiveRole === 'tenant') {
        if (window.location.pathname !== '/tenant') return <Navigate to="/tenant" replace />;
        // If already at /tenant and inferred tenant, allow access
        return <>{children}</>;
      }
      if (effectiveRole === 'agent' || effectiveRole === 'owner') {
        if (window.location.pathname !== '/app') return <Navigate to="/app" replace />;
        return <>{children}</>;
      }
      if (window.location.pathname !== '/auth') return <Navigate to="/auth" replace />;
      return <>{children}</>;
    }
  }
  
  return <>{children}</>;
};

const SmartRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkRoleAndRedirect = async () => {
      if (loading) return;
      
      if (!session) {
        // No session, redirect to main auth page
        window.location.href = '/auth';
        return;
      }
      
      try {
        const profile = await api.getProfile();
        const userRole = profile?.role;
        // Primary path: use profile role when available
        if (userRole === 'tenant') {
          if (window.location.pathname !== '/tenant') window.location.replace('/tenant');
          return;
        }
        if (userRole === 'agent' || userRole === 'owner') {
          if (window.location.pathname !== '/app') window.location.replace('/app');
          return;
        }
        // Fallback path: infer by email domain without touching RLS-protected tables
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email || '';
        if (email.endsWith('@tenant.com')) {
          if (window.location.pathname !== '/tenant') window.location.replace('/tenant');
          return;
        }
        // Default to staff app if non-tenant or unknown
        if (window.location.pathname !== '/app') window.location.replace('/app');
        return;
      } catch (error) {
        console.error('Error checking profile:', error);
        // As a resilient fallback, infer via email domain
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email || '';
        if (email.endsWith('@tenant.com')) {
          if (window.location.pathname !== '/tenant') window.location.replace('/tenant');
          return;
        }
        if (window.location.pathname !== '/auth') window.location.replace('/auth');
      } finally {
        setChecking(false);
      }
    };
    
    checkRoleAndRedirect();
  }, [session, loading]);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <APIProvider value={api}>
      <AuthProvider>
        <ProfileProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <HashRouter>
              <Routes>
                {/* Public routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/signup" element={<AgencySignUp />} />
                <Route path="/join" element={<AgentJoin />} />
                <Route path="/tenant-join" element={<TenantJoin />} />
                <Route path="/tenant/auth" element={<TenantAuth />} />
                
                {/* Onboarding routes */}
                <Route path="/onboarding" element={
                  <ProtectedRoute>
                    <AgentWizard />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute requiredRole="owner">
                    <AgencySettings />
                  </ProtectedRoute>
                } />
                
                {/* Team management routes */}
                <Route path="/team" element={
                  <ProtectedRoute requiredRole="owner">
                    <TeamInvites />
                  </ProtectedRoute>
                } />
                
                {/* Tenant portal */}
                <Route path="/tenant/*" element={
                  <ProtectedRoute requiredRole="tenant">
                    <TenantApp />
                  </ProtectedRoute>
                } />
                
                {/* Main app */}
                <Route path="/app/*" element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                } />
                
                {/* Smart root route */}
                <Route path="/" element={
                  <SmartRoute>
                    <div />
                  </SmartRoute>
                } />
                
                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </HashRouter>
          </TooltipProvider>
        </ProfileProvider>
      </AuthProvider>
    </APIProvider>
  </QueryClientProvider>
);

export default App;
