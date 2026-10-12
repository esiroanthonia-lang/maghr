import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/ComingNext";

export const metadata: Metadata = { title: "Employees" };

export default function Page() {
  return (
    <ComingNext
      title="Employees"
      eyebrow="YOUR PEOPLE, ONE PLACE"
      intro="Employee directory, teams, and essential details."
      planned={[
        "Searchable, filterable employee directory",
        "Add-employee form with validation",
        "Employees converted from hired candidates appear here automatically",
        "Directory export (CSV) — demo only",
      ]}
    />
  );
}
