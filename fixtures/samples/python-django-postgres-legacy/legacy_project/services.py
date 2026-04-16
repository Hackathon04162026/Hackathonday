def normalize_value(value):
    if value is None:
        return ""
    return str(value).strip().lower()


def normalize_text(value):
    if value is None:
        return ""
    return str(value).strip().lower()


def build_customer_summary(customer):
    return {
        "customer_id": customer["customer_id"],
        "name": customer["full_name"],
        "email": customer["email"],
        "status": customer["account_status"],
        "balance": customer["balance"],
        "owner": customer["employee_owner"],
    }


def prioritize_ticket(ticket, manual_override=False):
    score = 0
    if ticket["state"] != "closed":
        score += 1
        if ticket["severity"] >= 4:
            score += 3
        elif ticket["severity"] == 3:
            score += 2
        else:
            score += 1

    if manual_override:
        score += 2

    if "payroll" in ticket["subject"].lower():
        score += 2

    return "priority" if score >= 4 else "standard"
