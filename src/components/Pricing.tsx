import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Star, Zap, Building2, Users, Crown } from "lucide-react";

const Pricing = () => {
  const plans = [
    {
      name: "Starter",
      description: "Perfect for small agencies",
      price: "£29",
      period: "per month",
      icon: Building2,
      color: "text-primary",
      bgColor: "bg-primary-light",
      popular: false,
      features: [
        "Up to 50 properties",
        "2 agent accounts",
        "Basic email templates",
        "CSV import",
        "Email support",
        "Basic analytics"
      ]
    },
    {
      name: "Professional",
      description: "Most popular for growing agencies",
      price: "£79",
      period: "per month",
      icon: Users,
      color: "text-teal",
      bgColor: "bg-teal-light",
      popular: true,
      features: [
        "Up to 200 properties",
        "5 agent accounts",
        "Advanced templates",
        "Automated workflows",
        "Priority support",
        "Advanced analytics",
        "Landlord portal",
        "Custom branding"
      ]
    },
    {
      name: "Enterprise",
      description: "For large agencies and franchises",
      price: "Custom",
      period: "pricing",
      icon: Crown,
      color: "text-warning",
      bgColor: "bg-orange-50",
      popular: false,
      features: [
        "Unlimited properties",
        "Unlimited agents",
        "White-label solution",
        "API access",
        "Dedicated support",
        "Custom integrations",
        "Advanced permissions",
        "SLA guarantee"
      ]
    }
  ];

  return (
    <section id="pricing" className="py-24 bg-gradient-subtle">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center bg-success-light text-success px-3 py-1 rounded-full text-sm font-medium mb-4">
            <Star className="h-4 w-4 mr-2" />
            Simple Pricing
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Choose the plan that{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              fits your agency
            </span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Start free, scale as you grow. No hidden fees, no setup costs.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index}
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-2xl ${
                plan.popular 
                  ? 'ring-2 ring-primary shadow-primary/10 transform scale-105' 
                  : 'hover:shadow-lg hover:-translate-y-1'
              } bg-gradient-card`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-primary text-white text-center py-2 text-sm font-medium">
                  <Star className="inline h-4 w-4 mr-1" />
                  Most Popular
                </div>
              )}
              
              <CardHeader className={plan.popular ? "pt-12" : "pt-6"}>
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`${plan.bgColor} ${plan.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                    <plan.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-2">/{plan.period}</span>
                  </div>
                  {plan.name !== "Enterprise" && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Billed monthly, cancel anytime
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  variant={plan.popular ? "hero" : plan.name === "Enterprise" ? "outline" : "default"}
                  size="lg" 
                  className="w-full"
                >
                  {plan.name === "Enterprise" ? "Contact Sales" : "Start Free Trial"}
                </Button>

                {plan.name !== "Enterprise" && (
                  <p className="text-xs text-center text-muted-foreground">
                    14-day free trial • No credit card required
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Info */}
        <div className="text-center mt-16 space-y-6">
          <div className="inline-flex items-center bg-teal-light text-teal px-4 py-2 rounded-full text-sm font-medium">
            <Zap className="h-4 w-4 mr-2" />
            All plans include: SSL security, daily backups, 99.9% uptime SLA
          </div>
          
          <div className="grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary mb-2">14 days</div>
              <div className="text-sm text-muted-foreground">Free trial period</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-teal mb-2">No setup</div>
              <div className="text-sm text-muted-foreground">Ready in minutes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success mb-2">Cancel</div>
              <div className="text-sm text-muted-foreground">Anytime, no fees</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;