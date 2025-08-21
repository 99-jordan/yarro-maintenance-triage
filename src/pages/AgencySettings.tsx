import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/lib/api/supabaseAdapter";

const AgencySettings = () => {
  const { profile, agency, refreshProfile } = useProfile();
  const [live, setLive] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agency && typeof (agency as any).live !== 'undefined') {
      setLive(Boolean((agency as any).live));
    }
  }, [agency]);

  const toggleLive = async () => {
    if (profile?.role !== 'owner' || !agency) return;
    try {
      setSaving(true);
      setError(null);
      const { error } = await supabase
        .from('agencies')
        .update({ live: !live })
        .eq('id', agency.id)
        .select()
        .single();
      if (error) throw error;
      setLive(!live);
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Agency Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1">
            <div className="text-sm text-gray-600">Agency Slug</div>
            <div className="font-medium">{agency?.slug || '—'}</div>
          </div>
          <div className="flex items-center justify-between border rounded p-4">
            <div>
              <div className="font-medium">Live</div>
              <div className="text-sm text-gray-600">When Live is ON, tenant-facing actions are enabled.</div>
            </div>
            <Switch checked={live} onCheckedChange={toggleLive} disabled={profile?.role !== 'owner' || saving} />
          </div>
          {profile?.role !== 'owner' && (
            <Alert>
              <AlertDescription>Only agency owners can change the Live state.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencySettings;


