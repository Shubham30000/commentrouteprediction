from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, field_validator


# ─────────────────────────────────────────────
# Constants (kept here so frontend can rely on them)
# ─────────────────────────────────────────────

SOURCE_TYPES  = {"customer_review", "office_report"}
VALID_STATUSES = {"Open", "In Progress", "Resolved"}
VALID_PRIORITIES = {"Normal", "High", "Critical"}
VALID_ROLES = {"admin", "customer", "employee", "team_member"}


# ─────────────────────────────────────────────
# User
# ─────────────────────────────────────────────

class UserBase(BaseModel):
    name:        str
    email:       Optional[str] = None
    role:        str = "customer"
    source_type: str = "external"   # "external" | "internal"
    department:  Optional[str] = None


class UserCreate(UserBase):
    pass


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id:         int
    created_at: datetime


# ─────────────────────────────────────────────
# Ticket History
# ─────────────────────────────────────────────

class TicketHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:         int
    old_status: str
    new_status: str
    changed_by: Optional[str]
    updated_at: datetime


# ─────────────────────────────────────────────
# Internal Notes
# ─────────────────────────────────────────────

class InternalNoteCreate(BaseModel):
    author: str
    note:   str


class InternalNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:         int
    author:     str
    note:       str
    created_at: datetime


# ─────────────────────────────────────────────
# Ticket — Create
# ─────────────────────────────────────────────

class TicketCreate(BaseModel):
    author:      str
    comment:     str
    source_type: str = "customer_review"   # "customer_review" | "office_report"
    user_id:     Optional[int] = None

    @field_validator("source_type")
    @classmethod
    def validate_source(cls, v: str) -> str:
        if v not in SOURCE_TYPES:
            raise ValueError(f"source_type must be one of {sorted(SOURCE_TYPES)}")
        return v

    @field_validator("comment")
    @classmethod
    def comment_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("comment cannot be empty")
        return v.strip()


class TicketStatusUpdate(BaseModel):
    status:     str
    changed_by: Optional[str] = None   # who made the change (admin name / team member)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_STATUSES)}")
        return v


# ─────────────────────────────────────────────
# Ticket — Output
# ─────────────────────────────────────────────

class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    ticket_id:       int
    author_name:     str
    comment:         str
    source_type:     str
    predicted_label: int
    assigned_team:   str
    routing_note:    Optional[str]
    status:          str
    priority:        str
    created_at:      datetime


class TicketDetailOut(TicketOut):
    """Full ticket with history and internal notes — used by admin and team views."""
    history: List[TicketHistoryOut] = []
    notes:   List[InternalNoteOut]  = []


class TicketSubmitResponse(BaseModel):
    """Immediate response returned to the submitter after ticket creation."""
    ticket_id:    int
    team:         str
    status:       str
    priority:     str
    routing_note: Optional[str]
    disclaimer:   str = (
        "The model outputs are mapped to business workflows "
        "for demonstration purposes."
    )


# ─────────────────────────────────────────────
# Dashboard — Analytics
# ─────────────────────────────────────────────

class CountByLabel(BaseModel):
    label:      int
    label_name: str
    count:      int


class CountByTeam(BaseModel):
    team:  str
    count: int


class CountBySource(BaseModel):
    source_type: str
    count:       int


class CountByTeamAndSource(BaseModel):
    team:        str
    source_type: str
    count:       int


class CountByPriority(BaseModel):
    priority: str
    count:    int


class CountByStatus(BaseModel):
    status: str
    count:  int


class DashboardStats(BaseModel):
    # Overall counts
    total_tickets:       int
    open_tickets:        int
    in_progress_tickets: int
    resolved_tickets:    int
    critical_tickets:    int

    # Breakdown by source portal
    by_source: List[CountBySource]

    # Breakdown by assigned team
    by_team: List[CountByTeam]

    # Cross-tab: which team got tickets from which source
    by_team_and_source: List[CountByTeamAndSource]

    # ML model label distribution (for model performance monitoring)
    model_label_distribution: List[CountByLabel]

    # Priority distribution
    by_priority: List[CountByPriority]

    # Status distribution (for funnel view)
    by_status: List[CountByStatus]
