ALTER TABLE media ADD COLUMN provider text NOT NULL DEFAULT 'r2';--> statement-breakpoint
CREATE INDEX provider_idx_media ON media(provider);
