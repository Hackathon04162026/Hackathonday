SELECT TOP 100 customer_name, account_number, customer_email, support_pin, order_total
FROM dbo.legacy_orders
WHERE order_total > 5000
  AND support_pin IS NOT NULL
ORDER BY order_total DESC;
