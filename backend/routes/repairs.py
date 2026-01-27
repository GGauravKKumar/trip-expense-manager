"""
Repair records management routes
"""
import uuid
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from database import get_db
from models import RepairRecord, RepairOrganization, Bus, Profile
from auth import get_current_user, require_admin, require_repair_org, TokenData

router = APIRouter()


class RepairCreate(BaseModel):
    repair_number: str
    bus_id: Optional[str] = None
    bus_registration: str
    repair_date: Optional[date] = None
    repair_type: str
    description: str
    parts_changed: Optional[str] = None
    parts_cost: float = 0
    labor_cost: float = 0
    gst_applicable: bool = True
    gst_percentage: float = 18
    warranty_days: int = 0
    notes: Optional[str] = None
    photo_before_url: Optional[str] = None
    photo_after_url: Optional[str] = None


class RepairUpdate(BaseModel):
    bus_registration: Optional[str] = None
    repair_date: Optional[date] = None
    repair_type: Optional[str] = None
    description: Optional[str] = None
    parts_changed: Optional[str] = None
    parts_cost: Optional[float] = None
    labor_cost: Optional[float] = None
    gst_applicable: Optional[bool] = None
    gst_percentage: Optional[float] = None
    warranty_days: Optional[int] = None
    notes: Optional[str] = None
    photo_before_url: Optional[str] = None
    photo_after_url: Optional[str] = None
    status: Optional[str] = None


def repair_to_dict(repair: RepairRecord) -> dict:
    total_cost = float(repair.parts_cost or 0) + float(repair.labor_cost or 0)
    gst_amount = 0
    if repair.gst_applicable:
        gst_amount = total_cost * float(repair.gst_percentage or 18) / 100
    
    return {
        "id": str(repair.id),
        "repair_number": repair.repair_number,
        "organization_id": str(repair.organization_id),
        "bus_id": str(repair.bus_id) if repair.bus_id else None,
        "bus_registration": repair.bus_registration,
        "repair_date": str(repair.repair_date) if repair.repair_date else None,
        "repair_type": repair.repair_type,
        "description": repair.description,
        "parts_changed": repair.parts_changed,
        "parts_cost": float(repair.parts_cost) if repair.parts_cost else 0,
        "labor_cost": float(repair.labor_cost) if repair.labor_cost else 0,
        "total_cost": total_cost + gst_amount,
        "gst_applicable": repair.gst_applicable,
        "gst_percentage": float(repair.gst_percentage) if repair.gst_percentage else 18,
        "gst_amount": gst_amount,
        "warranty_days": repair.warranty_days,
        "status": repair.status,
        "notes": repair.notes,
        "photo_before_url": repair.photo_before_url,
        "photo_after_url": repair.photo_after_url,
        "submitted_by": str(repair.submitted_by) if repair.submitted_by else None,
        "approved_by": str(repair.approved_by) if repair.approved_by else None,
        "approved_at": repair.approved_at.isoformat() if repair.approved_at else None,
        "repair_organizations": {
            "org_code": repair.organization.org_code,
            "org_name": repair.organization.org_name
        } if repair.organization else None,
        "buses": {
            "bus_name": repair.bus.bus_name
        } if repair.bus else None,
        "created_at": repair.created_at.isoformat() if repair.created_at else None,
        "updated_at": repair.updated_at.isoformat() if repair.updated_at else None
    }


@router.get("")
async def list_repairs(
    organization_id: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List repair records"""
    query = db.query(RepairRecord).options(
        joinedload(RepairRecord.organization),
        joinedload(RepairRecord.bus)
    )
    
    # Role-based filtering
    if current_user.role == "repair_org":
        # Get organization ID from profile
        profile = db.query(Profile).filter(Profile.id == uuid.UUID(current_user.profile_id)).first()
        if profile and profile.repair_org_id:
            query = query.filter(RepairRecord.organization_id == profile.repair_org_id)
        else:
            return []
    
    # Apply filters
    if organization_id:
        query = query.filter(RepairRecord.organization_id == uuid.UUID(organization_id))
    if status:
        query = query.filter(RepairRecord.status == status)
    if from_date:
        query = query.filter(RepairRecord.repair_date >= from_date)
    if to_date:
        query = query.filter(RepairRecord.repair_date <= to_date)
    
    repairs = query.order_by(RepairRecord.repair_date.desc()).offset(offset).limit(limit).all()
    
    return [repair_to_dict(r) for r in repairs]


@router.get("/organizations")
async def list_repair_organizations(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List repair organizations"""
    if current_user.role == "admin":
        orgs = db.query(RepairOrganization).order_by(RepairOrganization.org_name).all()
    else:
        # Repair org users can only see their own organization
        profile = db.query(Profile).filter(Profile.id == uuid.UUID(current_user.profile_id)).first()
        if profile and profile.repair_org_id:
            orgs = db.query(RepairOrganization).filter(
                RepairOrganization.id == profile.repair_org_id
            ).all()
        else:
            orgs = []
    
    return [{
        "id": str(o.id),
        "org_code": o.org_code,
        "org_name": o.org_name,
        "contact_person": o.contact_person,
        "phone": o.phone,
        "email": o.email,
        "address": o.address,
        "is_active": o.is_active
    } for o in orgs]


@router.get("/{repair_id}")
async def get_repair(
    repair_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single repair record"""
    repair = db.query(RepairRecord).options(
        joinedload(RepairRecord.organization),
        joinedload(RepairRecord.bus)
    ).filter(RepairRecord.id == uuid.UUID(repair_id)).first()
    
    if not repair:
        raise HTTPException(status_code=404, detail="Repair record not found")
    
    # Check access for repair org users
    if current_user.role == "repair_org":
        profile = db.query(Profile).filter(Profile.id == uuid.UUID(current_user.profile_id)).first()
        if not profile or repair.organization_id != profile.repair_org_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return repair_to_dict(repair)


@router.post("")
async def create_repair(
    repair_data: RepairCreate,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new repair record"""
    # Get organization ID
    if current_user.role == "repair_org":
        profile = db.query(Profile).filter(Profile.id == uuid.UUID(current_user.profile_id)).first()
        if not profile or not profile.repair_org_id:
            raise HTTPException(status_code=400, detail="Repair organization not configured")
        organization_id = profile.repair_org_id
    else:
        raise HTTPException(status_code=403, detail="Only repair organization users can create records")
    
    repair = RepairRecord(
        id=uuid.uuid4(),
        repair_number=repair_data.repair_number,
        organization_id=organization_id,
        bus_id=uuid.UUID(repair_data.bus_id) if repair_data.bus_id else None,
        bus_registration=repair_data.bus_registration,
        repair_date=repair_data.repair_date or date.today(),
        repair_type=repair_data.repair_type,
        description=repair_data.description,
        parts_changed=repair_data.parts_changed,
        parts_cost=repair_data.parts_cost,
        labor_cost=repair_data.labor_cost,
        gst_applicable=repair_data.gst_applicable,
        gst_percentage=repair_data.gst_percentage,
        warranty_days=repair_data.warranty_days,
        notes=repair_data.notes,
        photo_before_url=repair_data.photo_before_url,
        photo_after_url=repair_data.photo_after_url,
        submitted_by=uuid.UUID(current_user.profile_id),
        status="submitted"
    )
    
    db.add(repair)
    db.commit()
    db.refresh(repair)
    
    # Reload with relationships
    repair = db.query(RepairRecord).options(
        joinedload(RepairRecord.organization),
        joinedload(RepairRecord.bus)
    ).filter(RepairRecord.id == repair.id).first()
    
    return repair_to_dict(repair)


@router.put("/{repair_id}")
async def update_repair(
    repair_id: str,
    repair_data: RepairUpdate,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a repair record"""
    repair = db.query(RepairRecord).filter(RepairRecord.id == uuid.UUID(repair_id)).first()
    
    if not repair:
        raise HTTPException(status_code=404, detail="Repair record not found")
    
    # Check access
    if current_user.role == "repair_org":
        profile = db.query(Profile).filter(Profile.id == uuid.UUID(current_user.profile_id)).first()
        if not profile or repair.organization_id != profile.repair_org_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if repair.status != "submitted":
            raise HTTPException(status_code=400, detail="Cannot update approved/rejected record")
        # Repair org can only update specific fields
        allowed_fields = {
            "bus_registration", "repair_date", "repair_type", "description",
            "parts_changed", "parts_cost", "labor_cost", "gst_applicable",
            "gst_percentage", "warranty_days", "notes", "photo_before_url",
            "photo_after_url"
        }
        update_data = {k: v for k, v in repair_data.dict(exclude_unset=True).items() if k in allowed_fields}
    else:
        update_data = repair_data.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(repair, key, value)
    
    db.commit()
    db.refresh(repair)
    
    # Reload with relationships
    repair = db.query(RepairRecord).options(
        joinedload(RepairRecord.organization),
        joinedload(RepairRecord.bus)
    ).filter(RepairRecord.id == repair.id).first()
    
    return repair_to_dict(repair)


@router.delete("/{repair_id}")
async def delete_repair(
    repair_id: str,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a repair record (admin only)"""
    repair = db.query(RepairRecord).filter(RepairRecord.id == uuid.UUID(repair_id)).first()
    
    if not repair:
        raise HTTPException(status_code=404, detail="Repair record not found")
    
    db.delete(repair)
    db.commit()
    
    return {"message": "Repair record deleted successfully"}
