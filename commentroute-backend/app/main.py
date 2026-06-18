import os
import urllib.request
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import tickets, users, dashboard


def download_model_if_needed():
    """
    Downloads model_pipeline.joblib from Hugging Face at startup
    if it doesn't already exist on disk. This runs once on cold start.
    """
    path = os.getenv("MODEL_PATH", "app/ml_models/model_pipeline.joblib")
    if not os.path.exists(path):
        url = os.getenv("MODEL_DOWNLOAD_URL", "")
        if not url:
            print("WARNING: MODEL_DOWNLOAD_URL not set. Model file missing.")
            return
        os.makedirs(os.path.dirname(path), exist_ok=True)
        print(f"Downloading model ({path})...")
        urllib.request.urlretrieve(url, path)
        print("Model downloaded successfully.")
    else:
        print("Model already exists, skipping download.")


# Download before anything else initializes
download_model_if_needed()

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CommentRoute API",
    description=(
        "Intelligent Feedback Triage & Incident Management Platform.\n\n"
        "Powered by LightGBM classification + Gemini 2.5 Flash routing summaries.\n\n"
        "_Model outputs are mapped to business workflows for demonstration purposes._"
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tickets.router)
app.include_router(users.router)
app.include_router(dashboard.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "version": "1.0.0"}