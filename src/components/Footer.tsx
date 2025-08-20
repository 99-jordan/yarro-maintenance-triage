import { Building2, Mail, Phone, MapPin, Twitter, Linkedin, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

const Footer = () => {
  const footerLinks = {
    product: [
      { name: "Features", href: "#features" },
      { name: "Pricing", href: "#pricing" },
      { name: "Integrations", href: "#" },
      { name: "API", href: "#" }
    ],
    company: [
      { name: "About", href: "#about" },
      { name: "Blog", href: "#" },
      { name: "Careers", href: "#" },
      { name: "Contact", href: "#" }
    ],
    support: [
      { name: "Help Center", href: "#" },
      { name: "Documentation", href: "#" },
      { name: "Status", href: "#" },
      { name: "Security", href: "#" }
    ],
    legal: [
      { name: "Privacy Policy", href: "#" },
      { name: "Terms of Service", href: "#" },
      { name: "Cookie Policy", href: "#" },
      { name: "GDPR", href: "#" }
    ]
  };

  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Main Footer Content */}
        <div className="grid lg:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-primary p-2 rounded-lg shadow-primary">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold">Yarrow</span>
            </div>
            
            <p className="text-background/80 leading-relaxed max-w-md">
              Streamline your property management communication with intelligent automation 
              that keeps landlords happy without overwhelming your team.
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-background/80">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">hello@yarrow.property</span>
              </div>
              <div className="flex items-center space-x-3 text-background/80">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">+44 20 1234 5678</span>
              </div>
              <div className="flex items-center space-x-3 text-background/80">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">London, United Kingdom</span>
              </div>
            </div>

            <div className="flex space-x-4">
              <Button variant="ghost" size="icon" className="text-background/60 hover:text-background hover:bg-background/10">
                <Twitter className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-background/60 hover:text-background hover:bg-background/10">
                <Linkedin className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-background/60 hover:text-background hover:bg-background/10">
                <Github className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Links Columns */}
          <div className="space-y-6">
            <h3 className="font-semibold text-background">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link, index) => (
                <li key={index}>
                  <a href={link.href} className="text-background/80 hover:text-background text-sm transition-colors">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <h3 className="font-semibold text-background">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  <a href={link.href} className="text-background/80 hover:text-background text-sm transition-colors">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <h3 className="font-semibold text-background">Support</h3>
            <ul className="space-y-3">
              {footerLinks.support.map((link, index) => (
                <li key={index}>
                  <a href={link.href} className="text-background/80 hover:text-background text-sm transition-colors">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className="border-t border-background/20 pt-8 mb-8">
          <div className="max-w-md">
            <h3 className="font-semibold text-background mb-3">Stay updated</h3>
            <p className="text-background/80 text-sm mb-4">
              Get the latest features and property management tips delivered to your inbox.
            </p>
            <div className="flex space-x-3">
              <input 
                type="email" 
                placeholder="Enter your email"
                className="flex-1 px-4 py-2 bg-background/10 border border-background/20 rounded-md text-background placeholder:text-background/60 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
              <Button variant="gradient" size="sm">
                Subscribe
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-background/20 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className="text-background/60 text-sm">
              © 2024 Yarrow. All rights reserved.
            </div>
            
            <div className="flex flex-wrap gap-6">
              {footerLinks.legal.map((link, index) => (
                <a
                  key={index}
                  href={link.href}
                  className="text-background/60 hover:text-background text-sm transition-colors"
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;