# CommentRoute — Resume & LinkedIn Descriptions

---

## Resume Project Entry (Data Science / AI Intern)

**CommentRoute — AI-Powered Feedback Triage & Incident Management Platform**
`Python · FastAPI · React · LightGBM · TF-IDF · Gemini API · SQLite · SQLAlchemy`

- Built an end-to-end feedback routing platform with dual portals: an external customer review channel and an internal employee reporting channel, unified under a single triage backend
- Trained a LightGBM text classifier on 198K labeled samples achieving **0.81 Macro F1**, combining TF-IDF (50k features, bigrams) with 27 engineered metadata features
- Implemented a hybrid routing engine: LightGBM classification → keyword override rules → priority assignment (Normal / High / Critical), with automatic escalation of sensitive employee submissions to the Compliance team
- Integrated Gemini 2.5 Flash to generate context-aware routing summaries and action recommendations for each incoming ticket
- Designed a normalized SQLite schema with ticket lifecycle management (status history, internal notes, audit trail) and a FastAPI REST backend with 21 pytest unit tests
- Built a React admin dashboard with real-time analytics: team distribution, source cross-tab, ML label monitoring, routing pipeline visualization, and status funnel
- Deployed frontend on Vercel and backend on Render; backend API documented via Swagger UI

---

## Resume Project Entry (Software Engineering Intern)

**CommentRoute — Full-Stack Feedback & Incident Triage System**
`FastAPI · React · SQLite · LightGBM · Gemini API · Pytest · Vite`

- Engineered a full-stack platform where user submissions are classified by a trained NLP model, routed to the correct business team, and tracked through a complete ticket lifecycle
- Designed RESTful API with FastAPI (10 endpoints), SQLAlchemy ORM with 4 normalized tables, Pydantic validation schemas, and role-based dashboard access
- Built dual-portal React frontend (customer, employee, admin) with sidebar navigation, filterable ticket tables, ticket detail modals with status management, and analytics charts
- Achieved 21/21 pytest coverage including edge cases, filter validation, cross-tab dashboard verification, and mocked ML/LLM services for isolated testing

---

## LinkedIn Project Description (shorter)

**CommentRoute — AI Feedback Triage Platform**

Built a production-style platform that accepts text submissions from two sources — customer product reviews and internal employee reports — and automatically classifies, prioritises, and routes them to the correct team.

Stack: LightGBM (Macro F1: 0.81) + Gemini 2.5 Flash + FastAPI + React + SQLite

Key features: dual-portal submission, auto-escalation of sensitive reports to Compliance & HR, admin analytics dashboard with ML label monitoring, full ticket lifecycle management (Open → In Progress → Resolved), and deployment on Render + Vercel.

---

## What to Say in an Interview

**"What problem does it solve?"**
> "Organizations get thousands of unstructured text submissions — reviews, complaints, internal concerns — and someone has to manually read and route each one. CommentRoute automates that: a trained NLP model classifies the text, business rules assign priority, and an LLM writes the routing summary for the receiving team. The admin sees everything in a real-time dashboard including how the model is performing."

**"Why two portals?"**
> "The system handles two very different submission contexts. External customers submit product feedback — bugs, feature requests, reviews. Internal employees submit workplace reports — conduct issues, tool problems, process feedback. The routing logic treats them differently: an identical text submitted through the employee portal may be escalated to Critical priority because internal conduct reports carry more urgency than the same language in a product review."

**"What did you build vs what was given?"**
> "The ML model was trained on Kaggle competition data. Everything else — the FastAPI backend, SQLite schema, routing logic, keyword override rules, Gemini integration, React frontend, admin analytics, and deployment — was built from scratch. The interesting engineering was in the inference layer: the trained pipeline expects a full 31-column DataFrame, so I had to reconstruct the feature vector from just a text string at runtime."

**"What would Version 2 look like?"**
> "Version 2 would add RAG: embed historical tickets into a vector database, retrieve the top 3-5 similar past tickets, and give them to the LLM as context so it can say things like 'this is the 8th payment gateway crash this month — Engineering should check the scheduled job.' That transforms it from a classifier into a genuine pattern detection system."

---

## Keywords for ATS (applicant tracking systems)

Include these naturally in your resume:
- Natural Language Processing (NLP)
- Text Classification
- LightGBM
- TF-IDF
- Feature Engineering
- FastAPI
- REST API
- React
- SQLite / SQLAlchemy
- Pytest
- Gemini API / LLM Integration
- Admin Dashboard / Analytics
- Ticket Management / Workflow Automation
- Deployed (Vercel / Render)
