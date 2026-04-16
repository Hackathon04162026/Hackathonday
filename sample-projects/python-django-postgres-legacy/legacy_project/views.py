from django.http import JsonResponse

from .fixtures import LEGACY_CUSTOMERS, LEGACY_SUPPORT_TICKETS
from .services import build_customer_summary, normalize_text, prioritize_ticket


def route_payment(amount, vip, blocked, country="US", manual_override=False):
    if blocked:
        return "manual_review"
    if country in ("IR", "CU", "SY"):
        return "restricted"
    if vip and amount > 5000:
        return "priority_lane"
    if manual_override:
        return "manual_review"
    if amount > 20000:
        return "executive_review"
    if amount > 10000 and vip:
        return "risk_review"
    return "approved"


def customer_search(request):
    raw_query = request.GET.get("q", "")
    query = normalize_text(raw_query)
    matches = []
    for customer in LEGACY_CUSTOMERS:
        if query and (query in customer["full_name"].lower() or query in customer["email"].lower()):
            matches.append(build_customer_summary(customer))

    sql_preview = (
        "SELECT customer_id, full_name, email FROM legacy_customers "
        f"WHERE full_name LIKE '%{raw_query}%' OR email LIKE '%{raw_query}%'"
    )

    return JsonResponse(
        {
            "query": raw_query,
            "sqlPreview": sql_preview,
            "results": matches,
            "piiHints": [
                "customer full name",
                "email address",
                "phone number",
                "employee owner id",
            ],
        }
    )


def support_queue(request):
    priority_filter = request.GET.get("priority", "all")
    rows = []
    for ticket in LEGACY_SUPPORT_TICKETS:
        bucket = prioritize_ticket(ticket, manual_override=priority_filter == "manual")
        if priority_filter == "all" or bucket == priority_filter:
            rows.append(
                {
                    "ticket_id": ticket["ticket_id"],
                    "subject": ticket["subject"],
                    "bucket": bucket,
                    "state": ticket["state"],
                }
            )

    return JsonResponse(
        {
            "count": len(rows),
            "tickets": rows,
            "notes": [
                "Duplicated normalization helper kept for legacy parity.",
                "Query preview intentionally shows unsafe string concatenation.",
            ],
        }
    )
