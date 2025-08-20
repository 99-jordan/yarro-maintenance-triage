import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Users, 
  MessageSquare, 
  TrendingUp,
  Plus,
  Filter,
  Search,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileText,
  Mail
} from "lucide-react";

const Dashboard = () => {
  const landlords = [
    { name: "Sarah Mitchell", properties: 3, lastContact: "2 days ago", status: "good" },
    { name: "David Johnson", properties: 5, lastContact: "1 week ago", status: "overdue" },
    { name: "Emma Wilson", properties: 2, lastContact: "Today", status: "excellent" },
    { name: "Michael Brown", properties: 4, lastContact: "3 days ago", status: "good" }
  ];

  const recentUpdates = [
    { 
      id: 1,
      property: "45 Oak Street, Manchester",
      landlord: "Sarah Mitchell",
      type: "Maintenance",
      status: "completed",
      date: "Today",
      cost: "£150"
    },
    {
      id: 2,
      property: "12 Elm Avenue, Birmingham",
      landlord: "David Johnson", 
      type: "Inspection",
      status: "pending",
      date: "Yesterday",
      cost: null
    },
    {
      id: 3,
      property: "78 Pine Road, Leeds",
      landlord: "Emma Wilson",
      type: "Rent Collection",
      status: "completed",
      date: "2 days ago",
      cost: "£1,200"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
        return "bg-success text-success-foreground";
      case "good":
        return "bg-teal text-teal-foreground";
      case "overdue":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getUpdateStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />;
      case "overdue":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center bg-primary-light text-primary px-3 py-1 rounded-full text-sm font-medium mb-4">
            <Building2 className="h-4 w-4 mr-2" />
            Dashboard Preview
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Your property management{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              command center
            </span>
          </h2>
          <p className="text-xl text-muted-foreground">
            See everything at a glance - landlord health, property updates, and communication history.
          </p>
        </div>

        {/* Dashboard Layout */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar - Landlord List */}
          <div className="lg:col-span-1">
            <Card className="h-fit sticky top-6 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Landlords</CardTitle>
                  <Button size="sm" variant="outline">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground transform -translate-y-1/2" />
                  <input 
                    className="w-full pl-10 pr-3 py-2 bg-muted rounded-md text-sm border-0 focus:ring-2 focus:ring-primary"
                    placeholder="Search landlords..."
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {landlords.map((landlord, index) => (
                  <div key={index} className="p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{landlord.name}</span>
                      <Badge variant="secondary" className={getStatusColor(landlord.status)}>
                        {landlord.properties}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last contact: {landlord.lastContact}
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Landlord
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Stats Overview */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-card shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Properties</p>
                      <p className="text-2xl font-bold text-primary">145</p>
                    </div>
                    <Building2 className="h-8 w-8 text-primary/60" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-card shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Landlords</p>
                      <p className="text-2xl font-bold text-teal">32</p>
                    </div>
                    <Users className="h-8 w-8 text-teal/60" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-card shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Updates Sent</p>
                      <p className="text-2xl font-bold text-success">24</p>
                    </div>
                    <MessageSquare className="h-8 w-8 text-success/60" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-card shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Response Rate</p>
                      <p className="text-2xl font-bold text-warning">94%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-warning/60" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Updates */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Updates</CardTitle>
                    <CardDescription>Latest property communications and status changes</CardDescription>
                  </div>
                  <Button variant="gradient">
                    <Plus className="h-4 w-4 mr-2" />
                    New Update
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentUpdates.map((update) => (
                    <div key={update.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div className="flex items-center space-x-4">
                        {getUpdateStatusIcon(update.status)}
                        <div>
                          <div className="font-medium">{update.property}</div>
                          <div className="text-sm text-muted-foreground">
                            {update.landlord} • {update.type}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{update.cost || "—"}</div>
                        <div className="text-xs text-muted-foreground">{update.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer border-2 border-dashed border-muted-foreground/20 hover:border-primary/50">
                <div className="text-center space-y-3">
                  <div className="bg-primary-light text-primary w-12 h-12 rounded-lg flex items-center justify-center mx-auto">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-medium">Import CSV</h3>
                    <p className="text-xs text-muted-foreground">Bulk import properties</p>
                  </div>
                </div>
              </Card>
              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer border-2 border-dashed border-muted-foreground/20 hover:border-teal/50">
                <div className="text-center space-y-3">
                  <div className="bg-teal-light text-teal w-12 h-12 rounded-lg flex items-center justify-center mx-auto">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-medium">Schedule Updates</h3>
                    <p className="text-xs text-muted-foreground">Plan ahead</p>
                  </div>
                </div>
              </Card>
              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer border-2 border-dashed border-muted-foreground/20 hover:border-success/50">
                <div className="text-center space-y-3">
                  <div className="bg-success-light text-success w-12 h-12 rounded-lg flex items-center justify-center mx-auto">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-medium">Email Templates</h3>
                    <p className="text-xs text-muted-foreground">Customize messages</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;