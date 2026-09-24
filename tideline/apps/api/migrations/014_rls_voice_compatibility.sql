-- Voice webhooks resolve the restaurant from an unscoped phone mapping before
-- a tenant context exists. Keep those lifecycle tables application-authorized
-- until every webhook path supplies a transaction-local tenant context.
ALTER TABLE calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE call_events DISABLE ROW LEVEL SECURITY;
