import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { StockItem, StockTransaction } from '@/types/database';
import { Plus, Pencil, Loader2, Trash2, Package, TrendingDown, TrendingUp, History, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useTableFilters } from '@/hooks/useTableFilters';
import { SearchFilterBar, TablePagination } from '@/components/TableFilters';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

export default function StockManagement() {
  const { user } = useAuth();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [formData, setFormData] = useState({
    item_name: '',
    quantity: 0,
    low_stock_threshold: 50,
    unit: 'pieces',
    unit_price: 0,
    gst_percentage: 0,
    notes: '',
  });
  const [updateData, setUpdateData] = useState({
    quantity_change: 0,
    transaction_type: 'add' as 'add' | 'remove' | 'adjustment',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<StockItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Table filters
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalPages,
    showingFrom,
    showingTo,
    totalCount,
  } = useTableFilters({
    data: stockItems,
    searchFields: ['item_name'],
  });

  // Apply filters
  const filteredItems = paginatedData.filter((item) => {
    if (filters.status === 'low') {
      return item.quantity <= item.low_stock_threshold;
    }
    return true;
  });

  useEffect(() => {
    fetchStockItems();
  }, []);

  async function fetchStockItems() {
    const { data, error } = await supabase
      .from('stock_items')
      .select('*')
      .order('item_name');

    if (error) {
      toast.error('Failed to fetch stock items');
    } else {
      setStockItems(data as StockItem[]);
    }
    setLoading(false);
  }

  async function fetchTransactions(itemId: string) {
    const { data, error } = await supabase
      .from('stock_transactions')
      .select('*')
      .eq('stock_item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      toast.error('Failed to fetch transaction history');
    } else {
      setTransactions(data as StockTransaction[]);
    }
  }

  function handleEdit(item: StockItem) {
    setEditingItem(item);
    setFormData({
      item_name: item.item_name,
      quantity: item.quantity,
      low_stock_threshold: item.low_stock_threshold,
      unit: item.unit,
      unit_price: item.unit_price || 0,
      gst_percentage: item.gst_percentage || 0,
      notes: item.notes || '',
    });
    setDialogOpen(true);
  }

  function handleAddNew() {
    setEditingItem(null);
    setFormData({
      item_name: '',
      quantity: 0,
      low_stock_threshold: 50,
      unit: 'pieces',
      unit_price: 0,
      gst_percentage: 0,
      notes: '',
    });
    setDialogOpen(true);
  }

  function handleUpdateStock(item: StockItem) {
    setSelectedItem(item);
    setUpdateData({
      quantity_change: 0,
      transaction_type: 'add',
      notes: '',
    });
    setUpdateDialogOpen(true);
  }

  function handleViewHistory(item: StockItem) {
    setSelectedItem(item);
    fetchTransactions(item.id);
    setHistoryDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    // Get current user's profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user?.id)
      .single();

    const payload = {
      item_name: formData.item_name,
      quantity: formData.quantity,
      low_stock_threshold: formData.low_stock_threshold,
      unit: formData.unit,
      unit_price: formData.unit_price,
      gst_percentage: formData.gst_percentage,
      notes: formData.notes || null,
      last_updated_by: profile?.id || null,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('stock_items')
        .update(payload)
        .eq('id', editingItem.id);

      if (error) {
        toast.error('Failed to update stock item');
      } else {
        toast.success('Stock item updated successfully');
        setDialogOpen(false);
        fetchStockItems();
      }
    } else {
      const { error } = await supabase.from('stock_items').insert(payload);

      if (error) {
        toast.error(error.message || 'Failed to add stock item');
      } else {
        toast.success('Stock item added successfully');
        setDialogOpen(false);
        fetchStockItems();
      }
    }
    setSubmitting(false);
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;
    setSubmitting(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user?.id)
      .single();

    const quantityChange = updateData.transaction_type === 'remove' 
      ? -Math.abs(updateData.quantity_change)
      : Math.abs(updateData.quantity_change);

    const newQuantity = selectedItem.quantity + quantityChange;

    if (newQuantity < 0) {
      toast.error('Cannot reduce stock below 0');
      setSubmitting(false);
      return;
    }

    // Create transaction record
    const { error: transactionError } = await supabase
      .from('stock_transactions')
      .insert({
        stock_item_id: selectedItem.id,
        transaction_type: updateData.transaction_type,
        quantity_change: quantityChange,
        previous_quantity: selectedItem.quantity,
        new_quantity: newQuantity,
        notes: updateData.notes || null,
        created_by: profile?.id || null,
      });

    if (transactionError) {
      toast.error('Failed to record transaction');
      setSubmitting(false);
      return;
    }

    // Update stock quantity
    const { error } = await supabase
      .from('stock_items')
      .update({
        quantity: newQuantity,
        last_updated_by: profile?.id || null,
      })
      .eq('id', selectedItem.id);

    if (error) {
      toast.error('Failed to update stock');
    } else {
      toast.success('Stock updated successfully');
      setUpdateDialogOpen(false);
      fetchStockItems();
    }
    setSubmitting(false);
  }

  async function handleDeleteItem(item: StockItem) {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  }

  async function confirmDeleteItem() {
    if (!deletingItem) return;

    setDeleting(true);
    const { error } = await supabase
      .from('stock_items')
      .delete()
      .eq('id', deletingItem.id);

    if (error) {
      toast.error('Failed to delete stock item');
    } else {
      toast.success('Stock item deleted successfully');
      fetchStockItems();
    }

    setDeleting(false);
    setDeleteDialogOpen(false);
    setDeletingItem(null);
  }

  function getStockBadge(item: StockItem) {
    if (item.quantity <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (item.quantity <= item.low_stock_threshold) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-700">Low Stock</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-700">In Stock</Badge>;
  }

  const lowStockCount = stockItems.filter(item => item.quantity <= item.low_stock_threshold).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Stock Management</h1>
            <p className="text-muted-foreground">Manage company stock and inventory</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Stock Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit Stock Item' : 'Add New Stock Item'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="item_name">Item Name *</Label>
                  <Input
                    id="item_name"
                    value={formData.item_name}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    placeholder="e.g., Company Box"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Current Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="boxes, pieces, etc."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
                    <Input
                      id="low_stock_threshold"
                      type="number"
                      value={formData.low_stock_threshold}
                      onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 50 })}
                    />
                    <p className="text-xs text-muted-foreground">Alert below this</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit_price">Unit Price (₹)</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">Cost per unit</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gst_percentage">GST Rate (%)</Label>
                  <Input
                    id="gst_percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="28"
                    value={formData.gst_percentage}
                    onChange={(e) => setFormData({ ...formData, gst_percentage: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">GST rate for this item (0 if exempt)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingItem ? 'Update' : 'Add'} Item
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stockItems.length}</div>
            </CardContent>
          </Card>
          <Card className={lowStockCount > 0 ? 'border-orange-500' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${lowStockCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-orange-500' : ''}`}>{lowStockCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stockItems.reduce((sum, item) => sum + item.quantity, 0).toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-muted-foreground">Total units across all items</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Bar */}
        <SearchFilterBar
          searchPlaceholder="Search items..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          filters={[
            {
              key: 'status',
              label: 'Stock Status',
              value: filters.status || 'all',
              onChange: (value) => setFilter('status', value),
              options: [
                { label: 'All Items', value: 'all' },
                { label: 'Low Stock Only', value: 'low' },
              ],
            },
          ]}
        />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {stockItems.length === 0 ? 'No stock items added yet' : 'No items match your search'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell className="text-lg font-semibold">{item.quantity.toLocaleString('en-IN')}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{item.low_stock_threshold}</TableCell>
                      <TableCell>{getStockBadge(item)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleUpdateStock(item)} title="Update Stock">
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleViewHistory(item)} title="View History">
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item)} title="Delete">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              showingFrom={showingFrom}
              showingTo={showingTo}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemName="items"
            />
          </CardContent>
        </Card>

        {/* Update Stock Dialog */}
        <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Update Stock: {selectedItem?.item_name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Current Stock</p>
                <p className="text-3xl font-bold">{selectedItem?.quantity.toLocaleString('en-IN')} {selectedItem?.unit}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={updateData.transaction_type === 'add' ? 'default' : 'outline'}
                  onClick={() => setUpdateData({ ...updateData, transaction_type: 'add' })}
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Add
                </Button>
                <Button
                  type="button"
                  variant={updateData.transaction_type === 'remove' ? 'destructive' : 'outline'}
                  onClick={() => setUpdateData({ ...updateData, transaction_type: 'remove' })}
                >
                  <TrendingDown className="h-4 w-4 mr-1" />
                  Remove
                </Button>
                <Button
                  type="button"
                  variant={updateData.transaction_type === 'adjustment' ? 'secondary' : 'outline'}
                  onClick={() => setUpdateData({ ...updateData, transaction_type: 'adjustment' })}
                >
                  Adjust
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity_change">Quantity</Label>
                <Input
                  id="quantity_change"
                  type="number"
                  min={0}
                  value={updateData.quantity_change}
                  onChange={(e) => setUpdateData({ ...updateData, quantity_change: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="update_notes">Notes</Label>
                <Input
                  id="update_notes"
                  value={updateData.notes}
                  onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                  placeholder="Reason for update"
                />
              </div>

              {selectedItem && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">New Stock After Update</p>
                  <p className="text-2xl font-bold">
                    {(selectedItem.quantity + (updateData.transaction_type === 'remove' 
                      ? -Math.abs(updateData.quantity_change) 
                      : Math.abs(updateData.quantity_change))).toLocaleString('en-IN')} {selectedItem.unit}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setUpdateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || updateData.quantity_change === 0}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Update Stock
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Transaction History: {selectedItem?.item_name}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No transactions recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <Badge variant={
                          transaction.transaction_type === 'add' ? 'default' :
                          transaction.transaction_type === 'remove' ? 'destructive' : 'secondary'
                        }>
                          {transaction.transaction_type === 'add' && '+'}
                          {transaction.transaction_type === 'remove' && '-'}
                          {Math.abs(transaction.quantity_change)} {selectedItem?.unit}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(transaction.created_at), 'dd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm mt-1">
                        {transaction.previous_quantity} → {transaction.new_quantity}
                      </p>
                      {transaction.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{transaction.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Stock Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingItem?.item_name}"? This will also delete all transaction history. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteItem}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}