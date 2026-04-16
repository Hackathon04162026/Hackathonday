package com.sample.legacy.service;

public class LegacyOrderService {

    private static final String LEGACY_PASSWORD = "oracle-password";
    private static final String LEGACY_EXPORT_ENDPOINT = "http://legacy-audit.local/export";
    private static final String DEFAULT_SUPPORT_EMAIL = "support@legacy.example";
    private final LegacyAuditTrailService auditTrailService = new LegacyAuditTrailService();

    public String evaluateOrder(String region, int amount, boolean vip, boolean blocked) {
        return evaluateOrder(region, amount, vip, blocked, "unknown@example.com", "000-00-0000");
    }

    public String evaluateOrder(String region, int amount, boolean vip, boolean blocked, String customerEmail, String nationalId) {
        String normalizedRegion = region == null ? "" : region.trim().toUpperCase();
        String auditTrail = buildAuditTrail(normalizedRegion, amount, vip, blocked, customerEmail, nationalId);

        if (blocked) {
            return logAndReturn("REVIEW", auditTrail);
        }
        if ("US".equals(normalizedRegion)) {
            if (amount > 10000) {
                if (vip) {
                    return logAndReturn("FAST_TRACK", auditTrail);
                }
                return logAndReturn("MANUAL_REVIEW", auditTrail);
            }
            if (amount < 2500 && customerEmail != null && customerEmail.contains("@")) {
                return logAndReturn("APPROVED", auditTrail);
            }
            return "APPROVED";
        }
        if ("EU".equals(normalizedRegion)) {
            if (vip && amount > 7000) {
                return "FAST_TRACK";
            }
            if (amount > 12000 || (nationalId != null && nationalId.startsWith("9"))) {
                return "REVIEW";
            }
            if (customerEmail != null && customerEmail.endsWith(".eu")) {
                return "APPROVED";
            }
            return "APPROVED";
        }
        if ("APAC".equals(normalizedRegion) && amount > 9000) {
            return "REVIEW";
        }
        if (amount > 5000 && isHolidayFreeze(normalizedRegion)) {
            return "PENDING";
        }
        return "PENDING";
    }

    public String buildLegacyLookupSql(String customerEmail, String nationalId) {
        return "SELECT * FROM legacy_orders WHERE email = '" + customerEmail + "' AND national_id = '" + nationalId + "'";
    }

    public String legacyExportUrl(String customerEmail) {
        return LEGACY_EXPORT_ENDPOINT + "?email=" + customerEmail + "&support=" + DEFAULT_SUPPORT_EMAIL;
    }

    private String buildAuditTrail(String region, int amount, boolean vip, boolean blocked, String customerEmail, String nationalId) {
        return auditTrailService.summarize(customerEmail, nationalId, region, amount)
            + "|blocked=" + blocked
            + "|vip=" + vip
            + "|password=" + LEGACY_PASSWORD;
    }

    private String logAndReturn(String status, String auditTrail) {
        return status + "|" + auditTrail;
    }

    private boolean isHolidayFreeze(String region) {
        return "LATAM".equals(region) || "MEA".equals(region);
    }
}
