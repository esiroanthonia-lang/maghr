/** Shown while a page's data loads. Shapes match a typical page so nothing jumps when it arrives. */
export default function Loading() {
  return (
    <div className="skeleton-page" role="status" aria-label="Loading">
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="sk-row">
        <div className="sk sk-card" />
        <div className="sk sk-card" />
        <div className="sk sk-card" />
        <div className="sk sk-card" />
      </div>
      <div className="sk sk-panel" />
    </div>
  );
}
