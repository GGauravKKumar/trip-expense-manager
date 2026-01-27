"""
Stock management routes
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import StockItem, StockTransaction, StockTransactionType
from auth import get_current_user, require_admin, TokenData

router = APIRouter()


class StockItemCreate(BaseModel):
    item_name: str
    quantity: int = 0
    unit: str = "pieces"
    unit_price: float = 0
    low_stock_threshold: int = 50
    gst_percentage: float = 0
    notes: Optional[str] = None


class StockItemUpdate(BaseModel):
    item_name: Optional[str] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    low_stock_threshold: Optional[int] = None
    gst_percentage: Optional[float] = None
    notes: Optional[str] = None


class StockAdjustment(BaseModel):
    quantity_change: int
    transaction_type: str  # add, remove, adjustment
    notes: Optional[str] = None


def stock_item_to_dict(item: StockItem) -> dict:
    return {
        "id": str(item.id),
        "item_name": item.item_name,
        "quantity": item.quantity,
        "unit": item.unit,
        "unit_price": float(item.unit_price) if item.unit_price else 0,
        "low_stock_threshold": item.low_stock_threshold,
        "gst_percentage": float(item.gst_percentage) if item.gst_percentage else 0,
        "notes": item.notes,
        "last_updated_by": str(item.last_updated_by) if item.last_updated_by else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None
    }


def transaction_to_dict(tx: StockTransaction) -> dict:
    return {
        "id": str(tx.id),
        "stock_item_id": str(tx.stock_item_id),
        "transaction_type": tx.transaction_type.value if tx.transaction_type else None,
        "quantity_change": tx.quantity_change,
        "previous_quantity": tx.previous_quantity,
        "new_quantity": tx.new_quantity,
        "notes": tx.notes,
        "created_by": str(tx.created_by) if tx.created_by else None,
        "created_at": tx.created_at.isoformat() if tx.created_at else None,
        "stock_item": {
            "id": str(tx.stock_item.id),
            "item_name": tx.stock_item.item_name
        } if tx.stock_item else None
    }


@router.get("")
async def list_stock_items(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all stock items"""
    # Only admin and driver can view
    if current_user.role not in ["admin", "driver"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    items = db.query(StockItem).order_by(StockItem.item_name).all()
    
    return [stock_item_to_dict(i) for i in items]


@router.get("/transactions")
async def list_stock_transactions(
    stock_item_id: Optional[str] = None,
    limit: int = 100,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List stock transactions"""
    if current_user.role not in ["admin", "driver"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(StockTransaction)
    
    if stock_item_id:
        query = query.filter(StockTransaction.stock_item_id == uuid.UUID(stock_item_id))
    
    transactions = query.order_by(StockTransaction.created_at.desc()).limit(limit).all()
    
    return [transaction_to_dict(t) for t in transactions]


@router.get("/{item_id}")
async def get_stock_item(
    item_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single stock item"""
    if current_user.role not in ["admin", "driver"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    item = db.query(StockItem).filter(StockItem.id == uuid.UUID(item_id)).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    return stock_item_to_dict(item)


@router.post("")
async def create_stock_item(
    item_data: StockItemCreate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new stock item (admin only)"""
    item = StockItem(
        id=uuid.uuid4(),
        item_name=item_data.item_name,
        quantity=item_data.quantity,
        unit=item_data.unit,
        unit_price=item_data.unit_price,
        low_stock_threshold=item_data.low_stock_threshold,
        gst_percentage=item_data.gst_percentage,
        notes=item_data.notes,
        last_updated_by=uuid.UUID(current_user.profile_id)
    )
    
    db.add(item)
    db.commit()
    db.refresh(item)
    
    return stock_item_to_dict(item)


@router.put("/{item_id}")
async def update_stock_item(
    item_id: str,
    item_data: StockItemUpdate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a stock item (admin only)"""
    item = db.query(StockItem).filter(StockItem.id == uuid.UUID(item_id)).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    update_data = item_data.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(item, key, value)
    
    item.last_updated_by = uuid.UUID(current_user.profile_id)
    
    db.commit()
    db.refresh(item)
    
    return stock_item_to_dict(item)


@router.post("/{item_id}/adjust")
async def adjust_stock(
    item_id: str,
    adjustment: StockAdjustment,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Adjust stock quantity (admin or driver)"""
    if current_user.role not in ["admin", "driver"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    item = db.query(StockItem).filter(StockItem.id == uuid.UUID(item_id)).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    previous_quantity = item.quantity
    
    # Calculate new quantity
    tx_type = StockTransactionType(adjustment.transaction_type)
    if tx_type == StockTransactionType.add:
        new_quantity = previous_quantity + adjustment.quantity_change
    elif tx_type == StockTransactionType.remove:
        new_quantity = previous_quantity - adjustment.quantity_change
        if new_quantity < 0:
            raise HTTPException(status_code=400, detail="Insufficient stock")
    else:  # adjustment
        new_quantity = previous_quantity + adjustment.quantity_change
    
    # Create transaction
    transaction = StockTransaction(
        id=uuid.uuid4(),
        stock_item_id=item.id,
        transaction_type=tx_type,
        quantity_change=adjustment.quantity_change,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        notes=adjustment.notes,
        created_by=uuid.UUID(current_user.profile_id)
    )
    db.add(transaction)
    
    # Update item quantity
    item.quantity = new_quantity
    item.last_updated_by = uuid.UUID(current_user.profile_id)
    
    db.commit()
    db.refresh(item)
    
    return stock_item_to_dict(item)


@router.delete("/{item_id}")
async def delete_stock_item(
    item_id: str,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a stock item (admin only)"""
    item = db.query(StockItem).filter(StockItem.id == uuid.UUID(item_id)).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    db.delete(item)
    db.commit()
    
    return {"message": "Stock item deleted successfully"}
