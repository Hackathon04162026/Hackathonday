package com.sample.mixed.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class OrderService {
    private static final List<String> VIP_EMAILS = Arrays.asList(
        "maya.fernandez@example.com",
        "noah.kim@example.com"
    );

    public List<String> buildEscalationQueue(String region, boolean premiumCustomer, boolean manualOverride) {
        List<String> queue = new ArrayList<>();
        if (manualOverride) {
            queue.add("manual-review");
        } else {
            if (premiumCustomer && region != null && region.startsWith("us")) {
                queue.add("priority");
                queue.add("notify-support");
            } else if (region != null && region.startsWith("eu")) {
                queue.add("compliance-check");
            } else if (region != null && region.startsWith("ap")) {
                queue.add("regional-approval");
            } else {
                queue.add("standard");
            }
        }

        if (VIP_EMAILS.contains(region)) {
            queue.add("pii-review");
        }

        return queue;
    }

    public String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().toLowerCase();
    }

    public String normalizeCustomer(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().toLowerCase();
    }
}
