DROP TABLE IF EXISTS "public"."workflow_history";
DROP TYPE IF EXISTS "public"."workflow_stage";
CREATE TYPE "public"."workflow_stage" AS ENUM ('submitted', 'review_step1', 'review_step2', 'review_step3', 'completed', 'rejected');
DROP TYPE IF EXISTS "public"."workflow_stage";
CREATE TYPE "public"."workflow_stage" AS ENUM ('submitted', 'review_step1', 'review_step2', 'review_step3', 'completed', 'rejected');

-- Table Definition
CREATE TABLE "public"."workflow_history" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "document_id" uuid,
    "from_stage" "public"."workflow_stage",
    "to_stage" "public"."workflow_stage",
    "action_by" uuid,
    "action_type" text,
    "comment" text,
    "created_at" timestamptz DEFAULT now(),
    CONSTRAINT "workflow_history_action_by_fkey" FOREIGN KEY ("action_by") REFERENCES "public"."profiles"("id"),
    CONSTRAINT "workflow_history_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."signatures";
DROP TYPE IF EXISTS "public"."workflow_stage";
CREATE TYPE "public"."workflow_stage" AS ENUM ('submitted', 'review_step1', 'review_step2', 'review_step3', 'completed', 'rejected');

-- Table Definition
CREATE TABLE "public"."signatures" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "document_id" uuid,
    "file_id" uuid,
    "signed_by" uuid,
    "signature_text" text,
    "workflow_stage" "public"."workflow_stage",
    "created_at" timestamptz DEFAULT now(),
    CONSTRAINT "signatures_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE,
    CONSTRAINT "signatures_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."document_files"("id") ON DELETE CASCADE,
    CONSTRAINT "signatures_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "public"."profiles"("id"),
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."document_files";
-- Table Definition
CREATE TABLE "public"."document_files" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "document_id" uuid,
    "file_url" text NOT NULL,
    "file_name" text NOT NULL,
    "uploaded_by" uuid,
    "is_signed" bool DEFAULT false,
    "created_at" timestamptz DEFAULT now(),
    CONSTRAINT "document_files_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE,
    CONSTRAINT "document_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id"),
    PRIMARY KEY ("id")
);

DROP VIEW IF EXISTS "public"."document_stats";
 SELECT workflow_stage,
    count(*) AS total_count
   FROM documents
  GROUP BY workflow_stage;

DROP TABLE IF EXISTS "public"."profiles";
DROP TYPE IF EXISTS "public"."user_role";
CREATE TYPE "public"."user_role" AS ENUM ('admin', 'angajat', 'cetatean');
DROP TYPE IF EXISTS "public"."department_type";
CREATE TYPE "public"."department_type" AS ENUM ('verificare_initiala', 'verificare_tehnica', 'verificare_finala');

-- Table Definition
CREATE TABLE "public"."profiles" (
    "id" uuid NOT NULL,
    "email" text,
    "full_name" text,
    "role" "public"."user_role" DEFAULT 'cetatean'::user_role,
    "department" "public"."department_type",
    "created_at" timestamptz DEFAULT now(),
    CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."documents";
DROP TYPE IF EXISTS "public"."document_category_type";
CREATE TYPE "public"."document_category_type" AS ENUM ('cerere_cetatean', 'act_administrativ', 'contract', 'raport');
DROP TYPE IF EXISTS "public"."workflow_stage";
CREATE TYPE "public"."workflow_stage" AS ENUM ('submitted', 'review_step1', 'review_step2', 'review_step3', 'completed', 'rejected');

-- Table Definition
CREATE TABLE "public"."documents" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "title" text NOT NULL,
    "description" text,
    "category" "public"."document_category_type" DEFAULT 'cerere_cetatean'::document_category_type,
    "workflow_stage" "public"."workflow_stage" DEFAULT 'submitted'::workflow_stage,
    "current_assignee" uuid,
    "uploaded_by" uuid NOT NULL,
    "rejection_reason" text,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now(),
    "completed_at" timestamptz,
    CONSTRAINT "documents_current_assignee_fkey" FOREIGN KEY ("current_assignee") REFERENCES "public"."profiles"("id"),
    CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id"),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_documents_stage ON public.documents USING btree (workflow_stage);
CREATE INDEX idx_documents_assignee ON public.documents USING btree (current_assignee);
CREATE INDEX idx_documents_category ON public.documents USING btree (category);
CREATE INDEX idx_documents_created_at ON public.documents USING btree (created_at);
CREATE INDEX idx_documents_uploaded_by ON public.documents USING btree (uploaded_by);
CREATE INDEX idx_documents_title_search ON public.documents USING gin (title gin_trgm_ops);
CREATE INDEX idx_documents_description_search ON public.documents USING gin (description gin_trgm_ops);

