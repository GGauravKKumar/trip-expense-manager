"""
Invoice management routes
"""
import uuid
from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from database import get_db
from models import Invoice, InvoiceLineItem, InvoicePayment, InvoiceStatus, InvoiceType
from auth import get_current_user, require_admin, TokenData

router = APIRouter()


class LineItemCreate(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0
    gst_percentage: float = 18
    rate_includes_gst: bool = False
    is_deduction: bool = False


class InvoiceCreate(BaseModel):
    invoice_number: str
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    invoice_type: Optional[str] = "customer"
    customer_name: str
    customer_address: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_gst: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_address: Optional[str] = None
    vendor_phone: Optional[str] = None
    vendor_gst: Optional[str] = None
    trip_id: Optional[str] = None
    bus_id: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    direction: Optional[str] = "sales"
    category: Optional[str] = "general"
    line_items: List[LineItemCreate] = []


class InvoiceUpdate(BaseModel):
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    customer_name: Optional[str] = None
    customer_address: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_gst: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    status: Optional[str] = None


class PaymentCreate(BaseModel):
    amount: float
    payment_date: Optional[date] = None
    payment_mode: str = "Cash"
    reference_number: Optional[str] = None
    notes: Optional[str] = None


def calculate_line_item_amounts(item: LineItemCreate) -> dict:
    """Calculate line item amounts"""
    if item.rate_includes_gst:
        # Rate includes GST, need to extract base amount
        total = item.quantity * item.unit_price
        base_amount = total / (1 + item.gst_percentage / 100)
        gst_amount = total - base_amount
    else:
        # Rate excludes GST
        base_amount = item.quantity * item.unit_price
        gst_amount = base_amount * item.gst_percentage / 100
        total = base_amount + gst_amount
    
    return {
        "base_amount": base_amount,
        "gst_amount": gst_amount,
        "amount": total
    }


def invoice_to_dict(invoice: Invoice) -> dict:
    return {
        "id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "invoice_date": str(invoice.invoice_date) if invoice.invoice_date else None,
        "due_date": str(invoice.due_date) if invoice.due_date else None,
        "invoice_type": invoice.invoice_type.value if invoice.invoice_type else None,
        "customer_name": invoice.customer_name,
        "customer_address": invoice.customer_address,
        "customer_phone": invoice.customer_phone,
        "customer_gst": invoice.customer_gst,
        "vendor_name": invoice.vendor_name,
        "vendor_address": invoice.vendor_address,
        "vendor_phone": invoice.vendor_phone,
        "vendor_gst": invoice.vendor_gst,
        "trip_id": str(invoice.trip_id) if invoice.trip_id else None,
        "bus_id": str(invoice.bus_id) if invoice.bus_id else None,
        "subtotal": float(invoice.subtotal),
        "gst_amount": float(invoice.gst_amount),
        "total_amount": float(invoice.total_amount),
        "amount_paid": float(invoice.amount_paid),
        "balance_due": float(invoice.balance_due),
        "status": invoice.status.value if invoice.status else None,
        "notes": invoice.notes,
        "terms": invoice.terms,
        "direction": invoice.direction,
        "category": invoice.category,
        "line_items": [{
            "id": str(item.id),
            "description": item.description,
            "quantity": float(item.quantity),
            "unit_price": float(item.unit_price),
            "gst_percentage": float(item.gst_percentage),
            "rate_includes_gst": item.rate_includes_gst,
            "base_amount": float(item.base_amount),
            "gst_amount": float(item.gst_amount),
            "amount": float(item.amount),
            "is_deduction": item.is_deduction
        } for item in invoice.line_items] if invoice.line_items else [],
        "payments": [{
            "id": str(p.id),
            "amount": float(p.amount),
            "payment_date": str(p.payment_date) if p.payment_date else None,
            "payment_mode": p.payment_mode,
            "reference_number": p.reference_number,
            "notes": p.notes
        } for p in invoice.payments] if invoice.payments else [],
        "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
        "updated_at": invoice.updated_at.isoformat() if invoice.updated_at else None
    }


@router.get("")
async def list_invoices(
    status: Optional[str] = None,
    direction: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List invoices (admin only)"""
    query = db.query(Invoice).options(
        joinedload(Invoice.line_items),
        joinedload(Invoice.payments)
    )
    
    if status:
        query = query.filter(Invoice.status == InvoiceStatus(status))
    if direction:
        query = query.filter(Invoice.direction == direction)
    if from_date:
        query = query.filter(Invoice.invoice_date >= from_date)
    if to_date:
        query = query.filter(Invoice.invoice_date <= to_date)
    
    invoices = query.order_by(Invoice.invoice_date.desc()).offset(offset).limit(limit).all()
    
    return [invoice_to_dict(i) for i in invoices]


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get a single invoice"""
    invoice = db.query(Invoice).options(
        joinedload(Invoice.line_items),
        joinedload(Invoice.payments)
    ).filter(Invoice.id == uuid.UUID(invoice_id)).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return invoice_to_dict(invoice)


@router.post("")
async def create_invoice(
    invoice_data: InvoiceCreate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new invoice (admin only)"""
    # Calculate totals from line items
    subtotal = 0
    gst_amount = 0
    
    invoice = Invoice(
        id=uuid.uuid4(),
        invoice_number=invoice_data.invoice_number,
        invoice_date=invoice_data.invoice_date or date.today(),
        due_date=invoice_data.due_date,
        invoice_type=InvoiceType(invoice_data.invoice_type) if invoice_data.invoice_type else InvoiceType.customer,
        customer_name=invoice_data.customer_name,
        customer_address=invoice_data.customer_address,
        customer_phone=invoice_data.customer_phone,
        customer_gst=invoice_data.customer_gst,
        vendor_name=invoice_data.vendor_name,
        vendor_address=invoice_data.vendor_address,
        vendor_phone=invoice_data.vendor_phone,
        vendor_gst=invoice_data.vendor_gst,
        trip_id=uuid.UUID(invoice_data.trip_id) if invoice_data.trip_id else None,
        bus_id=uuid.UUID(invoice_data.bus_id) if invoice_data.bus_id else None,
        notes=invoice_data.notes,
        terms=invoice_data.terms,
        direction=invoice_data.direction,
        category=invoice_data.category,
        status=InvoiceStatus.draft
    )
    
    db.add(invoice)
    db.flush()
    
    # Add line items
    for item_data in invoice_data.line_items:
        amounts = calculate_line_item_amounts(item_data)
        
        line_item = InvoiceLineItem(
            id=uuid.uuid4(),
            invoice_id=invoice.id,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            gst_percentage=item_data.gst_percentage,
            rate_includes_gst=item_data.rate_includes_gst,
            base_amount=amounts["base_amount"],
            gst_amount=amounts["gst_amount"],
            amount=amounts["amount"],
            is_deduction=item_data.is_deduction
        )
        db.add(line_item)
        
        if item_data.is_deduction:
            subtotal -= amounts["base_amount"]
            gst_amount -= amounts["gst_amount"]
        else:
            subtotal += amounts["base_amount"]
            gst_amount += amounts["gst_amount"]
    
    # Update invoice totals
    invoice.subtotal = subtotal
    invoice.gst_amount = gst_amount
    invoice.total_amount = subtotal + gst_amount
    invoice.balance_due = invoice.total_amount
    
    db.commit()
    
    # Reload with relationships
    invoice = db.query(Invoice).options(
        joinedload(Invoice.line_items),
        joinedload(Invoice.payments)
    ).filter(Invoice.id == invoice.id).first()
    
    return invoice_to_dict(invoice)


@router.put("/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    invoice_data: InvoiceUpdate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update an invoice (admin only)"""
    invoice = db.query(Invoice).filter(Invoice.id == uuid.UUID(invoice_id)).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    update_data = invoice_data.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        if key == "status" and value:
            setattr(invoice, key, InvoiceStatus(value))
        else:
            setattr(invoice, key, value)
    
    db.commit()
    
    # Reload with relationships
    invoice = db.query(Invoice).options(
        joinedload(Invoice.line_items),
        joinedload(Invoice.payments)
    ).filter(Invoice.id == invoice.id).first()
    
    return invoice_to_dict(invoice)


@router.post("/{invoice_id}/payments")
async def add_payment(
    invoice_id: str,
    payment_data: PaymentCreate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Add a payment to an invoice (admin only)"""
    invoice = db.query(Invoice).filter(Invoice.id == uuid.UUID(invoice_id)).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    payment = InvoicePayment(
        id=uuid.uuid4(),
        invoice_id=invoice.id,
        amount=payment_data.amount,
        payment_date=payment_data.payment_date or date.today(),
        payment_mode=payment_data.payment_mode,
        reference_number=payment_data.reference_number,
        notes=payment_data.notes,
        created_by=uuid.UUID(current_user.profile_id)
    )
    
    db.add(payment)
    
    # Update invoice amounts
    invoice.amount_paid = float(invoice.amount_paid) + payment_data.amount
    invoice.balance_due = float(invoice.total_amount) - float(invoice.amount_paid)
    
    # Update status
    if invoice.balance_due <= 0:
        invoice.status = InvoiceStatus.paid
    elif invoice.amount_paid > 0:
        invoice.status = InvoiceStatus.partial
    
    db.commit()
    
    # Reload with relationships
    invoice = db.query(Invoice).options(
        joinedload(Invoice.line_items),
        joinedload(Invoice.payments)
    ).filter(Invoice.id == invoice.id).first()
    
    return invoice_to_dict(invoice)


@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete an invoice (admin only)"""
    invoice = db.query(Invoice).filter(Invoice.id == uuid.UUID(invoice_id)).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    db.delete(invoice)
    db.commit()
    
    return {"message": "Invoice deleted successfully"}
