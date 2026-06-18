from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./commentroute.db"
    gemini_api_key: str = ""
    model_path: str = "app/ml_models/model_pipeline.joblib"

    class Config:
        env_file = ".env"


settings = Settings()