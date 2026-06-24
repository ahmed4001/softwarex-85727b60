interface FactRow {
  label: string;
  value: string | number | null | undefined;
}

interface FactsTableProps {
  title?: string;
  rows: FactRow[];
  className?: string;
}

/**
 * Plain HTML <table> of key facts. Tables are the single most-extracted
 * surface for AI Overviews and Perplexity citations. Render concrete,
 * comparable values (pricing, founded year, integrations, free plan, etc.).
 */
export function FactsTable({ title = "Key facts", rows, className }: FactsTableProps) {
  const visible = rows.filter((r) => r.value !== null && r.value !== undefined && r.value !== "");
  if (visible.length === 0) return null;
  return (
    <section className={className ?? "my-6"} aria-labelledby="facts-heading">
      <h2 id="facts-heading" className="text-lg font-semibold mb-3">
        {title}
      </h2>
      <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
        <tbody>
          {visible.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <th
                scope="row"
                className="text-left font-medium px-4 py-2.5 bg-muted/40 w-1/3 text-muted-foreground"
              >
                {r.label}
              </th>
              <td className="px-4 py-2.5 text-foreground">{String(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
