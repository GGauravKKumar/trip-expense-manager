"""
SQLAlchemy models matching the PostgreSQL schema
"""
import uuid
from datetime import datetime, date, time
from typing import Optional, List
from sqlalchemy import (
    Column, String, Integer, Numeric, Boolean, Date, Time, DateTime,
    ForeignKey, Text, Enum as SQLEnum, ARRAY, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from database import Base


# Enums
class AppRole(str, enum.Enum):
    admin = "admin"
    driver = "driver"
    repair_org = "repair_org"


class BusStatus(str, enum.Enum):
    active = "active"
    maintenance = "maintenance"
    inactive = "inactive"


class ExpenseStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    denied = "denied"


class TripStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class OwnershipType(str, enum.Enum):
    owned = "owned"
    partnership = "partnership"


class TaxStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    overdue = "overdue"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    partial = "partial"
    paid = "paid"
    overdue = "overdue"
    cancelled = "cancelled"


class InvoiceType(str, enum.Enum):
    customer = "customer"
    online_app = "online_app"
    charter = "charter"


class StockTransactionType(str, enum.Enum):
    add = "add"
    remove = "remove"
    adjustment = "adjustment"


# Models
class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    encrypted_password = Column(String, nullable=False)
    email_confirmed_at = Column(DateTime(timezone=True))
    raw_user_meta_data = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class IndianState(Base):
    __tablename__ = "indian_states"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    state_name = Column(String, nullable=False)
    state_code = Column(String, nullable=False)
    is_union_territory = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class RepairOrganization(Base):
    __tablename__ = "repair_organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_code = Column(String, unique=True, nullable=False)
    org_name = Column(String, nullable=False)
    contact_person = Column(String)
    phone = Column(String)
    email = Column(String)
    address = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    phone = Column(String)
    license_number = Column(String)
    license_expiry = Column(Date)
    address = Column(Text)
    avatar_url = Column(String)
    repair_org_id = Column(UUID(as_uuid=True), ForeignKey("repair_organizations.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    repair_org = relationship("RepairOrganization", backref="profiles")


class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    role = Column(SQLEnum(AppRole), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Bus(Base):
    __tablename__ = "buses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    registration_number = Column(String, nullable=False)
    bus_name = Column(String)
    capacity = Column(Integer, default=40)
    bus_type = Column(String, default="AC Sleeper")
    status = Column(SQLEnum(BusStatus), default=BusStatus.active)
    insurance_expiry = Column(Date)
    puc_expiry = Column(Date)
    fitness_expiry = Column(Date)
    ownership_type = Column(SQLEnum(OwnershipType), default=OwnershipType.owned)
    partner_name = Column(String)
    company_profit_share = Column(Numeric, default=100)
    partner_profit_share = Column(Numeric, default=0)
    home_state_id = Column(UUID(as_uuid=True), ForeignKey("indian_states.id"))
    monthly_tax_amount = Column(Numeric, default=0)
    tax_due_day = Column(Integer, default=1)
    last_tax_paid_date = Column(Date)
    next_tax_due_date = Column(Date)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    home_state = relationship("IndianState")


class BusTaxRecord(Base):
    __tablename__ = "bus_tax_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id"), nullable=False)
    tax_period_start = Column(Date, nullable=False)
    tax_period_end = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    amount = Column(Numeric, nullable=False)
    status = Column(SQLEnum(TaxStatus), default=TaxStatus.pending)
    paid_date = Column(Date)
    payment_reference = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    bus = relationship("Bus", backref="tax_records")


class Route(Base):
    __tablename__ = "routes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_name = Column(String, nullable=False)
    from_state_id = Column(UUID(as_uuid=True), ForeignKey("indian_states.id"), nullable=False)
    to_state_id = Column(UUID(as_uuid=True), ForeignKey("indian_states.id"), nullable=False)
    from_address = Column(Text)
    to_address = Column(Text)
    distance_km = Column(Numeric)
    estimated_duration_hours = Column(Numeric)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    from_state = relationship("IndianState", foreign_keys=[from_state_id])
    to_state = relationship("IndianState", foreign_keys=[to_state_id])


class BusSchedule(Base):
    __tablename__ = "bus_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id"), nullable=False)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=False)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"))
    days_of_week = Column(ARRAY(String), default=[])
    departure_time = Column(Time, nullable=False)
    arrival_time = Column(Time, nullable=False)
    is_two_way = Column(Boolean, default=True)
    return_departure_time = Column(Time)
    return_arrival_time = Column(Time)
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    is_overnight = Column(Boolean, default=False)
    arrival_next_day = Column(Boolean, default=False)
    turnaround_hours = Column(Numeric, default=3)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    bus = relationship("Bus", backref="schedules")
    route = relationship("Route", backref="schedules")
    driver = relationship("Profile", backref="schedules")


class ExpenseCategory(Base):
    __tablename__ = "expense_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    icon = Column(String)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Trip(Base):
    __tablename__ = "trips"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_number = Column(String, nullable=False)
    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id"))
    driver_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"))
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=False)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("bus_schedules.id"))
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True))
    trip_date = Column(Date)
    status = Column(SQLEnum(TripStatus), default=TripStatus.scheduled)
    trip_type = Column(String, default="one_way")
    notes = Column(Text)
    bus_name_snapshot = Column(String)
    driver_name_snapshot = Column(String)
    # Outward journey
    departure_time = Column(Time)
    arrival_time = Column(Time)
    odometer_start = Column(Numeric)
    odometer_end = Column(Numeric)
    revenue_cash = Column(Numeric, default=0)
    revenue_online = Column(Numeric, default=0)
    revenue_paytm = Column(Numeric, default=0)
    revenue_others = Column(Numeric, default=0)
    revenue_agent = Column(Numeric, default=0)
    total_expense = Column(Numeric, default=0)
    gst_percentage = Column(Numeric, default=18)
    water_taken = Column(Integer, default=0)
    # Return journey
    return_departure_time = Column(Time)
    return_arrival_time = Column(Time)
    odometer_return_start = Column(Numeric)
    odometer_return_end = Column(Numeric)
    return_revenue_cash = Column(Numeric, default=0)
    return_revenue_online = Column(Numeric, default=0)
    return_revenue_paytm = Column(Numeric, default=0)
    return_revenue_others = Column(Numeric, default=0)
    return_revenue_agent = Column(Numeric, default=0)
    return_total_revenue = Column(Numeric, default=0)
    return_total_expense = Column(Numeric, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    bus = relationship("Bus", backref="trips")
    driver = relationship("Profile", backref="trips")
    route = relationship("Route", backref="trips")
    schedule = relationship("BusSchedule", backref="trips")

    @property
    def distance_traveled(self):
        if self.odometer_end and self.odometer_start:
            return self.odometer_end - self.odometer_start
        return None

    @property
    def distance_return(self):
        if self.odometer_return_end and self.odometer_return_start:
            return self.odometer_return_end - self.odometer_return_start
        return None

    @property
    def total_revenue(self):
        return sum([
            float(self.revenue_cash or 0),
            float(self.revenue_online or 0),
            float(self.revenue_paytm or 0),
            float(self.revenue_others or 0),
            float(self.revenue_agent or 0),
        ])


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("expense_categories.id"), nullable=False)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    amount = Column(Numeric, nullable=False)
    expense_date = Column(Date, default=date.today)
    description = Column(Text)
    document_url = Column(String)
    fuel_quantity = Column(Numeric)
    status = Column(SQLEnum(ExpenseStatus), default=ExpenseStatus.pending)
    admin_remarks = Column(Text)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"))
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    trip = relationship("Trip", backref="expenses")
    category = relationship("ExpenseCategory")
    submitter = relationship("Profile", foreign_keys=[submitted_by], backref="submitted_expenses")
    approver = relationship("Profile", foreign_keys=[approved_by])


class RepairRecord(Base):
    __tablename__ = "repair_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repair_number = Column(String, nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("repair_organizations.id"), nullable=False)
    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id"))
    bus_registration = Column(String, nullable=False)
    repair_date = Column(Date, default=date.today)
    repair_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    parts_changed = Column(Text)
    parts_cost = Column(Numeric, default=0)
    labor_cost = Column(Numeric, default=0)
    total_cost = Column(Numeric)
    gst_applicable = Column(Boolean, default=True)
    gst_percentage = Column(Numeric, default=18)
    gst_amount = Column(Numeric, default=0)
    warranty_days = Column(Integer, default=0)
    status = Column(String, default="submitted")
    notes = Column(Text)
    photo_before_url = Column(String)
    photo_after_url = Column(String)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"))
    approved_by = Column(UUID(as_uuid=True))
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("RepairOrganization", backref="repair_records")
    bus = relationship("Bus", backref="repair_records")


class AdminSetting(Base):
    __tablename__ = "admin_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String, unique=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class StockItem(Base):
    __tablename__ = "stock_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_name = Column(String, nullable=False)
    quantity = Column(Integer, default=0)
    unit = Column(String, default="pieces")
    unit_price = Column(Numeric, default=0)
    low_stock_threshold = Column(Integer, default=50)
    gst_percentage = Column(Numeric, default=0)
    notes = Column(Text)
    last_updated_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stock_item_id = Column(UUID(as_uuid=True), ForeignKey("stock_items.id"), nullable=False)
    transaction_type = Column(SQLEnum(StockTransactionType), nullable=False)
    quantity_change = Column(Integer, nullable=False)
    previous_quantity = Column(Integer, nullable=False)
    new_quantity = Column(Integer, nullable=False)
    notes = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    stock_item = relationship("StockItem", backref="transactions")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String, unique=True, nullable=False)
    invoice_date = Column(Date, default=date.today)
    due_date = Column(Date)
    invoice_type = Column(SQLEnum(InvoiceType), default=InvoiceType.customer)
    customer_name = Column(String, nullable=False)
    customer_address = Column(Text)
    customer_phone = Column(String)
    customer_gst = Column(String)
    vendor_name = Column(String)
    vendor_address = Column(Text)
    vendor_phone = Column(String)
    vendor_gst = Column(String)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"))
    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id"))
    subtotal = Column(Numeric, default=0)
    gst_amount = Column(Numeric, default=0)
    total_amount = Column(Numeric, default=0)
    amount_paid = Column(Numeric, default=0)
    balance_due = Column(Numeric, default=0)
    status = Column(SQLEnum(InvoiceStatus), default=InvoiceStatus.draft)
    notes = Column(Text)
    terms = Column(Text)
    direction = Column(String, default="sales")
    category = Column(String, default="general")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    trip = relationship("Trip", backref="invoices")
    bus = relationship("Bus", backref="invoices")


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text, nullable=False)
    quantity = Column(Numeric, default=1)
    unit_price = Column(Numeric, default=0)
    gst_percentage = Column(Numeric, default=18)
    rate_includes_gst = Column(Boolean, default=False)
    base_amount = Column(Numeric, default=0)
    gst_amount = Column(Numeric, default=0)
    amount = Column(Numeric, default=0)
    is_deduction = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    invoice = relationship("Invoice", backref="line_items")


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric, nullable=False)
    payment_date = Column(Date, default=date.today)
    payment_mode = Column(String, default="Cash")
    reference_number = Column(String)
    notes = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    invoice = relationship("Invoice", backref="payments")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, default="info")
    read = Column(Boolean, default=False)
    link = Column(String)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
