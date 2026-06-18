from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import (
    TicketCreate, TicketOut, TicketDetailOut,
    TicketStatusUpdate, TicketSubmitResponse,
    InternalNoteCreate, InternalNoteOut,
    VALID_STATUSES, SOURCE_TYPES, VALID_PRIORITIES,
)
from app.crud import crud
from app.services import ml_service, llm_service

router = APIRouter(tags=["tickets"])


@router.post("/submit_ticket", response_model=TicketSubmitResponse)
def submit_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    """
    Main submission endpoint used by BOTH portals.

    Customer portal sends:  source_type = "customer_review"
    Office/HR portal sends: source_type = "office_report"

    Flow:
      1. Validate input (Pydantic handles empty comment)
      2. LightGBM classifies the comment → label 0-3
      3. Map label → team name
      4. Determine priority based on label + source_type
      5. Claude generates a source-aware routing summary
      6. Save ticket to DB
      7. Return summary to submitter
    """
    predicted_label, team, priority = ml_service.classify_and_route(
    payload.comment, payload.source_type
    )
    routing_note    = llm_service.generate_routing_summary(
        comment     = payload.comment,
        team        = team,
        source_type = payload.source_type,
        priority    = priority,
    )

    ticket = crud.create_ticket(
        db              = db,
        author          = payload.author,
        comment         = payload.comment,
        source_type     = payload.source_type,
        predicted_label = predicted_label,
        assigned_team   = team,
        routing_note    = routing_note,
        priority        = priority,
        user_id         = payload.user_id,
    )

    return TicketSubmitResponse(
        ticket_id    = ticket.ticket_id,
        team         = ticket.assigned_team,
        status       = ticket.status,
        priority     = ticket.priority,
        routing_note = ticket.routing_note,
    )


@router.get("/tickets", response_model=list[TicketOut])
def list_tickets(
    team:        str | None = Query(None, description="Filter by assigned team"),
    status:      str | None = Query(None, description="Open | In Progress | Resolved"),
    source_type: str | None = Query(None, description="customer_review | office_report"),
    priority:    str | None = Query(None, description="Normal | High | Critical"),
    skip:        int        = Query(0,    ge=0),
    limit:       int        = Query(100,  ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint — returns all tickets with optional filters.
    Supports filtering by team, status, source portal, and priority.
    """
    if status and status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status: {status}")
    if source_type and source_type not in SOURCE_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid source_type: {source_type}")
    if priority and priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=422, detail=f"Invalid priority: {priority}")

    return crud.get_tickets(
        db,
        team        = team,
        status      = status,
        source_type = source_type,
        priority    = priority,
        skip        = skip,
        limit       = limit,
    )


@router.get("/tickets/{ticket_id}", response_model=TicketDetailOut)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    """Returns full ticket details including status history and internal notes."""
    ticket = crud.get_ticket(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.patch("/tickets/{ticket_id}/status", response_model=TicketOut)
def update_status(
    ticket_id: int,
    payload:   TicketStatusUpdate,
    db: Session = Depends(get_db),
):
    """
    Update ticket status. Records the change in ticket_history.
    Optionally accepts changed_by to track who made the update.
    """
    ticket = crud.get_ticket(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return crud.update_ticket_status(
        db, ticket, payload.status, changed_by=payload.changed_by
    )


@router.post("/tickets/{ticket_id}/notes", response_model=InternalNoteOut)
def add_note(
    ticket_id: int,
    payload:   InternalNoteCreate,
    db: Session = Depends(get_db),
):
    """Add an internal note to a ticket (team member / admin only)."""
    ticket = crud.get_ticket(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return crud.add_internal_note(db, ticket_id, payload.author, payload.note)
