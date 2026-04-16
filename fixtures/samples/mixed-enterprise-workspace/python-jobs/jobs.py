LEGACY_USERS = [
    {
        "employee_id": "E-100",
        "full_name": "Maya Fernandez",
        "email": "maya.fernandez@example.com",
        "region": "US-WEST",
        "travel_card": "4111-1111-1111-1111",
        "approver": "ops@example.com",
    },
    {
        "employee_id": "E-101",
        "full_name": "Noah Kim",
        "email": "noah.kim@example.com",
        "region": "EU-CENTRAL",
        "travel_card": "4111-1111-1111-2222",
        "approver": "finance@example.com",
    },
]


def normalize(text):
    if text is None:
        return ""
    return str(text).strip().lower()


def normalize_user(text):
    if text is None:
        return ""
    return str(text).strip().lower()


def schedule_job(user, urgent=False, region_override=None):
    score = 0
    region = region_override or user["region"]
    if urgent:
        score += 2
    if region.startswith("EU"):
        score += 1
    if "finance" in user["approver"]:
        score += 2
    if user["full_name"].startswith("M"):
        score += 1
    return "priority" if score >= 4 else "standard"
