from sqlalchemy import (
    Column, Integer, String, Text, ForeignKey, DateTime, func
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    """
    Represents both external customers and internal office employees.
    source_type distinguishes which portal they belong to.
    """
    __tablename__ = "users"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    email       = Column(String, unique=True, nullable=True)

    # "admin" | "customer" | "employee" | "team_member"
    role        = Column(String, nullable=False, default="customer")

    # "external" → customer review portal
    # "internal" → office / HR portal
    source_type = Column(String, nullable=False, default="external")

    # Only relevant for internal employees: e.g. "Engineering", "HR", "Sales"
    department  = Column(String, nullable=True)

    created_at  = Column(DateTime, server_default=func.now())

    tickets     = relationship("Ticket", back_populates="user")


class Ticket(Base):
    """
    Unified ticket table for both customer reviews and internal office reports.
    source_type + priority carry the context that differentiates the two portals.
    """
    __tablename__ = "tickets"

    ticket_id       = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_name     = Column(String, nullable=False)

    # The raw comment / review / complaint text
    comment         = Column(Text, nullable=False)

    # "customer_review" | "office_report"
    source_type     = Column(String, nullable=False, default="customer_review", index=True)

    # Raw integer label from LightGBM (0-3)
    predicted_label = Column(Integer, nullable=False)

    # Human-readable team name derived from predicted_label
    assigned_team   = Column(String, nullable=False, index=True)

    # Claude-generated routing summary
    routing_note    = Column(Text, nullable=True)

    # "Open" | "In Progress" | "Resolved"
    status          = Column(String, nullable=False, default="Open", index=True)

    # "Normal" | "High" | "Critical"
    # Critical is auto-assigned when label=3 AND source_type="office_report"
    priority        = Column(String, nullable=False, default="Normal", index=True)

    created_at      = Column(DateTime, server_default=func.now())

    user    = relationship("User", back_populates="tickets")
    history = relationship("TicketHistory", back_populates="ticket", cascade="all, delete-orphan")
    notes   = relationship("InternalNote",  back_populates="ticket", cascade="all, delete-orphan")


class TicketHistory(Base):
    """Records every status transition for audit trail."""
    __tablename__ = "ticket_history"

    id         = Column(Integer, primary_key=True, index=True)
    ticket_id  = Column(Integer, ForeignKey("tickets.ticket_id"), nullable=False)
    old_status = Column(String, nullable=False)
    new_status = Column(String, nullable=False)
    changed_by = Column(String, nullable=True)   # name of admin/team member who changed it
    updated_at = Column(DateTime, server_default=func.now())

    ticket = relationship("Ticket", back_populates="history")


class InternalNote(Base):
    """Private notes added by team members — not visible to the submitter."""
    __tablename__ = "internal_notes"

    id         = Column(Integer, primary_key=True, index=True)
    ticket_id  = Column(Integer, ForeignKey("tickets.ticket_id"), nullable=False)
    author     = Column(String, nullable=False)
    note       = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    ticket = relationship("Ticket", back_populates="notes")
