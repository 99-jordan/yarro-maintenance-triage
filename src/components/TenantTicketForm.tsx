import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityLevel, Property, CreateTenantTicketInput } from "@/lib/api/types";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Wrench, Zap, Droplets, Thermometer } from "lucide-react";

interface TenantTicketFormProps {
  propertyId: string;
  onCreated: () => void;
}

const TenantTicketForm = ({ propertyId, onCreated }: TenantTicketFormProps) => {
  const api = useApi();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<PriorityLevel>("normal");
  const [category, setCategory] = useState("general");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a title and description for your request.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const profile = await api.getProfile();
      if (!profile) {
        throw new Error("Profile not found");
      }

      // Get property details to fill in the required fields
      const properties = await api.listProperties();
      const property = properties.find(p => p.id === propertyId);
      if (!property) {
        throw new Error("Property not found");
      }

      const input: CreateTenantTicketInput = {
        agencyId: property.agencyId,
        tenantId: profile.id,
        propertyId: propertyId,
        landlordId: property.landlordId,
        agentId: property.lettingAgent,
        title: title.trim(),
        description: description.trim(),
        severity
      };

      await api.createTenantTicket(input);
      
      toast({
        title: "Request Submitted",
        description: "Your maintenance request has been submitted successfully. You'll be notified of any updates.",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setSeverity("normal");
      setCategory("general");
      
      onCreated();
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit your request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (priority: PriorityLevel) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'normal':
        return <Wrench className="h-4 w-4 text-blue-500" />;
      case 'low':
        return <Wrench className="h-4 w-4 text-gray-500" />;
      default:
        return <Wrench className="h-4 w-4" />;
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'electrical':
        return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'plumbing':
        return <Droplets className="h-4 w-4 text-blue-500" />;
      case 'heating':
        return <Thermometer className="h-4 w-4 text-red-500" />;
      default:
        return <Wrench className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityDescription = (priority: PriorityLevel) => {
    switch (priority) {
      case 'urgent':
        return 'Immediate attention required (safety hazard, no heat/water)';
      case 'high':
        return 'Important issue that affects daily living';
      case 'normal':
        return 'Standard maintenance request';
      case 'low':
        return 'Minor issue, no rush';
      default:
        return '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Issue Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">
                <div className="flex items-center">
                  <Wrench className="h-4 w-4 mr-2" />
                  General Maintenance
                </div>
              </SelectItem>
              <SelectItem value="plumbing">
                <div className="flex items-center">
                  <Droplets className="h-4 w-4 mr-2" />
                  Plumbing
                </div>
              </SelectItem>
              <SelectItem value="electrical">
                <div className="flex items-center">
                  <Zap className="h-4 w-4 mr-2" />
                  Electrical
                </div>
              </SelectItem>
              <SelectItem value="heating">
                <div className="flex items-center">
                  <Thermometer className="h-4 w-4 mr-2" />
                  Heating/Cooling
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="severity">Priority Level</Label>
          <Select value={severity} onValueChange={(value) => setSeverity(value as PriorityLevel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">
                <div className="flex items-center">
                  {getSeverityIcon('low')}
                  <span className="ml-2">Low Priority</span>
                </div>
              </SelectItem>
              <SelectItem value="normal">
                <div className="flex items-center">
                  {getSeverityIcon('normal')}
                  <span className="ml-2">Normal Priority</span>
                </div>
              </SelectItem>
              <SelectItem value="high">
                <div className="flex items-center">
                  {getSeverityIcon('high')}
                  <span className="ml-2">High Priority</span>
                </div>
              </SelectItem>
              <SelectItem value="urgent">
                <div className="flex items-center">
                  {getSeverityIcon('urgent')}
                  <span className="ml-2">Urgent</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            {getSeverityDescription(severity)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Brief Description</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Leaky faucet in kitchen, Broken light switch in bedroom"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Detailed Description</Label>
        <Textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Please provide as much detail as possible about the issue, including location, when it started, and any other relevant information..."
          required
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button 
          type="submit" 
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {loading ? "Submitting..." : "Submit Request"}
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            setTitle("");
            setDescription("");
            setSeverity("normal");
            setCategory("general");
          }}
        >
          Clear Form
        </Button>
      </div>
    </form>
  );
};

export default TenantTicketForm;
