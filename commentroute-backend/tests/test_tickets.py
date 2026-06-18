"""
Tests for CommentRoute ticket endpoints.
Both source_type scenarios (customer_review and office_report) are covered.
ML and LLM services are mocked so tests run without the joblib model or API key.
"""
from unittest.mock import patch


# ─────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ─────────────────────────────────────────────
# Customer Review Submission
# ─────────────────────────────────────────────

@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_submit_customer_review_engineering(mock_clf, mock_llm, client):
    """Bug report from customer → Engineering & Platform, priority High."""
    mock_clf.return_value = 1
    mock_llm.return_value = "Investigate backend issue."

    r = client.post("/submit_ticket", json={
        "author":      "Alice",
        "comment":     "Login page crashes whenever I upload a PDF.",
        "source_type": "customer_review",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["team"]     == "Engineering & Platform"
    assert data["status"]   == "Open"
    assert data["priority"] == "High"
    assert "ticket_id" in data
    assert "disclaimer" in data


@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_submit_customer_review_product(mock_clf, mock_llm, client):
    """Feature request from customer → Product Team, priority Normal."""
    mock_clf.return_value = 2
    mock_llm.return_value = "Consider for product roadmap."

    r = client.post("/submit_ticket", json={
        "author":      "Bob",
        "comment":     "Please add dark mode to the mobile app.",
        "source_type": "customer_review",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["team"]     == "Product Team"
    assert data["priority"] == "Normal"


@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_submit_customer_review_compliance_high(mock_clf, mock_llm, client):
    """Abuse/legal complaint from customer → Compliance, priority High (not Critical)."""
    mock_clf.return_value = 3
    mock_llm.return_value = "Escalate to compliance."

    r = client.post("/submit_ticket", json={
        "author":      "Carol",
        "comment":     "This vendor is scamming customers illegally.",
        "source_type": "customer_review",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["team"]     == "Compliance & HR Escalation"
    assert data["priority"] == "High"   # High, not Critical (only office gets Critical)


# ─────────────────────────────────────────────
# Office / HR Report Submission
# ─────────────────────────────────────────────

@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_submit_office_harassment_critical(mock_clf, mock_llm, client):
    """Harassment report from employee → Compliance, priority CRITICAL."""
    mock_clf.return_value = 3
    mock_llm.return_value = "Immediate HR escalation required."

    r = client.post("/submit_ticket", json={
        "author":      "Employee_007",
        "comment":     "My manager made inappropriate comments about my appearance.",
        "source_type": "office_report",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["team"]     == "Compliance & HR Escalation"
    assert data["priority"] == "Critical"   # office + label 3 = Critical


@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_submit_office_engineering_bug(mock_clf, mock_llm, client):
    """Internal tool bug from employee → Engineering, priority High."""
    mock_clf.return_value = 1
    mock_llm.return_value = "Investigate internal tool."

    r = client.post("/submit_ticket", json={
        "author":      "Dev_John",
        "comment":     "The internal CI pipeline has been broken for two days.",
        "source_type": "office_report",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["team"]     == "Engineering & Platform"
    assert data["priority"] == "High"


# ─────────────────────────────────────────────
# Validation
# ─────────────────────────────────────────────

def test_empty_comment_rejected(client):
    r = client.post("/submit_ticket", json={
        "author": "X", "comment": "", "source_type": "customer_review"
    })
    assert r.status_code == 422


def test_whitespace_comment_rejected(client):
    r = client.post("/submit_ticket", json={
        "author": "X", "comment": "   ", "source_type": "customer_review"
    })
    assert r.status_code == 422


def test_invalid_source_type_rejected(client):
    r = client.post("/submit_ticket", json={
        "author": "X", "comment": "Hello", "source_type": "unknown_portal"
    })
    assert r.status_code == 422


def test_invalid_status_rejected(client):
    r = client.patch("/tickets/1/status", json={"status": "Bogus"})
    assert r.status_code == 422


def test_get_nonexistent_ticket(client):
    r = client.get("/tickets/9999")
    assert r.status_code == 404


# ─────────────────────────────────────────────
# Status Update + History
# ─────────────────────────────────────────────

@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_status_update_records_history(mock_clf, mock_llm, client):
    mock_clf.return_value = 0
    mock_llm.return_value = "General feedback."

    create = client.post("/submit_ticket", json={
        "author": "Dave", "comment": "Great app!", "source_type": "customer_review"
    })
    tid = create.json()["ticket_id"]

    # Update to In Progress
    r = client.patch(f"/tickets/{tid}/status", json={
        "status": "In Progress", "changed_by": "admin_1"
    })
    assert r.status_code == 200
    assert r.json()["status"] == "In Progress"

    # Update to Resolved
    r2 = client.patch(f"/tickets/{tid}/status", json={"status": "Resolved"})
    assert r2.status_code == 200

    # Verify history
    detail = client.get(f"/tickets/{tid}").json()
    statuses = [h["new_status"] for h in detail["history"]]
    assert "In Progress" in statuses
    assert "Resolved"    in statuses


# ─────────────────────────────────────────────
# Internal Notes
# ─────────────────────────────────────────────

@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_internal_note_added(mock_clf, mock_llm, client):
    mock_clf.return_value = 1
    mock_llm.return_value = "Bug noted."

    create = client.post("/submit_ticket", json={
        "author": "Eve", "comment": "App crashes on startup.", "source_type": "customer_review"
    })
    tid = create.json()["ticket_id"]

    note_r = client.post(f"/tickets/{tid}/notes", json={
        "author": "engineer_1",
        "note":   "Reproduced locally — stack overflow in init function.",
    })
    assert note_r.status_code == 200

    detail = client.get(f"/tickets/{tid}").json()
    assert len(detail["notes"]) == 1
    assert "stack overflow" in detail["notes"][0]["note"]


# ─────────────────────────────────────────────
# Ticket Filtering
# ─────────────────────────────────────────────

@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_filter_by_source_type(mock_clf, mock_llm, client):
    mock_llm.return_value = "Summary."

    mock_clf.return_value = 0
    client.post("/submit_ticket", json={
        "author": "Customer", "comment": "Good service.", "source_type": "customer_review"
    })

    mock_clf.return_value = 3
    client.post("/submit_ticket", json={
        "author": "Employee", "comment": "Reporting misconduct.", "source_type": "office_report"
    })

    office = client.get("/tickets", params={"source_type": "office_report"}).json()
    assert all(t["source_type"] == "office_report" for t in office)

    customer = client.get("/tickets", params={"source_type": "customer_review"}).json()
    assert all(t["source_type"] == "customer_review" for t in customer)


@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_filter_by_priority(mock_clf, mock_llm, client):
    mock_llm.return_value = "Summary."

    mock_clf.return_value = 3
    client.post("/submit_ticket", json={
        "author": "Emp", "comment": "Harassment incident.", "source_type": "office_report"
    })

    critical = client.get("/tickets", params={"priority": "Critical"}).json()
    assert len(critical) >= 1
    assert all(t["priority"] == "Critical" for t in critical)


def test_invalid_source_type_filter(client):
    r = client.get("/tickets", params={"source_type": "bad_value"})
    assert r.status_code == 422
