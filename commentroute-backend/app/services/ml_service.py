import re
import joblib
import pandas as pd
from datetime import datetime, timezone

from app.config import settings

_pipeline = None

LABEL_TO_TEAM = {
    0: "Customer Success / HR General",
    1: "Engineering & Platform",
    2: "Product Team",
    3: "Compliance & HR Escalation",
}

LABEL_NAMES = {
    0: "Customer Success / HR General",
    1: "Engineering & Platform",
    2: "Product Team",
    3: "Compliance & HR Escalation",
}

MAPPING_DISCLAIMER = (
    "The model outputs are mapped to business workflows "
    "for demonstration purposes."
)

# ─────────────────────────────────────────────
# Keyword override rules
# These run AFTER LightGBM but BEFORE the
# hardcoded label mapping.
# If keywords match, they override the ML label.
# ─────────────────────────────────────────────

HR_KEYWORDS = [
    "harassment", "harassing", "harassed",
    "abuse", "abusive", "abused",
    "threat", "threatened", "threatening",
    "discrimination", "discriminate", "discriminatory",
    "assault", "molest", "inappropriate",
    "uncomfortable remarks", "sexual", "misconduct",
    "hostile", "bully", "bullying", "bullied",
    "coercion", "coerced", "retaliation",
]

ENGINEERING_KEYWORDS = [
    "crash", "crashes", "crashed", "crashing",
    "bug", "bugs", "error", "errors",
    "broken", "not working", "doesn't work", "does not work",
    "500", "404", "timeout", "timed out",
    "api", "login", "logout", "authentication",
    "payment", "checkout", "transaction", "gateway",
    "slow", "loading", "performance", "latency",
    "database", "server", "downtime", "outage",
    "failed", "failure", "exception", "traceback",
]

PRODUCT_KEYWORDS = [
    "please add", "feature request", "would like",
    "suggestion", "suggest", "improvement",
    "wishlist", "could you add", "it would be great",
    "new feature", "enhancement", "add support",
    "missing feature", "allow us", "option to",
]


def _keyword_override(comment: str, source_type: str) -> tuple[str, str] | None:
    """
    Returns (team, priority) if a keyword rule fires, else None.
    Rules are checked in priority order: HR → Engineering → Product.
    """
    text = comment.lower()

    # HR escalation — highest priority, always checked first
    if any(kw in text for kw in HR_KEYWORDS):
        if source_type == "office_report":
            return ("Compliance & HR Escalation", "Critical")
        else:
            return ("Compliance & HR Escalation", "High")

    # Engineering — technical issues
    if any(kw in text for kw in ENGINEERING_KEYWORDS):
        return ("Engineering & Platform", "High")

    # Product — feature requests
    if any(kw in text for kw in PRODUCT_KEYWORDS):
        return ("Product Team", "Normal")

    return None


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        _pipeline = joblib.load(settings.model_path)
    return _pipeline


def _build_inference_row(comment: str) -> pd.DataFrame:
    now  = datetime.now(tz=timezone.utc)
    text = comment or ""
    words = text.split()

    row = {
        "comment":    text,
        "race":       "none",
        "religion":   "none",
        "gender":     "none",
        "post_id":    0,
        "emoticon_1": 0,
        "emoticon_2": 0,
        "emoticon_3": 0,
        "upvote":     0,
        "downvote":   0,
        "if_1":       0,
        "if_2":       6,
        "disability": 0,
        "char_len":          len(text),
        "word_count":        len(words),
        "avg_word_len":      len(text) / (len(words) + 1),
        "has_url":           int(bool(re.search(r"http|www", text))),
        "has_numbers":       int(bool(re.search(r"\d", text))),
        "exclamation_count": text.count("!"),
        "question_count":    text.count("?"),
        "upper_ratio":       sum(1 for c in text if c.isupper()) / (len(text) + 1),
        "total_emoticons":   0,
        "has_emoticon":      0,
        "vote_diff":         0,
        "vote_sum":          0,
        "vote_ratio":        0.0,
        "month":      now.month,
        "day":        now.day,
        "dayofweek":  now.weekday(),
        "hour":       now.hour,
        "is_weekend": int(now.weekday() >= 5),
    }

    feature_cols = [
        "comment",
        "race", "religion", "gender",
        "post_id",
        "emoticon_1", "emoticon_2", "emoticon_3",
        "upvote", "downvote", "if_1", "if_2",
        "disability",
        "char_len", "word_count", "avg_word_len",
        "has_url", "has_numbers",
        "exclamation_count", "question_count", "upper_ratio",
        "total_emoticons", "has_emoticon",
        "vote_diff", "vote_sum", "vote_ratio",
        "month", "day", "dayofweek", "hour", "is_weekend",
    ]

    return pd.DataFrame([row])[feature_cols]


def classify_comment(comment: str) -> int:
    pipeline = get_pipeline()
    df = _build_inference_row(comment)
    return int(pipeline.predict(df)[0])


def label_to_team(label: int) -> str:
    return LABEL_TO_TEAM.get(label, "Customer Success / HR General")


def determine_priority(label: int, source_type: str) -> str:
    if label == 3 and source_type == "office_report":
        return "Critical"
    if label == 3 and source_type == "customer_review":
        return "High"
    if label == 1:
        return "High"
    return "Normal"


def classify_and_route(comment: str, source_type: str) -> tuple[int, str, str]:
    """
    Main routing function combining LightGBM + keyword overrides.

    Returns: (predicted_label, team, priority)

    Flow:
      1. LightGBM classifies → raw label (0-3)
      2. Keyword override rules checked
         → if match: use keyword-derived team + priority
         → if no match: use hardcoded label mapping
    """
    predicted_label = classify_comment(comment)

    override = _keyword_override(comment, source_type)
    if override:
        team, priority = override
    else:
        team     = label_to_team(predicted_label)
        priority = determine_priority(predicted_label, source_type)

    return predicted_label, team, priority