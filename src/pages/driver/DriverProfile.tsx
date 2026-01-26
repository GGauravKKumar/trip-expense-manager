import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/types/database';
import { 
  Loader2, 
  Save, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import ChangePasswordCard from '@/components/ChangePasswordCard';
import { format, differenceInDays, parseISO } from 'date-fns';

export default function DriverProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address: '',
    license_number: '',
    license_expiry: '',
  });

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  async function fetchProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user!.id)
      .single();

    if (error) {
      toast.error('Failed to fetch profile');
    } else if (data) {
      setProfile(data as Profile);
      setFormData({
        full_name: data.full_name || '',
        phone: data.phone || '',
        address: data.address || '',
        license_number: data.license_number || '',
        license_expiry: data.license_expiry || '',
      });
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        phone: formData.phone || null,
        address: formData.address || null,
        license_number: formData.license_number || null,
        license_expiry: formData.license_expiry || null,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated successfully');
    }
    setSaving(false);
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function getLicenseStatus() {
    if (!formData.license_expiry) {
      return { status: 'unknown', label: 'Not Set', variant: 'secondary' as const };
    }
    
    const expiryDate = parseISO(formData.license_expiry);
    const daysUntilExpiry = differenceInDays(expiryDate, new Date());
    
    if (daysUntilExpiry < 0) {
      return { status: 'expired', label: 'Expired', variant: 'destructive' as const };
    } else if (daysUntilExpiry <= 30) {
      return { status: 'expiring', label: `Expires in ${daysUntilExpiry} days`, variant: 'default' as const };
    } else {
      return { status: 'valid', label: 'Valid', variant: 'secondary' as const };
    }
  }

  const licenseStatus = getLicenseStatus();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Profile</h1>
            <p className="text-muted-foreground">Manage your personal information and credentials</p>
          </div>
        </div>

        {/* Profile Overview Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                  {getInitials(formData.full_name || 'Driver')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{formData.full_name || 'Driver'}</h2>
                <p className="text-muted-foreground flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4" />
                  {user?.email}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant={licenseStatus.variant} className="gap-1">
                    {licenseStatus.status === 'expired' && <AlertTriangle className="h-3 w-3" />}
                    {licenseStatus.status === 'valid' && <CheckCircle className="h-3 w-3" />}
                    {licenseStatus.status === 'expiring' && <AlertTriangle className="h-3 w-3" />}
                    License: {licenseStatus.label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Personal Details Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Account Info Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  Account Information
                </div>
                <div className="grid gap-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Email Address
                    </Label>
                    <Input 
                      id="email" 
                      value={user?.email || ''} 
                      disabled 
                      className="bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email is linked to your account and cannot be changed
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Personal Info Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <User className="h-4 w-4" />
                  Personal Information
                </div>
                <div className="grid gap-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="flex items-center gap-2">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        maxLength={15}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      Address
                    </Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Enter your complete address"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* License Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  License Details
                </div>
                <div className="grid gap-4 pl-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="license_number" className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        License Number
                      </Label>
                      <Input
                        id="license_number"
                        value={formData.license_number}
                        onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                        placeholder="MH01 2020 0012345"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="license_expiry" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        License Expiry
                      </Label>
                      <Input
                        id="license_expiry"
                        type="date"
                        value={formData.license_expiry}
                        onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  {licenseStatus.status === 'expired' && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Your license has expired. Please renew it immediately.</span>
                    </div>
                  )}
                  
                  {licenseStatus.status === 'expiring' && (
                    <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm text-warning-foreground">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                      <span>Your license will expire soon. Consider renewing it.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button type="submit" disabled={saving} size="lg">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Password Change */}
        <ChangePasswordCard />
      </div>
    </DashboardLayout>
  );
}
