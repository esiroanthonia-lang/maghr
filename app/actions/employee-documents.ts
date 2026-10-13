"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/server/session";

export type EmployeeDocument = {
  id: string;
  fileName: string;
  category: "Contract" | "Offer letter" | "ID" | "Certificate" | "Other";
  contentType: string;
  fileSize: number;
  uploadedAt: string;
};

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const BUCKET = "employee-documents";
// Keep server-action uploads below the hosted function request-body limit.
const MAX_SIZE = 3 * 1024 * 1024;
const MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const CATEGORIES = ["Contract", "Offer letter", "ID", "Certificate", "Other"] as const;

async function hrSession() {
  const session = await requireWorkspace();
  if (session.info.me.role !== "hr_admin") throw new Error("Only HR admins can manage employee documents.");
  return session;
}

function fail(error: unknown): Result<never> {
  return { ok: false, error: error instanceof Error ? error.message : "Could not complete that document action." };
}

export async function listEmployeeDocuments(employeeId: string): Promise<Result<EmployeeDocument[]>> {
  try {
    const { supabase, info } = await hrSession();
    const { data, error } = await supabase
      .from("employee_documents")
      .select("id, file_name, category, content_type, file_size, uploaded_at")
      .eq("org_id", info.orgId)
      .eq("employee_id", employeeId)
      .order("uploaded_at", { ascending: false });
    if (error) throw new Error("Could not load employee documents. Apply the latest database migration and try again.");
    return {
      ok: true,
      data: (data ?? []).map((row) => ({
        id: row.id,
        fileName: row.file_name,
        category: row.category as EmployeeDocument["category"],
        contentType: row.content_type,
        fileSize: Number(row.file_size),
        uploadedAt: row.uploaded_at,
      })),
    };
  } catch (error) {
    return fail(error);
  }
}

export async function uploadEmployeeDocument(employeeId: string, file: File, category: string): Promise<Result<EmployeeDocument>> {
  try {
    const { supabase, info } = await hrSession();
    if (!/^[0-9a-f-]{36}$/i.test(employeeId)) return { ok: false, error: "Choose a valid employee." };
    if (!(CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: "Choose a document category." };
    if (!file || file.size < 1 || file.size > MAX_SIZE) return { ok: false, error: "Choose a file up to 3 MB." };
    if (!MIME.has(file.type)) return { ok: false, error: "Upload a PDF, Word document, JPG or PNG." };
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("id", employeeId)
      .eq("org_id", info.orgId)
      .maybeSingle();
    if (employeeError || !employee) return { ok: false, error: "That employee was not found in your company." };

    const cleanName = file.name.normalize("NFKC").replace(/[\\/\u0000-\u001f]/g, "_").slice(-180) || "document";
    const objectPath = `${info.orgId}/${employeeId}/${randomUUID()}-${cleanName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, file, {
      contentType: file.type,
      cacheControl: "60",
      upsert: false,
    });
    if (uploadError) throw new Error("Upload failed. Check that the employee documents migration is installed.");

    const { data, error } = await supabase
      .from("employee_documents")
      .insert({ org_id: info.orgId, employee_id: employeeId, object_path: objectPath, file_name: cleanName, category, content_type: file.type, file_size: file.size })
      .select("id, file_name, category, content_type, file_size, uploaded_at")
      .single();
    if (error) {
      await supabase.storage.from(BUCKET).remove([objectPath]);
      throw new Error("Could not save document details. Check that the employee documents migration is installed.");
    }
    revalidatePath(`/employees/${employeeId}`);
    return { ok: true, data: { id: data.id, fileName: data.file_name, category: data.category as EmployeeDocument["category"], contentType: data.content_type, fileSize: Number(data.file_size), uploadedAt: data.uploaded_at } };
  } catch (error) {
    return fail(error);
  }
}

export async function employeeDocumentLink(documentId: string): Promise<Result<string>> {
  try {
    const { supabase, info } = await hrSession();
    const { data: document, error } = await supabase
      .from("employee_documents")
      .select("object_path")
      .eq("id", documentId)
      .eq("org_id", info.orgId)
      .maybeSingle();
    if (error || !document) return { ok: false, error: "That document could not be found." };
    const { data, error: linkError } = await supabase.storage.from(BUCKET).createSignedUrl(document.object_path, 60);
    if (linkError || !data?.signedUrl) return { ok: false, error: "Could not open this document." };
    return { ok: true, data: data.signedUrl };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteEmployeeDocument(documentId: string): Promise<Result> {
  try {
    const { supabase, info } = await hrSession();
    const { data: document, error } = await supabase
      .from("employee_documents")
      .select("employee_id, object_path")
      .eq("id", documentId)
      .eq("org_id", info.orgId)
      .maybeSingle();
    if (error || !document) return { ok: false, error: "That document could not be found." };
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([document.object_path]);
    if (removeError) return { ok: false, error: "Could not remove the stored file." };
    const { error: deleteError } = await supabase.from("employee_documents").delete().eq("id", documentId).eq("org_id", info.orgId);
    if (deleteError) return { ok: false, error: "Could not remove the document record." };
    revalidatePath(`/employees/${document.employee_id}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}
