# CommentRoute

**AI-Powered Feedback Triage & Workplace Incident Management Platform**

A dual-portal SaaS system that classifies incoming text submissions — from customer reviews and internal employee reports — and automatically routes them to the correct business team using a trained NLP model and LLM-generated action summaries.

---

## What It Does

Organizations receive high volumes of unstructured text daily: product reviews, service complaints, feature requests, and internal workplace communications. Manually reading and triaging every submission is slow and inconsistent.

CommentRoute solves this by:

1. Accepting submissions from two separate portals — external customers and internal employees
2. Classifying each submission using a trained LightGBM NLP model
3. Applying business routing rules to assign the correct team
4. Generating an AI action summary using Gemini 2.5 Flash
5. Storing all tickets in a structured database with full lifecycle tracking
6. Giving administrators a real-time analytics dashboard with model performance monitoring

---

## Portals

| Portal | Who uses it | Ticket type |
|---|---|---|
| Customer portal | External users | Product reviews, bug reports, feature requests, service complaints |
| Employee portal | Internal staff | Workplace concerns, conduct reports, process issues, internal tool problems |

Employee submissions involving sensitive conduct are automatically escalated to the Compliance & HR team with Critical priority — without requiring the submitter to manually categorise the issue.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite |
| Backend | FastAPI, Python 3.12 |
| Database | SQLite + SQLAlchemy |
| ML Model | LightGBM + TF-IDF pipeline (joblib) |
| LLM | Gemini 2.5 Flash (routing summaries) |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Architecture

```
Submission (text)
        ↓
LightGBM Classification
(TF-IDF features → label 0–3)
        ↓
Keyword Override Rules
(conduct / technical / product signals)
        ↓
Priority Assignment
(label + source portal logic)
        ↓
Gemini Routing Summary
(1-2 sentence action recommendation)
        ↓
SQLite Storage + Team Assignment
        ↓
Admin Dashboard Analytics
```

---

## ML Model

- **Algorithm:** LightGBM Classifier
- **Text features:** TF-IDF, 50k features, unigrams + bigrams
- **Additional features:** 27 engineered columns (engagement metrics, date features, text statistics)
- **Training samples:** 158,400
- **Validation Macro F1:** 0.8156
- **Classes:** 4 categories mapped to business teams

> The model outputs are mapped to business workflows for demonstration purposes.

---

## Team Routing

| Label | Team | Priority logic |
|---|---|---|
| 0 | Customer Success | Normal |
| 1 | Engineering & Platform | High (all sources) |
| 2 | Product Team | Normal |
| 3 | Compliance & HR Escalation | High (customer) / **Critical** (employee) |

---

## Admin Access

```
Email:    admin@commentroute.com
Password: admin123
```

The admin dashboard is credential-protected. Customer and employee portals require only a name — appropriate for anonymous feedback and sensitive internal reporting.

---

## Setup

```bash
# Backend
cd commentroute-backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # Add GEMINI_API_KEY
# Place model_pipeline.joblib in app/ml_models/
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd commentroute-frontend
npm install
npm run dev
```

Swagger UI: `http://localhost:8000/docs`  
Frontend: `http://localhost:5173`

---

## Export Model from Kaggle

Add this cell at the end of your Kaggle notebook and run it:

```python
import joblib
joblib.dump(model, "model_pipeline.joblib")
```

Download and place at `commentroute-backend/app/ml_models/model_pipeline.joblib`.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/submit_ticket` | Classify and route submission (both portals) |
| GET | `/tickets` | List tickets with filters |
| GET | `/tickets/{id}` | Full ticket detail + history + notes |
| PATCH | `/tickets/{id}/status` | Update ticket status |
| POST | `/tickets/{id}/notes` | Add internal note |
| GET | `/dashboard/stats` | Full analytics including ML label distribution |
| GET | `/health` | Health check |

---

## Tests

```bash
cd commentroute-backend
pytest -v   # 21 tests
```

---

## Deployment

- **Backend → Render:** Push to GitHub, connect repo, set `GEMINI_API_KEY` and `MODEL_PATH` environment variables
- **Frontend → Vercel:** Push to GitHub, connect repo, set `VITE_API_URL=https://your-backend.onrender.com`
