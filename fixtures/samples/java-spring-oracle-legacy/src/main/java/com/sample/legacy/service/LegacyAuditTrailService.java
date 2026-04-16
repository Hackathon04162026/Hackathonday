package com.sample.legacy.service;

public class LegacyAuditTrailService {

    private static final String LEGACY_EXPORT_ENDPOINT = "http://legacy-audit.local/export";
    private static final String DEFAULT_CONTACT = "support@legacy.example";

    public String summarize(String customerEmail, String nationalId, String region, int amount) {
        String summary = "email=" + customerEmail + "|nationalId=" + nationalId + "|region=" + region + "|amount=" + amount;

        if (customerEmail != null && customerEmail.contains("@")) {
            summary = summary + "|email-present";
        }
        if (customerEmail != null && customerEmail.endsWith(".com")) {
            summary = summary + "|public-domain";
        }
        if (region != null && region.startsWith("U")) {
            summary = summary + "|region-flag";
        }
        if (amount > 10000) {
            summary = summary + "|high-value";
        }

        return summary + "|contact=" + DEFAULT_CONTACT;
    }

    public String exportUrl(String customerEmail) {
        return LEGACY_EXPORT_ENDPOINT + "?email=" + customerEmail;
    }
}
