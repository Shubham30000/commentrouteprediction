# CommentRoute Backend

Intelligent Feedback Triage & Incident Escalation Platform.

Accepts submissions from two portals and routes them to the correct team using a trained LightGBM model, with Claude generating routing summaries.

---

## Portals

| Portal | source_type | Who uses it |
|---|---|---|
| Customer Review | `customer_review` | External customers (product reviews, bug reports) |
| Office / HR | `office_report` | Internal employees (complaints, harassment, tool issues) |

## Teams & Priority Rules

| Label | Team | Customer Priority | Office Priority |
|---|---|---|---|
| 0 | Customer Success / HR General | Normal | Normal |
| 1 | Engineering & Platform | High | High |
| 2 | Product Team | Normal | Normal |
| 3 | Compliance & HR Escalation | High | **Critical** |

---

## Setup

```bash
python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# Place your exported model at:
# app/ml_models/model_pipeline.joblib

uvicorn app.main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs

---

## Export model from Kaggle

Add this cell at the end of your notebook:

```python
import joblib
joblib.dump(model, "model_pipeline.joblib")
```

Download and place at `app/ml_models/model_pipeline.joblib`.

---

## Run Tests

```bash
pytest -v
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/submit_ticket` | Submit feedback or report (both portals) |
| GET | `/tickets` | List tickets (filter: team, status, source_type, priority) |
| GET | `/tickets/{id}` | Ticket detail with history and notes |
| PATCH | `/tickets/{id}/status` | Update status |
| POST | `/tickets/{id}/notes` | Add internal note |
| POST | `/users/` | Create user |
| GET | `/users/` | List users |
| GET | `/users/{id}` | Get user |
| GET | `/dashboard/stats` | Full admin analytics |
| GET | `/health` | Health check |
