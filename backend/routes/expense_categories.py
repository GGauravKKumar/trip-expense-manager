"""
Expense categories routes
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import ExpenseCategory
from auth import get_current_user, require_admin, TokenData

router = APIRouter()


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None


def category_to_dict(cat: ExpenseCategory) -> dict:
    return {
        "id": str(cat.id),
        "name": cat.name,
        "description": cat.description,
        "icon": cat.icon,
        "created_at": cat.created_at.isoformat() if cat.created_at else None
    }


@router.get("")
async def list_categories(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all expense categories"""
    categories = db.query(ExpenseCategory).order_by(ExpenseCategory.name).all()
    return [category_to_dict(c) for c in categories]


@router.get("/{category_id}")
async def get_category(
    category_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single category by ID"""
    category = db.query(ExpenseCategory).filter(
        ExpenseCategory.id == uuid.UUID(category_id)
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return category_to_dict(category)


@router.post("")
async def create_category(
    data: CategoryCreate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new expense category (admin only)"""
    category = ExpenseCategory(
        id=uuid.uuid4(),
        name=data.name,
        description=data.description,
        icon=data.icon
    )
    
    db.add(category)
    db.commit()
    db.refresh(category)
    
    return category_to_dict(category)


@router.put("/{category_id}")
async def update_category(
    category_id: str,
    data: CategoryUpdate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update an expense category (admin only)"""
    category = db.query(ExpenseCategory).filter(
        ExpenseCategory.id == uuid.UUID(category_id)
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)
    
    db.commit()
    db.refresh(category)
    
    return category_to_dict(category)


@router.delete("/{category_id}")
async def delete_category(
    category_id: str,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete an expense category (admin only)"""
    category = db.query(ExpenseCategory).filter(
        ExpenseCategory.id == uuid.UUID(category_id)
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    db.delete(category)
    db.commit()
    
    return {"message": "Category deleted successfully"}
