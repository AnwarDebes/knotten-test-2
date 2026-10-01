"use client";

/** Opens the browser's print dialog, where the report can also be saved as PDF. */
export default function PrintButton({ label }: { label: string }) {
  return <button type="button" className="btn btn-sm no-print" onClick={() => window.print()}>{label}</button>;
}
