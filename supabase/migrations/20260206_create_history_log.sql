
CREATE TABLE IF NOT EXISTS "public"."company_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "created_by" TEXT DEFAULT 'System',
    PRIMARY KEY ("id")
);

ALTER TABLE "public"."company_history" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON "public"."company_history"
AS PERMISSIVE FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
