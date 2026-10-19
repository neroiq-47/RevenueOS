import { NextResponse } from "next/server";
import { isSameOrigin, jsonError, requireEntitledApi } from "@/lib/http";
import { checkLimit, recordUsage } from "@/lib/usage";
import { MAX_CSV_BYTES, parseOpportunitiesCsv } from "@/lib/csv";
import type { Database } from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHUNK_SIZE = 500;
/** Multipart framing adds a little overhead on top of the file itself. */
const MAX_BODY_BYTES = MAX_CSV_BYTES + 64 * 1024;

type OpportunityInsert = Database["public"]["Tables"]["opportunities"]["Insert"];

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * POST multipart/form-data { file: <.csv> }
 * All-or-nothing: if any row is invalid, nothing is written and every problem is returned.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);

  const auth = await requireEntitledApi();
  if ("response" in auth) return auth.response;
  const { ctx } = auth;

  const limit = await checkLimit(ctx, "import", { perMinute: 5, perMonth: 200 });
  if (!limit.ok) return jsonError(limit.reason, limit.status);

  // Reject oversized bodies before buffering them.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonError("File is too large. The maximum is 1 MB.", 413);
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    return jsonError("Upload the CSV as multipart/form-data with a 'file' field.", 400);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Could not read the upload. Please try again.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("No file uploaded. Choose a .csv file.", 400);
  if (!file.name.toLowerCase().endsWith(".csv")) return jsonError("Only .csv files are supported.", 415);
  if (file.size === 0) return jsonError("The file is empty.", 422, { missingHeaders: [], errors: [] });
  if (file.size > MAX_CSV_BYTES) return jsonError("File is too large. The maximum is 1 MB.", 413);

  const text = await file.text();
  if (text.includes("\u0000")) return jsonError("This doesn't look like a text CSV file.", 415);

  const result = parseOpportunitiesCsv(text);
  if (result.missingHeaders.length > 0 || result.errorCount > 0) {
    const error =
      result.missingHeaders.length > 0
        ? `Missing required column${result.missingHeaders.length > 1 ? "s" : ""}: ${result.missingHeaders.join(", ")}.`
        : `Found ${result.errorCount} problem${result.errorCount === 1 ? "" : "s"}. Nothing was imported; fix the file and try again.`;
    return jsonError(error, 422, {
      missingHeaders: result.missingHeaders,
      errors: result.errors,
      errorCount: result.errorCount,
    });
  }

  const orgId = ctx.org.id; // never trust client-supplied ids

  // 1) Upsert contacts, one per email (Postgres rejects duplicate conflict keys in one statement).
  const contactsByEmail = new Map<string, { organization_id: string; email: string; name: string }>();
  for (const row of result.rows) {
    contactsByEmail.set(row.contact_email, { organization_id: orgId, email: row.contact_email, name: row.contact_name });
  }
  const emailToId = new Map<string, string>();
  for (const batch of chunk([...contactsByEmail.values()], CHUNK_SIZE)) {
    const { data, error } = await ctx.supabase
      .from("contacts")
      .upsert(batch, { onConflict: "organization_id,email" })
      .select("id, email");
    if (error || !data) {
      console.error("import: contact upsert failed", error.code);
      return jsonError("Could not save contacts. Nothing was imported.", 500);
    }
    for (const c of data) emailToId.set(c.email, c.id);
  }

  // 2) Insert opportunities. If a later chunk fails, remove the earlier ones to stay all-or-nothing.
  const inserts: OpportunityInsert[] = result.rows.map((row) => ({
    organization_id: orgId,
    contact_id: emailToId.get(row.contact_email) ?? null,
    title: row.title,
    amount_cents: row.amount_cents,
    currency: row.currency,
    stage: row.stage,
    last_activity_at: row.last_activity_at,
  }));
  const insertedIds: string[] = [];
  for (const batch of chunk(inserts, CHUNK_SIZE)) {
    const { data, error } = await ctx.supabase.from("opportunities").insert(batch).select("id");
    if (error || !data) {
      console.error("import: opportunity insert failed", error.code);
      if (insertedIds.length > 0) {
        await ctx.supabase.from("opportunities").delete().eq("organization_id", orgId).in("id", insertedIds);
      }
      return jsonError("Could not save opportunities. Nothing was imported.", 500);
    }
    insertedIds.push(...data.map((d) => d.id));
  }

  try {
    await recordUsage(ctx, "import");
  } catch (error) {
    // The import succeeded; a missed usage row should not turn it into an error for the user.
    console.error("import: recordUsage failed", error);
  }

  return NextResponse.json({ imported: insertedIds.length, contacts: contactsByEmail.size });
}
