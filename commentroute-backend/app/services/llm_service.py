import google.generativeai as genai
from app.config import settings

_model = None


def get_model():
    global _model
    if _model is None:
        genai.configure(api_key=settings.gemini_api_key)
        _model = genai.GenerativeModel("gemini-2.5-flash")
    return _model


def generate_routing_summary(
    comment: str,
    team: str,
    source_type: str,
    priority: str,
) -> str:
    """
    Gemini 2.5 Flash generates a short routing summary and action
    recommendation for the receiving team.

    Gemini does NOT perform classification — LightGBM does that.
    Gemini only contextualises the result for the team.
    """
    try:
        model = get_model()

        if source_type == "office_report":
            context_line = (
                "This is an internal report submitted by an office employee "
                "through the HR/internal reporting portal."
            )
            if priority == "Critical":
                urgency_line = (
                    "This ticket is marked CRITICAL. It involves potential "
                    "workplace harassment, abuse, or a compliance violation "
                    "and requires immediate escalation."
                )
            elif priority == "High":
                urgency_line = "This ticket is marked HIGH priority."
            else:
                urgency_line = ""
        else:
            context_line = (
                "This is a customer review or complaint submitted through "
                "the external customer portal."
            )
            urgency_line = (
                "This ticket is marked HIGH priority and may involve "
                "a legal, security, or abuse concern."
                if priority in ("High", "Critical")
                else ""
            )

        prompt_parts = [
            f"Feedback submitted:\n\"{comment}\"\n",
            context_line,
            urgency_line,
            f"\nThis has been classified and routed to the '{team}' team.",
            (
                "\nWrite a concise 1-2 sentence routing summary and action "
                "recommendation for the receiving team. Be direct and professional."
            ),
        ]

        prompt = "\n".join(p for p in prompt_parts if p)

        response = model.generate_content(prompt)
        return response.text.strip()

    except Exception:
        # Graceful fallback — never let LLM failure block ticket creation
        return (
            f"Routed to {team}. "
            f"Priority: {priority}. Please review the ticket details promptly."
        )