import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, Settings as SettingsIcon, Building2, Fuel, Bell } from 'lucide-react';
import { toast } from 'sonner';
import ChangePasswordCard from '@/components/ChangePasswordCard';

interface SettingsData {
  fuel_price_per_liter: string;
  expiry_alert_days: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_gst: string;
}

const defaultSettings: SettingsData = {
  fuel_price_per_liter: '90',
  expiry_alert_days: '30',
  company_name: '',
  company_address: '',
  company_phone: '',
  company_email: '',
  company_gst: '',
};

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('key, value');

    if (error) {
      toast.error('Failed to load settings');
      console.error(error);
    } else if (data) {
      const settingsMap: Record<string, string> = {};
      data.forEach((row) => {
        settingsMap[row.key] = row.value;
      });
      setSettings({
        fuel_price_per_liter: settingsMap.fuel_price_per_liter || defaultSettings.fuel_price_per_liter,
        expiry_alert_days: settingsMap.expiry_alert_days || defaultSettings.expiry_alert_days,
        company_name: settingsMap.company_name || defaultSettings.company_name,
        company_address: settingsMap.company_address || defaultSettings.company_address,
        company_phone: settingsMap.company_phone || defaultSettings.company_phone,
        company_email: settingsMap.company_email || defaultSettings.company_email,
        company_gst: settingsMap.company_gst || defaultSettings.company_gst,
      });
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);

    const updates = Object.entries(settings).map(([key, value]) => ({
      key,
      value: value || '',
    }));

    // Upsert each setting
    for (const update of updates) {
      const { error } = await supabase
        .from('admin_settings')
        .update({ value: update.value })
        .eq('key', update.key);

      if (error) {
        toast.error(`Failed to save ${update.key}`);
        setSaving(false);
        return;
      }
    }

    toast.success('Settings saved successfully');
    setSaving(false);
  }

  function handleChange(key: keyof SettingsData, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <SettingsIcon className="h-6 w-6" />
              Settings
            </h1>
            <p className="text-muted-foreground">Configure system settings and company information</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* System Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fuel className="h-5 w-5" />
                Fuel & Calculations
              </CardTitle>
              <CardDescription>
                Configure values used in profitability calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fuel_price">Fuel Price (₹/Liter)</Label>
                <Input
                  id="fuel_price"
                  type="number"
                  step="0.01"
                  value={settings.fuel_price_per_liter}
                  onChange={(e) => handleChange('fuel_price_per_liter', e.target.value)}
                  placeholder="90"
                />
                <p className="text-xs text-muted-foreground">
                  Used to calculate fuel efficiency in profitability reports
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Alert Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Alert Settings
              </CardTitle>
              <CardDescription>
                Configure when alerts are triggered
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="expiry_days">Expiry Alert Threshold (Days)</Label>
                <Input
                  id="expiry_days"
                  type="number"
                  value={settings.expiry_alert_days}
                  onChange={(e) => handleChange('expiry_alert_days', e.target.value)}
                  placeholder="30"
                />
                <p className="text-xs text-muted-foreground">
                  Show alerts for documents and licenses expiring within this many days
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                This information appears on exported reports and trip sheets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={settings.company_name}
                    onChange={(e) => handleChange('company_name', e.target.value)}
                    placeholder="My Bus Company Pvt. Ltd."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_gst">GST Number</Label>
                  <Input
                    id="company_gst"
                    value={settings.company_gst}
                    onChange={(e) => handleChange('company_gst', e.target.value)}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_address">Address</Label>
                <Input
                  id="company_address"
                  value={settings.company_address}
                  onChange={(e) => handleChange('company_address', e.target.value)}
                  placeholder="123 Transport Nagar, Mumbai, Maharashtra 400001"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_phone">Phone Number</Label>
                  <Input
                    id="company_phone"
                    value={settings.company_phone}
                    onChange={(e) => handleChange('company_phone', e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_email">Email</Label>
                  <Input
                    id="company_email"
                    type="email"
                    value={settings.company_email}
                    onChange={(e) => handleChange('company_email', e.target.value)}
                    placeholder="contact@mybuscompany.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <ChangePasswordCard />
        </div>
      </div>
    </DashboardLayout>
  );
}
