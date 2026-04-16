package com.sample.mixed.controller;

import com.sample.mixed.service.OrderService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class LegacyController {
    private final OrderService orderService = new OrderService();

    @GetMapping("/orders/search")
    public Map<String, Object> search(@RequestParam(defaultValue = "") String q,
                                      @RequestParam(defaultValue = "false") boolean vip) {
        String sqlPreview = "SELECT * FROM orders WHERE customer_name LIKE '%" + q + "%'";
        return Map.of(
            "query", q,
            "sqlPreview", sqlPreview,
            "summary", orderService.buildEscalationQueue(q, vip, false)
        );
    }
}
