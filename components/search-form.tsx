import { Search } from "lucide-react";

export function SearchForm({ query = "", id = "site-search" }: { query?: string; id?: string }) {
  return (
    <form action="/search" className="search-form" role="search">
      <label className="sr-only" htmlFor={id}>搜索文章</label>
      <Search aria-hidden="true" className="search-form-icon" size={17} strokeWidth={1.8} />
      <input
        autoComplete="off"
        defaultValue={query}
        id={id}
        name="q"
        placeholder="搜索标题与正文"
        type="search"
      />
      <button aria-label="搜索" title="搜索文章" type="submit">
        <Search aria-hidden="true" size={17} />
      </button>
    </form>
  );
}
