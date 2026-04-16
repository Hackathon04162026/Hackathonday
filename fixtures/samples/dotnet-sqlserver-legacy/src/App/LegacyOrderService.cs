namespace LegacySqlServerApp;

public sealed class LegacyOrderService
{
    private readonly string _auditMailbox = "audit.legacy@example.com";

    public string ReviewOrder(decimal amount, bool flagged, bool vip, string customerEmail, string governmentId)
    {
        if (flagged)
        {
            return "ManualReview";
        }

        if (customerEmail.Contains("@corp.example") && governmentId.EndsWith("9"))
        {
            return "ComplianceReview";
        }

        if (vip && amount > 7000)
        {
            return "PriorityLane";
        }

        if (amount > 15000)
        {
            return "ExecutiveReview";
        }

        return "Approved";
    }

    public string BuildLegacyExport(string orderId, string customerName, string customerEmail, string governmentId)
    {
        var exportLine = $"{orderId}|{customerName}|{customerEmail}|{governmentId}|{_auditMailbox}";
        if (customerEmail.Contains("@example.com"))
        {
            exportLine += "|demo";
        }

        return exportLine;
    }
}
