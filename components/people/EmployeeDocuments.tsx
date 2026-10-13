"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { deleteEmployeeDocument, employeeDocumentLink, listEmployeeDocuments, uploadEmployeeDocument, type EmployeeDocument } from "@/app/actions/employee-documents";
import { useToast } from "@/components/ui/Toast";
import { usePeople } from "./usePeople";

const sizeLabel = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(value));

export function EmployeeDocuments({ employeeId }: { employeeId: string }) {
  const { workspace, isAdmin } = usePeople();
  const toast = useToast();
  const picker = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [category, setCategory] = useState<EmployeeDocument["category"]>("Contract");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (workspace.mode === "demo") {
      setLoading(false);
      return () => { active = false; };
    }
    listEmployeeDocuments(employeeId).then((result) => {
      if (!active) return;
      if (result.ok) setDocuments(result.data);
      else setError(result.error);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError("Could not load employee documents. Try again.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [employeeId, workspace.mode]);

  if (!isAdmin) return null;

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = picker.current?.files?.[0];
    if (!file) return setError("Choose a document to upload.");
    setBusy(true);
    setError("");
    const result = await uploadEmployeeDocument(employeeId, file, category);
    if (!result.ok) setError(result.error);
    else {
      setDocuments((current) => [result.data, ...current]);
      form.current?.reset();
      toast("Employee document uploaded.");
    }
    setBusy(false);
  }

  async function open(document: EmployeeDocument) {
    const result = await employeeDocumentLink(document.id);
    if (result.ok) window.location.assign(result.data);
    else toast(result.error);
  }

  async function remove(document: EmployeeDocument) {
    if (!window.confirm(`Delete ${document.fileName}? This removes the file permanently.`)) return;
    setBusy(true);
    const result = await deleteEmployeeDocument(document.id);
    if (!result.ok) toast(result.error);
    else {
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      toast("Document deleted.");
    }
    setBusy(false);
  }

  return (
    <section className="panel employee-documents" aria-labelledby="employee-documents-title">
      <div className="panel-head"><div><h2 id="employee-documents-title">Employee documents</h2><p>Private HR files · up to 3 MB each</p></div></div>
      {workspace.mode === "demo" ? (
        <div className="panel-body"><p className="stat-foot" style={{ margin: 0 }}>Document storage is available in a signed-in company workspace after the database migration is applied.</p></div>
      ) : (
        <>
          <form ref={form} className="panel-body employee-document-form" onSubmit={upload}>
            <label className="field"><span className="label">Document type</span><select className="control" value={category} onChange={(event) => setCategory(event.target.value as EmployeeDocument["category"])}><option>Contract</option><option>Offer letter</option><option>ID</option><option>Certificate</option><option>Other</option></select></label>
            <label className="field"><span className="label">Choose a file</span><input ref={picker} className="control" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" /></label>
            <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Upload document"}</button>
            {error ? <p className="auth-error" role="alert" style={{ gridColumn: "1 / -1", margin: 0 }}>{error}</p> : null}
          </form>
          {loading ? <div className="panel-body"><p className="stat-foot" style={{ margin: 0 }}>Loading documents…</p></div> : documents.length ? (
            <ul className="list">{documents.map((document) => <li className="list-row" key={document.id}>
              <div className="person-info"><strong>{document.fileName}</strong><span>{document.category} · {sizeLabel(document.fileSize)} · Added {dateLabel(document.uploadedAt)}</span></div>
              <div className="employee-document-actions"><button type="button" className="btn small" onClick={() => open(document)}>Open</button><button type="button" className="btn small danger" onClick={() => remove(document)} disabled={busy}>Delete</button></div>
            </li>)}</ul>
          ) : <div className="panel-body"><p className="stat-foot" style={{ margin: 0 }}>{error || "No documents have been uploaded for this employee."}</p></div>}
        </>
      )}
    </section>
  );
}
