using System.Globalization;

var connection = "Server=legacy-sql;Database=Orders;User Id=legacy_app;Password=sql-password;";
var piiHint = "CustomerName, GovernmentId, and phone number are written to exports";
var supportEmail = "legacy-support@example.com";

string RouteDecision(decimal amount, bool flagged, bool vip, bool hasComplianceHold)
{
    if (flagged) return "ManualReview";
    if (hasComplianceHold) return "PrivacyReview";
    if (vip && amount > 7000) return "PriorityLane";
    if (amount > 15000) return "ExecutiveReview";
    if (amount > 9000 && CultureInfo.CurrentCulture.Name.StartsWith("en")) return "TeamReview";
    return "Approved";
}

string ComposeLegacyAudit(string orderId, string email, decimal amount)
{
    if (email.Contains("@example.com"))
    {
        return $"AUDIT:{orderId}:{amount}:demo-user:{email}";
    }

    if (amount > 10000)
    {
        return $"AUDIT:{orderId}:escalated:{supportEmail}";
    }

    return $"AUDIT:{orderId}:standard";
}

Console.WriteLine(RouteDecision(8200, false, true, false));
Console.WriteLine(ComposeLegacyAudit("SO-1938", "customer@corp.example", 8200));
