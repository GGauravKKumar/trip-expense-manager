import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bus, MapPin, Receipt, FileText, Users, Shield, BarChart3, ArrowRight } from 'lucide-react';

const Index = () => {
  const features = [
    {
      icon: Bus,
      title: 'Fleet Management',
      description: 'Track your entire bus fleet with real-time status updates, maintenance schedules, and compliance monitoring.',
    },
    {
      icon: MapPin,
      title: 'Trip Tracking',
      description: 'Monitor trips from departure to arrival with detailed route information, timings, and revenue tracking.',
    },
    {
      icon: Receipt,
      title: 'Expense Management',
      description: 'Record and approve expenses on-the-go. Track fuel costs, tolls, repairs, and driver allowances.',
    },
    {
      icon: FileText,
      title: 'GST Reports',
      description: 'Generate GST-compliant invoices and reports automatically. Simplify your tax compliance.',
    },
    {
      icon: Users,
      title: 'Driver Management',
      description: 'Manage driver profiles, track license expiry, assign trips, and monitor performance.',
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      description: 'Get insights into profitability, route performance, and operational efficiency.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
        <nav className="relative container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <Bus className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">BusManager</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </nav>

        <div className="relative container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Complete Fleet & Trip Management for{' '}
              <span className="text-primary">Bus Operators</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
              Streamline your bus operations with powerful tools for trip tracking, expense management, 
              driver coordination, and GST-compliant invoicing. Built for Indian bus operators.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Sign In to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Manage Your Fleet
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From trip scheduling to GST reports, BusManager provides all the tools 
              you need to run your bus operations efficiently.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="bg-primary/5 rounded-2xl p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="p-4 bg-primary/10 rounded-full">
                <Shield className="h-12 w-12 text-primary" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  Secure & Reliable
                </h2>
                <p className="text-muted-foreground">
                  Your data is encrypted and stored securely. Each client gets their own 
                  isolated instance with full data privacy and backup support.
                </p>
              </div>
              <Link to="/signup">
                <Button size="lg">
                  Get Started Today
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary rounded-lg">
                <Bus className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold">BusManager</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} BusManager. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/login" className="hover:text-foreground transition-colors">
                Sign In
              </Link>
              <Link to="/signup" className="hover:text-foreground transition-colors">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
