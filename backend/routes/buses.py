"""
Bus management routes
"""
import uuid
from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from database import get_db
from models import Bus, BusStatus, OwnershipType, IndianState
from auth import get_current_user, require_admin, TokenData

router = APIRouter()


class BusCreate(BaseModel):
    registration_number: str
    bus_name: Optional[str] = None
    capacity: int = 40
    bus_type: Optional[str] = "AC Sleeper"
    status: Optional[str] = "active"
    insurance_expiry: Optional[date] = None
    puc_expiry: Optional[date] = None
    fitness_expiry: Optional[date] = None
    ownership_type: Optional[str] = "owned"
    partner_name: Optional[str] = None
    company_profit_share: float = 100
    partner_profit_share: float = 0
    home_state_id: Optional[str] = None
    monthly_tax_amount: float = 0
    tax_due_day: int = 1


class BusUpdate(BaseModel):
    registration_number: Optional[str] = None
    bus_name: Optional[str] = None
    capacity: Optional[int] = None
    bus_type: Optional[str] = None
    status: Optional[str] = None
    insurance_expiry: Optional[date] = None
    puc_expiry: Optional[date] = None
    fitness_expiry: Optional[date] = None
    ownership_type: Optional[str] = None
    partner_name: Optional[str] = None
    company_profit_share: Optional[float] = None
    partner_profit_share: Optional[float] = None
    home_state_id: Optional[str] = None
    monthly_tax_amount: Optional[float] = None
    tax_due_day: Optional[int] = None


def bus_to_dict(bus: Bus) -> dict:
    return {
        "id": str(bus.id),
        "registration_number": bus.registration_number,
        "bus_name": bus.bus_name,
        "capacity": bus.capacity,
        "bus_type": bus.bus_type,
        "status": bus.status.value if bus.status else None,
        "insurance_expiry": str(bus.insurance_expiry) if bus.insurance_expiry else None,
        "puc_expiry": str(bus.puc_expiry) if bus.puc_expiry else None,
        "fitness_expiry": str(bus.fitness_expiry) if bus.fitness_expiry else None,
        "ownership_type": bus.ownership_type.value if bus.ownership_type else None,
        "partner_name": bus.partner_name,
        "company_profit_share": float(bus.company_profit_share) if bus.company_profit_share else 100,
        "partner_profit_share": float(bus.partner_profit_share) if bus.partner_profit_share else 0,
        "home_state_id": str(bus.home_state_id) if bus.home_state_id else None,
        "monthly_tax_amount": float(bus.monthly_tax_amount) if bus.monthly_tax_amount else 0,
        "tax_due_day": bus.tax_due_day,
        "last_tax_paid_date": str(bus.last_tax_paid_date) if bus.last_tax_paid_date else None,
        "next_tax_due_date": str(bus.next_tax_due_date) if bus.next_tax_due_date else None,
        "home_state": {
            "id": str(bus.home_state.id),
            "state_name": bus.home_state.state_name,
            "state_code": bus.home_state.state_code
        } if bus.home_state else None,
        "created_at": bus.created_at.isoformat() if bus.created_at else None,
        "updated_at": bus.updated_at.isoformat() if bus.updated_at else None
    }


@router.get("")
async def list_buses(
    status: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all buses (admin only for full data, drivers get limited view)"""
    query = db.query(Bus).options(joinedload(Bus.home_state))
    
    if status:
        query = query.filter(Bus.status == BusStatus(status))
    
    buses = query.order_by(Bus.registration_number).all()
    
    # Return limited data for non-admins
    if current_user.role != "admin":
        return [{
            "id": str(b.id),
            "registration_number": b.registration_number,
            "bus_name": b.bus_name,
            "capacity": b.capacity,
            "bus_type": b.bus_type,
            "status": b.status.value if b.status else None
        } for b in buses]
    
    return [bus_to_dict(b) for b in buses]


@router.get("/{bus_id}")
async def get_bus(
    bus_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single bus by ID"""
    bus = db.query(Bus).options(joinedload(Bus.home_state)).filter(
        Bus.id == uuid.UUID(bus_id)
    ).first()
    
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    
    return bus_to_dict(bus)


@router.post("")
async def create_bus(
    bus_data: BusCreate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new bus (admin only)"""
    bus = Bus(
        id=uuid.uuid4(),
        registration_number=bus_data.registration_number,
        bus_name=bus_data.bus_name,
        capacity=bus_data.capacity,
        bus_type=bus_data.bus_type,
        status=BusStatus(bus_data.status) if bus_data.status else BusStatus.active,
        insurance_expiry=bus_data.insurance_expiry,
        puc_expiry=bus_data.puc_expiry,
        fitness_expiry=bus_data.fitness_expiry,
        ownership_type=OwnershipType(bus_data.ownership_type) if bus_data.ownership_type else OwnershipType.owned,
        partner_name=bus_data.partner_name,
        company_profit_share=bus_data.company_profit_share,
        partner_profit_share=bus_data.partner_profit_share,
        home_state_id=uuid.UUID(bus_data.home_state_id) if bus_data.home_state_id else None,
        monthly_tax_amount=bus_data.monthly_tax_amount,
        tax_due_day=bus_data.tax_due_day
    )
    
    db.add(bus)
    db.commit()
    db.refresh(bus)
    
    return bus_to_dict(bus)


@router.put("/{bus_id}")
async def update_bus(
    bus_id: str,
    bus_data: BusUpdate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a bus (admin only)"""
    bus = db.query(Bus).filter(Bus.id == uuid.UUID(bus_id)).first()
    
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    
    update_data = bus_data.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        if key == "status" and value:
            setattr(bus, key, BusStatus(value))
        elif key == "ownership_type" and value:
            setattr(bus, key, OwnershipType(value))
        elif key == "home_state_id" and value:
            setattr(bus, key, uuid.UUID(value))
        else:
            setattr(bus, key, value)
    
    db.commit()
    db.refresh(bus)
    
    return bus_to_dict(bus)


@router.delete("/{bus_id}")
async def delete_bus(
    bus_id: str,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a bus (admin only)"""
    bus = db.query(Bus).filter(Bus.id == uuid.UUID(bus_id)).first()
    
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    
    db.delete(bus)
    db.commit()
    
    return {"message": "Bus deleted successfully"}
