import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Expense, ExpenseStatus, Trip, ExpenseCategory } from '@/types/database';
import { Plus, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function DriverExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({ 
    trip_id: '', 
    category_id: '', 
    amount: '', 
    expense_date: new Date().toISOString().split('T')[0], 
    description: '',
    fuel_quantity: ''
  });

  // Check if selected category is fuel-related
  const selectedCategory = categories.find(c => c.id === formData.category_id);
  const isFuelCategory = selectedCategory?.name?.toLowerCase().includes('diesel') || 
                         selectedCategory?.name?.toLowerCase().includes('fuel') || 
                         selectedCategory?.name?.toLowerCase().includes('petrol');

  useEffect(() => { if (user) init(); }, [user]);

  async function init() {
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single();
    if (!profile) return;
    setProfileId(profile.id);
    
    const [{ data: exp }, { data: trp }, { data: cat }] = await Promise.all([
      supabase.from('expenses').select(`*, category:expense_categories(name), trip:trips(trip_number)`).eq('submitted_by', profile.id).order('created_at', { ascending: false }),
      supabase.from('trips').select('*').eq('driver_id', profile.id).eq('status', 'in_progress'),
      supabase.from('expense_categories').select('*'),
    ]);
    setExpenses((exp || []) as unknown as Expense[]);
    setTrips(trp as Trip[] || []);
    setCategories(cat as ExpenseCategory[] || []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profileId) return;
    setSubmitting(true);

    let documentUrl = null;
    if (file) {
      const fileName = `${profileId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('expense-documents').upload(fileName, file);
      if (uploadError) { toast.error('Failed to upload document'); setSubmitting(false); return; }
      const { data: urlData } = supabase.storage.from('expense-documents').getPublicUrl(fileName);
      documentUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from('expenses').insert({
      trip_id: formData.trip_id, category_id: formData.category_id, submitted_by: profileId,
      amount: parseFloat(formData.amount), expense_date: formData.expense_date,
      description: formData.description || null, document_url: documentUrl,
      fuel_quantity: isFuelCategory && formData.fuel_quantity ? parseFloat(formData.fuel_quantity) : null,
    });

    if (error) toast.error('Failed to submit expense');
    else { toast.success('Expense submitted for approval'); setDialogOpen(false); setFile(null); setFormData({ trip_id: '', category_id: '', amount: '', expense_date: new Date().toISOString().split('T')[0], description: '', fuel_quantity: '' }); init(); }
    setSubmitting(false);
  }

  const getStatusBadge = (s: ExpenseStatus) => <Badge variant={s === 'approved' ? 'default' : s === 'denied' ? 'destructive' : 'secondary'}>{s}</Badge>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Expenses</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Submit Expense</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Submit Expense</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label>Trip *</Label><Select value={formData.trip_id} onValueChange={v => setFormData({...formData, trip_id: v})}><SelectTrigger><SelectValue placeholder="Select trip" /></SelectTrigger><SelectContent>{trips.map(t => <SelectItem key={t.id} value={t.id}>{t.trip_number}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Category *</Label><Select value={formData.category_id} onValueChange={v => setFormData({...formData, category_id: v})}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Amount (₹) *</Label><Input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required /></div>
                </div>
                {isFuelCategory && (
                  <div className="space-y-2">
                    <Label>Fuel Quantity (Liters) *</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="e.g. 50" 
                      value={formData.fuel_quantity} 
                      onChange={e => setFormData({...formData, fuel_quantity: e.target.value})} 
                      required 
                    />
                    <p className="text-xs text-muted-foreground">Enter the quantity of fuel filled</p>
                  </div>
                )}
                <div className="space-y-2"><Label>Date *</Label><Input type="date" value={formData.expense_date} onChange={e => setFormData({...formData, expense_date: e.target.value})} required /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                <div className="space-y-2"><Label>Upload Bill/Receipt</Label><div className="flex items-center gap-2"><Input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} />{file && <span className="text-sm text-muted-foreground">{file.name}</span>}</div></div>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <Card><CardContent className="p-0">
          <Table><TableHeader><TableRow><TableHead>Trip</TableHead><TableHead>Category</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
            <TableBody>{loading ? <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> : expenses.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No expenses submitted</TableCell></TableRow> : expenses.map(e => <TableRow key={e.id}><TableCell>{(e.trip as any)?.trip_number}</TableCell><TableCell>{(e.category as any)?.name}</TableCell><TableCell>₹{Number(e.amount).toLocaleString('en-IN')}</TableCell><TableCell>{new Date(e.expense_date).toLocaleDateString('en-IN')}</TableCell><TableCell>{getStatusBadge(e.status)}</TableCell><TableCell className="max-w-[200px] truncate">{e.admin_remarks || '-'}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
