ALTER TABLE "catalog"."ifra_limits"
  ALTER COLUMN "max_percent" TYPE numeric(14, 8);

CREATE TABLE IF NOT EXISTS "catalog"."ifra_standards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "amendment" integer,
  "publication_years" text,
  "last_publication_year" integer,
  "deadline_existing" text,
  "deadline_new" text,
  "standard_type" text NOT NULL,
  "risk_drivers" text,
  "flavor_note" text,
  "phototoxicity_note" text,
  "restriction_note" text,
  "specification_note" text,
  "other_sources" text,
  "other_sources_note" text,
  "cas_comment" text,
  "synonyms" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "ifra_standards_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "catalog"."ifra_standard_cas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "standard_id" uuid NOT NULL REFERENCES "catalog"."ifra_standards"("id") ON DELETE cascade,
  "cas_number" text NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  CONSTRAINT "ifra_standard_cas_unique" UNIQUE("standard_id", "cas_number")
);

CREATE TABLE IF NOT EXISTS "catalog"."ifra_standard_limits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "standard_id" uuid NOT NULL REFERENCES "catalog"."ifra_standards"("id") ON DELETE cascade,
  "category_code" text NOT NULL,
  "max_percent" numeric(14, 8),
  "unrestricted" boolean DEFAULT false NOT NULL,
  CONSTRAINT "ifra_standard_limits_unique" UNIQUE("standard_id", "category_code")
);

CREATE TABLE IF NOT EXISTS "catalog"."material_ifra_standards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "material_id" uuid NOT NULL REFERENCES "catalog"."materials"("id") ON DELETE cascade,
  "standard_id" uuid NOT NULL REFERENCES "catalog"."ifra_standards"("id") ON DELETE cascade,
  "match_kind" text NOT NULL,
  CONSTRAINT "material_ifra_standards_unique" UNIQUE("material_id", "standard_id")
);
