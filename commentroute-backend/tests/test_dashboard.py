"""
Tests for the admin dashboard analytics endpoint.
Verifies cross-tab breakdowns, label distribution, and priority counts.
"""
from unittest.mock import patch


def _submit(client, label, source_type, comment="Test comment"):
    return client.post("/submit_ticket", json={
        "author":      "Tester",
        "comment":     comment,
        "source_type": source_type,
    })


@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_dashboard_totals(mock_clf, mock_llm, client):
    mock_llm.return_value = "Summary."

    mock_clf.return_value = 1   # Engineering, High
    _submit(client, 1, "customer_review", "App crashes")

    mock_clf.return_value = 3   # Compliance, Critical (office)
    _submit(client, 3, "office_report", "Harassment report")

    mock_clf.return_value = 2   # Product, Normal
    _submit(client, 2, "customer_review", "Add dark mode")

    r = client.get("/dashboard/stats")
    assert r.status_code == 200
    data = r.json()

    assert data["total_tickets"]    == 3
    assert data["open_tickets"]     == 3
    assert data["resolved_tickets"] == 0
    assert data["critical_tickets"] == 1


@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_dashboard_by_source(mock_clf, mock_llm, client):
    mock_llm.return_value = "Summary."

    mock_clf.return_value = 0
    _submit(client, 0, "customer_review")
    _submit(client, 0, "customer_review")

    mock_clf.return_value = 1
    _submit(client, 1, "office_report")

    r = client.get("/dashboard/stats")
    data = r.json()

    source_map = {item["source_type"]: item["count"] for item in data["by_source"]}
    assert source_map.get("customer_review", 0) == 2
    assert source_map.get("office_report",   0) == 1


@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_dashboard_cross_tab(mock_clf, mock_llm, client):
    """Verify team × source cross-tab is present and correct."""
    mock_llm.return_value = "Summary."

    mock_clf.return_value = 1
    _submit(client, 1, "customer_review", "Bug from customer")
    _submit(client, 1, "office_report",   "Bug from employee")

    r = client.get("/dashboard/stats")
    data = r.json()

    cross = data["by_team_and_source"]
    eng_customer = next(
        (x for x in cross
         if x["team"] == "Engineering & Platform" and x["source_type"] == "customer_review"),
        None,
    )
    eng_office = next(
        (x for x in cross
         if x["team"] == "Engineering & Platform" and x["source_type"] == "office_report"),
        None,
    )
    assert eng_customer is not None and eng_customer["count"] == 1
    assert eng_office   is not None and eng_office["count"]   == 1


@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_dashboard_label_distribution(mock_clf, mock_llm, client):
    mock_llm.return_value = "Summary."

    for label in [0, 1, 1, 2, 3]:
        mock_clf.return_value = label
        _submit(client, label, "customer_review")

    r = client.get("/dashboard/stats")
    data = r.json()

    label_map = {
        item["label"]: item["count"]
        for item in data["model_label_distribution"]
    }
    assert label_map[0] == 1
    assert label_map[1] == 2
    assert label_map[2] == 1
    assert label_map[3] == 1


@patch("app.routers.tickets.llm_service.generate_routing_summary")
@patch("app.routers.tickets.ml_service.classify_comment")
def test_dashboard_empty(mock_clf, mock_llm, client):
    """Dashboard on empty DB should return zeros without errors."""
    r = client.get("/dashboard/stats")
    assert r.status_code == 200
    data = r.json()
    assert data["total_tickets"]    == 0
    assert data["critical_tickets"] == 0
    assert data["by_source"]        == []
    assert data["by_team"]          == []
