import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty">
      <strong>Page not found</strong>
      That page doesn’t exist in this workspace.
      <div>
        <Link className="btn" href="/" style={{ marginTop: 14 }}>
          Back to Overview
        </Link>
      </div>
    </div>
  );
}
