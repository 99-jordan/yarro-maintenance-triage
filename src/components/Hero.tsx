import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, CheckCircle, Clock, Users, Zap } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-hero opacity-5" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-4">
              <div className="inline-flex items-center bg-primary-light text-primary px-3 py-1 rounded-full text-sm font-medium">
                <Zap className="h-4 w-4 mr-2" />
                Property Management Made Simple
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Keep landlords happy with{" "}
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  timely updates
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground leading-relaxed">
                Streamline your property management communication without adding cognitive load. 
                3-click updates, automated formatting, centralized history.
              </p>
            </div>

            {/* Key Benefits */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                <span className="text-sm font-medium">3-click updates</span>
              </div>
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-teal flex-shrink-0" />
                <span className="text-sm font-medium">Automated formatting</span>
              </div>
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-sm font-medium">Centralized history</span>
              </div>
              <div className="flex items-center space-x-3">
                <Zap className="h-5 w-5 text-warning flex-shrink-0" />
                <span className="text-sm font-medium">Zero cognitive load</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="xl" className="group">
                Start Free Trial
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="xl">
                Watch Demo
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex items-center space-x-6 pt-8 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">50+</div>
                <div className="text-sm text-muted-foreground">Agencies</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-teal">1000+</div>
                <div className="text-sm text-muted-foreground">Properties</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime</div>
              </div>
            </div>
          </div>

          {/* Right Column - Hero Image */}
          <div className="relative lg:h-[600px] animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <Card className="overflow-hidden shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-700">
              <img
                src={heroImage}
                alt="Property Management Dashboard"
                className="w-full h-full object-cover"
              />
            </Card>
            
            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 bg-success text-success-foreground p-3 rounded-lg shadow-lg animate-float">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="absolute -bottom-4 -left-4 bg-primary text-primary-foreground p-3 rounded-lg shadow-lg animate-float" style={{ animationDelay: '1s' }}>
              <Zap className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;