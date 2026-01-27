"""
Expense management routes
"""
import uuid
from typing import Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from database import get_db
from models import Expense, ExpenseStatus, ExpenseCategory, Trip, Profile
from auth import get_current_user, require_admin, TokenData

router = APIRouter()


class ExpenseCreate(BaseModel):
    trip_id: str
    category_id: str
    amount: float
    expense_date: Optional[date] = None
    description: Optional[str] = None
    document_url: Optional[str] = None
    fuel_quantity: Optional[float] = None


class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    expense_date: Optional[date] = None
    description: Optional[str] = None
    document_url: Optional[str] = None
    fuel_quantity: Optional[float] = None
    status: Optional[str] = None
    admin_remarks: Optional[str] = None


def expense_to_dict(expense: Expense) -> dict:
    return {
        "id": str(expense.id),
        "trip_id": str(expense.trip_id),
        "category_id": str(expense.category_id),
        "submitted_by": str(expense.submitted_by),
        "amount": float(expense.amount),
        "expense_date": str(expense.expense_date) if expense.expense_date else None,
        "description": expense.description,
        "document_url": expense.document_url,
        "fuel_quantity": float(expense.fuel_quantity) if expense.fuel_quantity else None,
        "status": expense.status.value if expense.status else None,
        "admin_remarks": expense.admin_remarks,
        "approved_by": str(expense.approved_by) if expense.approved_by else None,
        "approved_at": expense.approved_at.isoformat() if expense.approved_at else None,
        "category": {
            "id": str(expense.category.id),
            "name": expense.category.name,
            "icon": expense.category.icon
        } if expense.category else None,
        "trip": {
            "id": str(expense.trip.id),
            "trip_number": expense.trip.trip_number
        } if expense.trip else None,
        "submitter": {
            "id": str(expense.submitter.id),
            "full_name": expense.submitter.full_name
        } if expense.submitter else None,
        "created_at": expense.created_at.isoformat() if expense.created_at else None,
        "updated_at": expense.updated_at.isoformat() if expense.updated_at else None
    }


@router.get("")
async def list_expenses(
    trip_id: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List expenses with optional filters"""
    query = db.query(Expense).options(
        joinedload(Expense.category),
        joinedload(Expense.trip),
        joinedload(Expense.submitter)
    )
    
    # Role-based filtering
    if current_user.role == "driver":
        query = query.filter(Expense.submitted_by == uuid.UUID(current_user.profile_id))
    
    # Apply filters
    if trip_id:
        query = query.filter(Expense.trip_id == uuid.UUID(trip_id))
    if status:
        query = query.filter(Expense.status == ExpenseStatus(status))
    if from_date:
        query = query.filter(Expense.expense_date >= from_date)
    if to_date:
        query = query.filter(Expense.expense_date <= to_date)
    
    expenses = query.order_by(Expense.created_at.desc()).offset(offset).limit(limit).all()
    
    return [expense_to_dict(e) for e in expenses]


@router.get("/categories")
async def list_expense_categories(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all expense categories"""
    categories = db.query(ExpenseCategory).order_by(ExpenseCategory.name).all()
    
    return [{
        "id": str(c.id),
        "name": c.name,
        "description": c.description,
        "icon": c.icon
    } for c in categories]


@router.get("/{expense_id}")
async def get_expense(
    expense_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single expense by ID"""
    expense = db.query(Expense).options(
        joinedload(Expense.category),
        joinedload(Expense.trip),
        joinedload(Expense.submitter)
    ).filter(Expense.id == uuid.UUID(expense_id)).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Check access
    if current_user.role == "driver" and str(expense.submitted_by) != current_user.profile_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return expense_to_dict(expense)


@router.post("")
async def create_expense(
    expense_data: ExpenseCreate,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new expense"""
    expense = Expense(
        id=uuid.uuid4(),
        trip_id=uuid.UUID(expense_data.trip_id),
        category_id=uuid.UUID(expense_data.category_id),
        submitted_by=uuid.UUID(current_user.profile_id),
        amount=expense_data.amount,
        expense_date=expense_data.expense_date or date.today(),
        description=expense_data.description,
        document_url=expense_data.document_url,
        fuel_quantity=expense_data.fuel_quantity,
        status=ExpenseStatus.pending
    )
    
    db.add(expense)
    db.commit()
    db.refresh(expense)
    
    # Reload with relationships
    expense = db.query(Expense).options(
        joinedload(Expense.category),
        joinedload(Expense.trip),
        joinedload(Expense.submitter)
    ).filter(Expense.id == expense.id).first()
    
    return expense_to_dict(expense)


@router.put("/{expense_id}")
async def update_expense(
    expense_id: str,
    expense_data: ExpenseUpdate,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an expense"""
    expense = db.query(Expense).filter(Expense.id == uuid.UUID(expense_id)).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Check access for drivers
    if current_user.role == "driver":
        if str(expense.submitted_by) != current_user.profile_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if expense.status != ExpenseStatus.pending:
            raise HTTPException(status_code=400, detail="Cannot update approved/denied expense")
        # Drivers can only update specific fields
        allowed_fields = {"amount", "expense_date", "description", "document_url", "fuel_quantity"}
        update_data = {k: v for k, v in expense_data.dict(exclude_unset=True).items() if k in allowed_fields}
    else:
        update_data = expense_data.dict(exclude_unset=True)
        
        # Handle status change for admins
        if "status" in update_data:
            new_status = ExpenseStatus(update_data["status"])
            if new_status in [ExpenseStatus.approved, ExpenseStatus.denied]:
                expense.approved_by = uuid.UUID(current_user.profile_id)
                expense.approved_at = datetime.utcnow()
    
    for key, value in update_data.items():
        if key == "status" and value:
            setattr(expense, key, ExpenseStatus(value))
        else:
            setattr(expense, key, value)
    
    db.commit()
    db.refresh(expense)
    
    # Reload with relationships
    expense = db.query(Expense).options(
        joinedload(Expense.category),
        joinedload(Expense.trip),
        joinedload(Expense.submitter)
    ).filter(Expense.id == expense.id).first()
    
    return expense_to_dict(expense)


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an expense"""
    expense = db.query(Expense).filter(Expense.id == uuid.UUID(expense_id)).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Check access
    if current_user.role == "driver":
        if str(expense.submitted_by) != current_user.profile_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if expense.status != ExpenseStatus.pending:
            raise HTTPException(status_code=400, detail="Cannot delete approved/denied expense")
    
    db.delete(expense)
    db.commit()
    
    return {"message": "Expense deleted successfully"}
