"""
Schedule management routes
"""
import uuid
from typing import Optional, List
from datetime import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from database import get_db
from models import BusSchedule, Bus, Route, Profile
from auth import get_current_user, require_admin, TokenData

router = APIRouter()


class ScheduleCreate(BaseModel):
    bus_id: str
    route_id: str
    driver_id: Optional[str] = None
    days_of_week: List[str] = []
    departure_time: str  # HH:MM format
    arrival_time: str
    is_two_way: bool = True
    return_departure_time: Optional[str] = None
    return_arrival_time: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None
    is_overnight: bool = False
    arrival_next_day: bool = False
    turnaround_hours: float = 3


class ScheduleUpdate(BaseModel):
    bus_id: Optional[str] = None
    route_id: Optional[str] = None
    driver_id: Optional[str] = None
    days_of_week: Optional[List[str]] = None
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None
    is_two_way: Optional[bool] = None
    return_departure_time: Optional[str] = None
    return_arrival_time: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    is_overnight: Optional[bool] = None
    arrival_next_day: Optional[bool] = None
    turnaround_hours: Optional[float] = None


def parse_time(time_str: str) -> time:
    """Parse time string HH:MM to time object"""
    parts = time_str.split(":")
    return time(int(parts[0]), int(parts[1]))


def schedule_to_dict(schedule: BusSchedule) -> dict:
    return {
        "id": str(schedule.id),
        "bus_id": str(schedule.bus_id),
        "route_id": str(schedule.route_id),
        "driver_id": str(schedule.driver_id) if schedule.driver_id else None,
        "days_of_week": schedule.days_of_week,
        "departure_time": str(schedule.departure_time) if schedule.departure_time else None,
        "arrival_time": str(schedule.arrival_time) if schedule.arrival_time else None,
        "is_two_way": schedule.is_two_way,
        "return_departure_time": str(schedule.return_departure_time) if schedule.return_departure_time else None,
        "return_arrival_time": str(schedule.return_arrival_time) if schedule.return_arrival_time else None,
        "is_active": schedule.is_active,
        "notes": schedule.notes,
        "is_overnight": schedule.is_overnight,
        "arrival_next_day": schedule.arrival_next_day,
        "turnaround_hours": float(schedule.turnaround_hours) if schedule.turnaround_hours else 3,
        "bus": {
            "id": str(schedule.bus.id),
            "registration_number": schedule.bus.registration_number,
            "bus_name": schedule.bus.bus_name
        } if schedule.bus else None,
        "route": {
            "id": str(schedule.route.id),
            "route_name": schedule.route.route_name
        } if schedule.route else None,
        "driver": {
            "id": str(schedule.driver.id),
            "full_name": schedule.driver.full_name
        } if schedule.driver else None,
        "created_at": schedule.created_at.isoformat() if schedule.created_at else None,
        "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None
    }


@router.get("")
async def list_schedules(
    bus_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all schedules"""
    query = db.query(BusSchedule).options(
        joinedload(BusSchedule.bus),
        joinedload(BusSchedule.route),
        joinedload(BusSchedule.driver)
    )
    
    if bus_id:
        query = query.filter(BusSchedule.bus_id == uuid.UUID(bus_id))
    if is_active is not None:
        query = query.filter(BusSchedule.is_active == is_active)
    
    schedules = query.order_by(BusSchedule.departure_time).all()
    
    return [schedule_to_dict(s) for s in schedules]


@router.get("/{schedule_id}")
async def get_schedule(
    schedule_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single schedule by ID"""
    schedule = db.query(BusSchedule).options(
        joinedload(BusSchedule.bus),
        joinedload(BusSchedule.route),
        joinedload(BusSchedule.driver)
    ).filter(BusSchedule.id == uuid.UUID(schedule_id)).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    return schedule_to_dict(schedule)


@router.post("")
async def create_schedule(
    schedule_data: ScheduleCreate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new schedule (admin only)"""
    schedule = BusSchedule(
        id=uuid.uuid4(),
        bus_id=uuid.UUID(schedule_data.bus_id),
        route_id=uuid.UUID(schedule_data.route_id),
        driver_id=uuid.UUID(schedule_data.driver_id) if schedule_data.driver_id else None,
        days_of_week=schedule_data.days_of_week,
        departure_time=parse_time(schedule_data.departure_time),
        arrival_time=parse_time(schedule_data.arrival_time),
        is_two_way=schedule_data.is_two_way,
        return_departure_time=parse_time(schedule_data.return_departure_time) if schedule_data.return_departure_time else None,
        return_arrival_time=parse_time(schedule_data.return_arrival_time) if schedule_data.return_arrival_time else None,
        is_active=schedule_data.is_active,
        notes=schedule_data.notes,
        is_overnight=schedule_data.is_overnight,
        arrival_next_day=schedule_data.arrival_next_day,
        turnaround_hours=schedule_data.turnaround_hours
    )
    
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    
    # Reload with relationships
    schedule = db.query(BusSchedule).options(
        joinedload(BusSchedule.bus),
        joinedload(BusSchedule.route),
        joinedload(BusSchedule.driver)
    ).filter(BusSchedule.id == schedule.id).first()
    
    return schedule_to_dict(schedule)


@router.put("/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    schedule_data: ScheduleUpdate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a schedule (admin only)"""
    schedule = db.query(BusSchedule).filter(BusSchedule.id == uuid.UUID(schedule_id)).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    update_data = schedule_data.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        if key in ["bus_id", "route_id", "driver_id"] and value:
            setattr(schedule, key, uuid.UUID(value))
        elif key in ["departure_time", "arrival_time", "return_departure_time", "return_arrival_time"] and value:
            setattr(schedule, key, parse_time(value))
        else:
            setattr(schedule, key, value)
    
    db.commit()
    db.refresh(schedule)
    
    # Reload with relationships
    schedule = db.query(BusSchedule).options(
        joinedload(BusSchedule.bus),
        joinedload(BusSchedule.route),
        joinedload(BusSchedule.driver)
    ).filter(BusSchedule.id == schedule.id).first()
    
    return schedule_to_dict(schedule)


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a schedule (admin only)"""
    schedule = db.query(BusSchedule).filter(BusSchedule.id == uuid.UUID(schedule_id)).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    db.delete(schedule)
    db.commit()
    
    return {"message": "Schedule deleted successfully"}
