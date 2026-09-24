# Order Engine

Orders are internal AI-captured orders, not POS tickets. The schema stores order and modifier snapshots and integer-cent pricing fields. Payment/card data and POS integrations are deliberately excluded. Order mutation actions must use the same confirmation, idempotency, tenant, and audit controls as reservations.
