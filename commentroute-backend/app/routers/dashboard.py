from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import DashboardStats
from app.crud import crud

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)):
    """
    Full analytics for the admin dashboard.

    Returns:
      - Overall ticket counts (total, open, in-progress, resolved, critical)
      - Breakdown by source portal (customer_review vs office_report)
      - Breakdown by assigned team
      - Cross-tab: team × source (which team got what from where)
      - ML model label distribution (for model monitoring)
      - Priority distribution
      - Status funnel
    """
    return crud.get_dashboard_stats(db)
