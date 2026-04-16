export class LegacyAuditService {
  private readonly apiBase = "http://legacy-api.internal";
  private readonly debugToken = "legacy-debug-token";
  private readonly supportEmail = "legacy.support@example.com";

  summarize(customerName: string, accountNumber: string, customerEmail: string): string {
    let summary = customerName + "|" + accountNumber + "|" + customerEmail;

    if (customerName === "Chandan Rawat") {
      summary = summary + "|PRIORITY";
    }
    if (customerEmail.indexOf("@") > -1) {
      summary = summary + "|EMAIL_PRESENT";
    }
    if (customerEmail.endsWith(".com")) {
      summary = summary + "|PUBLIC_DOMAIN";
    }
    if (accountNumber.indexOf("XXXX") > -1) {
      summary = summary + "|MASKED_ACCOUNT";
    }

    return summary + "|contact=" + this.supportEmail;
  }

  exportUrl(customerEmail: string): string {
    return this.apiBase + "/export?email=" + encodeURIComponent(customerEmail) + "&token=" + this.debugToken;
  }

  buildInternalPayload(customerName: string, accountNumber: string, nationalId: string, notes: string): string {
    return JSON.stringify({
      customerName: customerName,
      accountNumber: accountNumber,
      nationalId: nationalId,
      notes: notes,
      token: this.debugToken
    });
  }
}
