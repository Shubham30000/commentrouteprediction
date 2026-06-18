from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import models
from app.schemas import schemas
from app.services.ml_service import LABEL_NAMES


# ─────────────────────────────────────────────
# Tickets
# ─────────────────────────────────────────────

def create_ticket(
    db:              Session,
    author:          str,
    comment:         str,
    source_type:     str,
    predicted_label: int,
    assigned_team:   str,
    routing_note:    str,
    priority:        str,
    user_id:         int | None = None,
) -> models.Ticket:
    ticket = models.Ticket(
        author_name     = author,
        comment         = comment,
        source_type     = source_type,
        predicted_label = predicted_label,
        assigned_team   = assigned_team,
        routing_note    = routing_note,
        priority        = priority,
        status          = "Open",
        user_id         = user_id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Record the initial state in history
    history = models.TicketHistory(
        ticket_id  = ticket.ticket_id,
        old_status = "Open",
        new_status = "Open",
        changed_by = "system",
    )
    db.add(history)
    db.commit()

    return ticket


def get_ticket(db: Session, ticket_id: int) -> models.Ticket | None:
    return (
        db.query(models.Ticket)
        .filter(models.Ticket.ticket_id == ticket_id)
        .first()
    )


def get_tickets(
    db:          Session,
    team:        str | None = None,
    status:      str | None = None,
    source_type: str | None = None,
    priority:    str | None = None,
    skip:        int = 0,
    limit:       int = 100,
) -> list[models.Ticket]:
    query = db.query(models.Ticket)

    if team:
        query = query.filter(models.Ticket.assigned_team == team)
    if status:
        query = query.filter(models.Ticket.status == status)
    if source_type:
        query = query.filter(models.Ticket.source_type == source_type)
    if priority:
        query = query.filter(models.Ticket.priority == priority)

    return query.order_by(models.Ticket.created_at.desc()).offset(skip).limit(limit).all()


def update_ticket_status(
    db:         Session,
    ticket:     models.Ticket,
    new_status: str,
    changed_by: str | None = None,
) -> models.Ticket:
    old_status    = ticket.status
    ticket.status = new_status
    db.add(ticket)

    history = models.TicketHistory(
        ticket_id  = ticket.ticket_id,
        old_status = old_status,
        new_status = new_status,
        changed_by = changed_by or "admin",
    )
    db.add(history)
    db.commit()
    db.refresh(ticket)
    return ticket


# ─────────────────────────────────────────────
# Internal Notes
# ─────────────────────────────────────────────

def add_internal_note(
    db:        Session,
    ticket_id: int,
    author:    str,
    note:      str,
) -> models.InternalNote:
    db_note = models.InternalNote(
        ticket_id = ticket_id,
        author    = author,
        note      = note,
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note


# ─────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────

def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    db_user = models.User(
        name        = user.name,
        email       = user.email,
        role        = user.role,
        source_type = user.source_type,
        department  = user.department,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user(db: Session, user_id: int) -> models.User | None:
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_users(db: Session, skip: int = 0, limit: int = 100) -> list[models.User]:
    return db.query(models.User).offset(skip).limit(limit).all()


# ─────────────────────────────────────────────
# Dashboard Stats
# ─────────────────────────────────────────────

def get_dashboard_stats(db: Session) -> dict:
    T = models.Ticket

    # ── Overall counts ────────────────────────────────────────────────
    total       = db.query(func.count(T.ticket_id)).scalar() or 0
    open_count  = db.query(func.count(T.ticket_id)).filter(T.status == "Open").scalar() or 0
    inp_count   = db.query(func.count(T.ticket_id)).filter(T.status == "In Progress").scalar() or 0
    res_count   = db.query(func.count(T.ticket_id)).filter(T.status == "Resolved").scalar() or 0
    crit_count  = db.query(func.count(T.ticket_id)).filter(T.priority == "Critical").scalar() or 0

    # ── By source portal ──────────────────────────────────────────────
    source_rows = (
        db.query(T.source_type, func.count(T.ticket_id))
        .group_by(T.source_type)
        .all()
    )
    by_source = [{"source_type": s, "count": c} for s, c in source_rows]

    # ── By assigned team ──────────────────────────────────────────────
    team_rows = (
        db.query(T.assigned_team, func.count(T.ticket_id))
        .group_by(T.assigned_team)
        .order_by(func.count(T.ticket_id).desc())
        .all()
    )
    by_team = [{"team": t, "count": c} for t, c in team_rows]

    # ── Cross-tab: team × source ──────────────────────────────────────
    cross_rows = (
        db.query(T.assigned_team, T.source_type, func.count(T.ticket_id))
        .group_by(T.assigned_team, T.source_type)
        .order_by(T.assigned_team, T.source_type)
        .all()
    )
    by_team_and_source = [
        {"team": t, "source_type": s, "count": c}
        for t, s, c in cross_rows
    ]

    # ── ML label distribution (model performance monitoring) ──────────
    label_rows = (
        db.query(T.predicted_label, func.count(T.ticket_id))
        .group_by(T.predicted_label)
        .order_by(T.predicted_label)
        .all()
    )
    model_label_distribution = [
        {
            "label":      label,
            "label_name": LABEL_NAMES.get(label, "Unknown"),
            "count":      count,
        }
        for label, count in label_rows
    ]

    # ── By priority ───────────────────────────────────────────────────
    priority_rows = (
        db.query(T.priority, func.count(T.ticket_id))
        .group_by(T.priority)
        .all()
    )
    by_priority = [{"priority": p, "count": c} for p, c in priority_rows]

    # ── By status (funnel view) ───────────────────────────────────────
    status_rows = (
        db.query(T.status, func.count(T.ticket_id))
        .group_by(T.status)
        .all()
    )
    by_status = [{"status": s, "count": c} for s, c in status_rows]

    return {
        "total_tickets":            total,
        "open_tickets":             open_count,
        "in_progress_tickets":      inp_count,
        "resolved_tickets":         res_count,
        "critical_tickets":         crit_count,
        "by_source":                by_source,
        "by_team":                  by_team,
        "by_team_and_source":       by_team_and_source,
        "model_label_distribution": model_label_distribution,
        "by_priority":              by_priority,
        "by_status":                by_status,
    }
