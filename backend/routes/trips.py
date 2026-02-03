"""
Trip management routes
"""
import uuid
from typing import Optional, List
from datetime import date, datetime, time
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from database import get_db
from models import Trip, TripStatus, Bus, Profile, Route
from auth import get_current_user, require_admin, TokenData

router = APIRouter()


class TripCreate(BaseModel):
    trip_number: str
    bus_id: Optional[str] = None
    driver_id: Optional[str] = None
    route_id: str
    schedule_id: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    trip_date: Optional[date] = None
    status: Optional[str] = "scheduled"
    trip_type: Optional[str] = "one_way"
    notes: Optional[str] = None
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None


class TripUpdate(BaseModel):
    bus_id: Optional[str] = None
    driver_id: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    odometer_start: Optional[float] = None
    odometer_end: Optional[float] = None
    revenue_cash: Optional[float] = None
    revenue_online: Optional[float] = None
    revenue_paytm: Optional[float] = None
    revenue_others: Optional[float] = None
    revenue_agent: Optional[float] = None
    water_taken: Optional[int] = None
    odometer_return_start: Optional[float] = None
    odometer_return_end: Optional[float] = None
    return_revenue_cash: Optional[float] = None
    return_revenue_online: Optional[float] = None
    return_revenue_paytm: Optional[float] = None
    return_revenue_others: Optional[float] = None
    return_revenue_agent: Optional[float] = None


def trip_to_dict(trip: Trip) -> dict:
    return {
        "id": str(trip.id),
        "trip_number": trip.trip_number,
        "bus_id": str(trip.bus_id) if trip.bus_id else None,
        "driver_id": str(trip.driver_id) if trip.driver_id else None,
        "route_id": str(trip.route_id),
        "schedule_id": str(trip.schedule_id) if trip.schedule_id else None,
        "start_date": trip.start_date.isoformat() if trip.start_date else None,
        "end_date": trip.end_date.isoformat() if trip.end_date else None,
        "trip_date": str(trip.trip_date) if trip.trip_date else None,
        "status": trip.status.value if trip.status else None,
        "trip_type": trip.trip_type,
        "notes": trip.notes,
        "bus_name_snapshot": trip.bus_name_snapshot,
        "driver_name_snapshot": trip.driver_name_snapshot,
        # Outward journey
        "departure_time": str(trip.departure_time) if trip.departure_time else None,
        "arrival_time": str(trip.arrival_time) if trip.arrival_time else None,
        "odometer_start": float(trip.odometer_start) if trip.odometer_start else None,
        "odometer_end": float(trip.odometer_end) if trip.odometer_end else None,
        "distance_traveled": trip.distance_traveled,
        "revenue_cash": float(trip.revenue_cash) if trip.revenue_cash else 0,
        "revenue_online": float(trip.revenue_online) if trip.revenue_online else 0,
        "revenue_paytm": float(trip.revenue_paytm) if trip.revenue_paytm else 0,
        "revenue_others": float(trip.revenue_others) if trip.revenue_others else 0,
        "revenue_agent": float(trip.revenue_agent) if trip.revenue_agent else 0,
        "total_revenue": trip.total_revenue,
        "total_expense": float(trip.total_expense) if trip.total_expense else 0,
        "gst_percentage": float(trip.gst_percentage) if trip.gst_percentage else 18,
        "water_taken": trip.water_taken,
        # Return journey
        "return_departure_time": str(trip.return_departure_time) if trip.return_departure_time else None,
        "return_arrival_time": str(trip.return_arrival_time) if trip.return_arrival_time else None,
        "odometer_return_start": float(trip.odometer_return_start) if trip.odometer_return_start else None,
        "odometer_return_end": float(trip.odometer_return_end) if trip.odometer_return_end else None,
        "distance_return": trip.distance_return,
        "return_revenue_cash": float(trip.return_revenue_cash) if trip.return_revenue_cash else 0,
        "return_revenue_online": float(trip.return_revenue_online) if trip.return_revenue_online else 0,
        "return_revenue_paytm": float(trip.return_revenue_paytm) if trip.return_revenue_paytm else 0,
        "return_revenue_others": float(trip.return_revenue_others) if trip.return_revenue_others else 0,
        "return_revenue_agent": float(trip.return_revenue_agent) if trip.return_revenue_agent else 0,
        "return_total_revenue": float(trip.return_total_revenue) if trip.return_total_revenue else 0,
        "return_total_expense": float(trip.return_total_expense) if trip.return_total_expense else 0,
        # Relations
        "bus": {
            "id": str(trip.bus.id),
            "registration_number": trip.bus.registration_number,
            "bus_name": trip.bus.bus_name
        } if trip.bus else None,
        "driver": {
            "id": str(trip.driver.id),
            "full_name": trip.driver.full_name
        } if trip.driver else None,
        "route": {
            "id": str(trip.route.id),
            "route_name": trip.route.route_name,
            "distance_km": float(trip.route.distance_km) if trip.route.distance_km else None,
            "from_address": trip.route.from_address,
            "to_address": trip.route.to_address
        } if trip.route else None,
        "created_at": trip.created_at.isoformat() if trip.created_at else None,
        "updated_at": trip.updated_at.isoformat() if trip.updated_at else None
    }


@router.get("/my")
async def get_my_trips(
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(100, le=1000),
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get trips for the current driver"""
    query = db.query(Trip).options(
        joinedload(Trip.bus),
        joinedload(Trip.driver),
        joinedload(Trip.route)
    ).filter(Trip.driver_id == uuid.UUID(current_user.profile_id))
    
    if status:
        query = query.filter(Trip.status == TripStatus(status))
    if from_date:
        query = query.filter(Trip.trip_date >= from_date)
    if to_date:
        query = query.filter(Trip.trip_date <= to_date)
    
    trips = query.order_by(Trip.start_date.desc()).limit(limit).all()
    
    return [trip_to_dict(t) for t in trips]


@router.get("")
async def list_trips(
    status: Optional[str] = None,
    driver_id: Optional[str] = None,
    bus_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List trips with optional filters"""
    query = db.query(Trip).options(
        joinedload(Trip.bus),
        joinedload(Trip.driver),
        joinedload(Trip.route)
    )
    
    # Role-based filtering
    if current_user.role == "driver":
        query = query.filter(Trip.driver_id == uuid.UUID(current_user.profile_id))
    
    # Apply filters
    if status:
        query = query.filter(Trip.status == TripStatus(status))
    if driver_id:
        query = query.filter(Trip.driver_id == uuid.UUID(driver_id))
    if bus_id:
        query = query.filter(Trip.bus_id == uuid.UUID(bus_id))
    if from_date:
        query = query.filter(Trip.trip_date >= from_date)
    if to_date:
        query = query.filter(Trip.trip_date <= to_date)
    
    trips = query.order_by(Trip.start_date.desc()).offset(offset).limit(limit).all()
    
    return [trip_to_dict(t) for t in trips]


@router.get("/{trip_id}")
async def get_trip(
    trip_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single trip by ID"""
    trip = db.query(Trip).options(
        joinedload(Trip.bus),
        joinedload(Trip.driver),
        joinedload(Trip.route)
    ).filter(Trip.id == uuid.UUID(trip_id)).first()
    
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Check access
    if current_user.role == "driver" and str(trip.driver_id) != current_user.profile_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return trip_to_dict(trip)


@router.post("")
async def create_trip(
    trip_data: TripCreate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new trip (admin only)"""
    # Get snapshots
    bus_name_snapshot = None
    driver_name_snapshot = None
    
    if trip_data.bus_id:
        bus = db.query(Bus).filter(Bus.id == uuid.UUID(trip_data.bus_id)).first()
        if bus:
            bus_name_snapshot = bus.bus_name or bus.registration_number
    
    if trip_data.driver_id:
        driver = db.query(Profile).filter(Profile.id == uuid.UUID(trip_data.driver_id)).first()
        if driver:
            driver_name_snapshot = driver.full_name
    
    trip = Trip(
        id=uuid.uuid4(),
        trip_number=trip_data.trip_number,
        bus_id=uuid.UUID(trip_data.bus_id) if trip_data.bus_id else None,
        driver_id=uuid.UUID(trip_data.driver_id) if trip_data.driver_id else None,
        route_id=uuid.UUID(trip_data.route_id),
        schedule_id=uuid.UUID(trip_data.schedule_id) if trip_data.schedule_id else None,
        start_date=trip_data.start_date,
        end_date=trip_data.end_date,
        trip_date=trip_data.trip_date,
        status=TripStatus(trip_data.status) if trip_data.status else TripStatus.scheduled,
        trip_type=trip_data.trip_type,
        notes=trip_data.notes,
        bus_name_snapshot=bus_name_snapshot,
        driver_name_snapshot=driver_name_snapshot
    )
    
    db.add(trip)
    db.commit()
    db.refresh(trip)
    
    # Reload with relationships
    trip = db.query(Trip).options(
        joinedload(Trip.bus),
        joinedload(Trip.driver),
        joinedload(Trip.route)
    ).filter(Trip.id == trip.id).first()
    
    return trip_to_dict(trip)


@router.put("/{trip_id}")
async def update_trip(
    trip_id: str,
    trip_data: TripUpdate,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a trip"""
    trip = db.query(Trip).filter(Trip.id == uuid.UUID(trip_id)).first()
    
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Check access for drivers
    if current_user.role == "driver":
        if str(trip.driver_id) != current_user.profile_id:
            raise HTTPException(status_code=403, detail="Access denied")
        # Drivers can only update specific fields
        allowed_fields = {
            "odometer_start", "odometer_end", "water_taken",
            "odometer_return_start", "odometer_return_end"
        }
        update_data = {k: v for k, v in trip_data.dict(exclude_unset=True).items() if k in allowed_fields}
    else:
        update_data = trip_data.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        if key == "status" and value:
            setattr(trip, key, TripStatus(value))
        elif key in ["bus_id", "driver_id"] and value:
            setattr(trip, key, uuid.UUID(value))
        else:
            setattr(trip, key, value)
    
    db.commit()
    db.refresh(trip)
    
    # Reload with relationships
    trip = db.query(Trip).options(
        joinedload(Trip.bus),
        joinedload(Trip.driver),
        joinedload(Trip.route)
    ).filter(Trip.id == trip.id).first()
    
    return trip_to_dict(trip)


@router.delete("/{trip_id}")
async def delete_trip(
    trip_id: str,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a trip (admin only)"""
    trip = db.query(Trip).filter(Trip.id == uuid.UUID(trip_id)).first()
    
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    db.delete(trip)
    db.commit()
    
    return {"message": "Trip deleted successfully"}
