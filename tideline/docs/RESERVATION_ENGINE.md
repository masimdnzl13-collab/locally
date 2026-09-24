# Reservation Engine

Reservations are tenant-scoped and use `reservation_settings` as the authoritative policy source. Availability validates restaurant status, reservation enablement, party-size limits, date/time validity, and timezone-aware requested times. Mutations must flow through `ActionEngine`; callers must confirm the exact payload before execution. Reservation events and audit events distinguish AI, staff, and system actors.
