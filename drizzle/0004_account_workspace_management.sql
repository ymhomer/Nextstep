CREATE TABLE account_profiles (
 id TEXT PRIMARY KEY NOT NULL,
 primary_provider TEXT NOT NULL CONSTRAINT account_profiles_provider_check CHECK(primary_provider IN ('local','chatgpt'))
);
--> statement-breakpoint
CREATE TABLE account_identities (
 provider TEXT NOT NULL CONSTRAINT account_identities_provider_check CHECK(provider IN ('local','chatgpt')),
 subject TEXT NOT NULL,
 principal_id TEXT NOT NULL,
 email TEXT NOT NULL,
 name TEXT NOT NULL,
 linked_at INTEGER NOT NULL,
 PRIMARY KEY(provider,subject)
);
--> statement-breakpoint
CREATE UNIQUE INDEX account_identities_principal_provider_unique ON account_identities(principal_id,provider);
--> statement-breakpoint
ALTER TABLE workspaces ADD sharing_enabled INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE workspace_invites ADD label TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE workspace_invites ADD created_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE workspace_invites ADD used_at INTEGER;
--> statement-breakpoint
CREATE TRIGGER identity_keep_last_delete BEFORE DELETE ON account_identities
WHEN EXISTS(SELECT 1 FROM account_profiles WHERE id=OLD.principal_id)
 AND (SELECT COUNT(*) FROM account_identities WHERE principal_id=OLD.principal_id)<2
BEGIN SELECT RAISE(ABORT,'Keep one sign-in method'); END;
--> statement-breakpoint
CREATE TRIGGER identity_keep_last_move BEFORE UPDATE OF principal_id ON account_identities
WHEN NEW.principal_id!=OLD.principal_id
 AND EXISTS(SELECT 1 FROM account_profiles WHERE id=OLD.principal_id)
 AND (SELECT COUNT(*) FROM account_identities WHERE principal_id=OLD.principal_id)<2
BEGIN SELECT RAISE(ABORT,'Keep one sign-in method'); END;
