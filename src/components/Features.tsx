import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  MessageSquare, 
  Clock, 
  Shield, 
  BarChart3, 
  Zap,
  ArrowRight,
  CheckCircle
} from "lucide-react";
import communicationFlow from "@/assets/communication-flow.jpg";

const Features = () => {
  const features = [
    {
      icon: Upload,
      title: "CSV Import System",
      description: "Drag-and-drop CSV upload with smart column mapping and duplicate detection",
      color: "text-primary",
      bgColor: "bg-primary-light"
    },
    {
      icon: MessageSquare,
      title: "3-Click Updates",
      description: "From property selection to sent email in just three clicks with automated templates",
      color: "text-teal",
      bgColor: "bg-teal-light"
    },
    {
      icon: Clock,
      title: "Automated Scheduling",
      description: "Smart date defaulting and automated follow-up reminders for different update types",
      color: "text-success",
      bgColor: "bg-success-light"
    },
    {
      icon: Shield,
      title: "Secure Portal Access",
      description: "Tokenized landlord portal access with no login required, mobile-optimized design",
      color: "text-warning",
      bgColor: "bg-orange-50"
    },
    {
      icon: BarChart3,
      title: "Communication Analytics",
      description: "Track response times, landlord satisfaction, and communication frequency metrics",
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      icon: Zap,
      title: "Zero Cognitive Load",
      description: "Smart defaults and guided workflows that require minimal thinking from agents",
      color: "text-primary",
      bgColor: "bg-primary-light"
    }
  ];

  return (
    <section id="features" className="py-24 bg-gradient-subtle">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center bg-teal-light text-teal px-3 py-1 rounded-full text-sm font-medium mb-4">
            <Zap className="h-4 w-4 mr-2" />
            Powerful Features
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Everything you need to streamline{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              property communication
            </span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Built specifically for independent letting agencies who want to keep landlords happy 
            without overwhelming their agents.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 shadow-md bg-gradient-card"
            >
              <CardHeader>
                <div className={`${feature.bgColor} ${feature.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">
                  {feature.title}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Communication Flow Showcase */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">
              Seamless Communication Flow
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Watch how Yarrow transforms complex property management communication 
              into a simple, efficient workflow that keeps everyone in the loop.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                <span>Professional templates with agency branding</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                <span>Automated personalization and formatting</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                <span>Secure landlord portal with update history</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                <span>Reply-to-update threading and tracking</span>
              </div>
            </div>

            <Button variant="gradient" size="lg" className="group">
              See It In Action
              <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className="relative">
            <Card className="overflow-hidden shadow-2xl">
              <img
                src={communicationFlow}
                alt="Communication Flow Illustration"
                className="w-full h-80 object-cover"
              />
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;