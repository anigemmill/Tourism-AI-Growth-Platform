// Search box + filters (a plain GET form, works without JS) and pager.

import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { hrefWith, PAGE_SIZE, type Params } from "@/lib/admin/paging";

export function FilterBar({
  action,
  q,
  placeholder,
  filters,
}: {
  action: string;
  q: string;
  placeholder: string;
  filters: { name: string; label: string; value: string; options: { value: string; label: string }[] }[];
}) {
  const cls = "rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-(--focus) focus:outline-none focus:ring-2 focus:ring-(--focus)/25";
  return (
    <form action={action} method="get" role="search" className="mb-4 flex flex-wrap items-end gap-2">
      <div className="min-w-[14rem] flex-1">
        <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted">Search</label>
        <input id="q" name="q" defaultValue={q} placeholder={placeholder} className={`${cls} w-full`} />
      </div>
      {filters.map((f) => (
        <div key={f.name}>
          <label htmlFor={`filter-${f.name}`} className="mb-1 block text-xs font-medium text-muted">{f.label}</label>
          <select id={`filter-${f.name}`} name={f.name} defaultValue={f.value} className={cls}>
            <option value="">All</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      ))}
      <button type="submit" className={buttonClass("secondary")}>Apply</button>
      <Link href={action} className={buttonClass("ghost")}>Clear</Link>
    </form>
  );
}

export function Pager({ base, sp, page, total }: { base: string; sp: Params; page: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted">
      <span>{total === 0 ? "No results" : `${from}–${to} of ${total}`}</span>
      <span className="flex gap-2">
        {page > 1 ? <Link className={buttonClass("secondary", "sm")} href={hrefWith(base, sp, { page: page - 1 })}>Previous</Link> : null}
        {page < pages ? <Link className={buttonClass("secondary", "sm")} href={hrefWith(base, sp, { page: page + 1 })}>Next</Link> : null}
      </span>
    </nav>
  );
}
