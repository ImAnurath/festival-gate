-- Tracks when the post-payment tickets email/WhatsApp was dispatched, so a
-- retried payment webhook can redeliver only when the first send never went out
-- (crash between marking paid and dispatching). Idempotent for prod parity.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "ticketsDeliveredAt" TIMESTAMP(3);
