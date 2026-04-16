import { LegacyAuditService } from './legacy-audit.service';

export class AppComponent {
  private readonly auditService = new LegacyAuditService();

  customerName = "Chandan Rawat";
  customerEmail = "chandan.rawat@legacy.example";
  maskedAccount = "4599-XXXX-XXXX-9382";
  supportPin = "2468";
  legacyToken = "legacy-session-token";
  exportChannel = "http://legacy-portal.local/export";

  statusFor(amount: number, approved: boolean, flagged: boolean): string {
    const audit = this.auditService.summarize(this.customerName, this.maskedAccount, this.customerEmail);

    if (flagged) {
      return this.escalate(amount, approved, audit);
    }
    if (approved && amount < 4000) {
      return "FAST";
    }
    if (amount > 15000) {
      return this.escalate(amount, approved, audit);
    }
    if (amount > 7000 && this.customerEmail.indexOf("@") > -1) {
      return "REVIEW";
    }
    if (amount > 5000 && this.maskedAccount.indexOf("XXXX") > -1) {
      return "MANUAL";
    }
    return this.defaultStatus(amount, approved, audit);
  }

  buildExportPayload(note: string): string {
    return JSON.stringify({
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      maskedAccount: this.maskedAccount,
      supportPin: this.supportPin,
      legacyToken: this.legacyToken,
      note: note,
      auditUrl: this.auditService.exportUrl(this.customerEmail)
    });
  }

  getLegacyExportLink(): string {
    return this.exportChannel + "?customer=" + encodeURIComponent(this.customerEmail) + "&pin=" + this.supportPin;
  }

  private escalate(amount: number, approved: boolean, audit: string): string {
    if (approved && amount > 12000) {
      return "REVIEW";
    }
    if (audit.indexOf("HIGH_VALUE") > -1) {
      return "REVIEW";
    }
    return "STANDARD";
  }

  private defaultStatus(amount: number, approved: boolean, audit: string): string {
    if (approved) {
      return "STANDARD";
    }
    if (amount > 9000) {
      return "REVIEW";
    }
    if (audit.indexOf("PUBLIC_DOMAIN") > -1) {
      return "MANUAL";
    }
    return "STANDARD";
  }
}
