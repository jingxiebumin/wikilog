# LLM Wiki: Upstream Project Fit

Reviewed upstream `nashsu/llm_wiki` at commit [`e08cfce`](https://github.com/nashsu/llm_wiki/commit/e08cfce65aad8b76b13546a081c1a8d4422b70c3), using its Chinese README and source/docs.

## Findings

LLM Wiki is a cross-platform **desktop knowledge-management application** for an individual's local document collection. Its own description calls it a self-building personal knowledge base: it imports sources, has an LLM incrementally create and maintain linked Markdown Wiki pages, then lets the user search and chat over that material. It is a concrete implementation of Karpathy's LLM Wiki method, extended with document ingestion, graph analysis, optional embeddings, review workflows, and deep research ([README_CN.md: overview and preserved design](https://github.com/nashsu/llm_wiki/blob/e08cfce65aad8b76b13546a081c1a8d4422b70c3/README_CN.md)).

The app's core architecture is local-first: Tauri v2/Rust desktop backend, React/TypeScript/Vite UI, project folders with immutable `raw/sources/` inputs and generated `wiki/` Markdown, plus optional embedded LanceDB vectors. The README's project layout and build instructions show that users create/manage projects in the app; setup requires Node.js, Rust and `protoc` to build from source. LLM providers/models are configured by the user, with OpenAI, Anthropic, Google, Ollama and custom endpoints listed in the README ([README_CN.md: technology, install, quick start, project structure](https://github.com/nashsu/llm_wiki/blob/e08cfce65aad8b76b13546a081c1a8d4422b70c3/README_CN.md)).

It is **not a turnkey hosted Q&A product or standalone server library**. It does include a useful integration surface: an optional local JSON API on port `19828` supports project/file access, hybrid search, knowledge graph queries, source rescan, page embedding and Agent chat; the separately built MCP server wraps those API calls ([README_CN.md: Local HTTP API + MCP](https://github.com/nashsu/llm_wiki/blob/e08cfce65aad8b76b13546a081c1a8d4422b70c3/README_CN.md), [MCP README](https://github.com/nashsu/llm_wiki/blob/e08cfce65aad8b76b13546a081c1a8d4422b70c3/mcp-server/README.md)). But that API is a bridge into a **running desktop app**: the MCP README explicitly requires the app to be running, and says it does not scan project folders or implement its own search/graph logic. The Rust server defaults to `127.0.0.1`; LAN binding is an opt-in app setting/environment configuration ([server_bind.rs](https://github.com/nashsu/llm_wiki/blob/e08cfce65aad8b76b13546a081c1a8d4422b70c3/src-tauri/src/server_bind.rs)).

## Integration implications

- Reuse is plausible for a self-hosted setup where the desktop app remains running on a trusted machine and the blog backend can securely reach its API. This brings along its project model, local storage, desktop lifecycle, provider configuration, and app-specific authorization.
- The API is not designed as a multi-user web backend: it is localhost-first, has app-level API token/optional unauthenticated-local configuration, and no blog-user/tenant model is documented. Chat requests remain token-protected even when read-oriented endpoints allow unauthenticated local access ([api_server.rs](https://github.com/nashsu/llm_wiki/blob/e08cfce65aad8b76b13546a081c1a8d4422b70c3/src-tauri/src/api_server.rs)). Exposing it publicly would require a separately designed security and deployment boundary.
- The upstream API offers retrieval/chat over the app's project knowledge and cites references, but the repository documentation does not promise that its generated Wiki is restricted to a blog's current published article versions or that references map to the blog's canonical version records. Those invariants would need to be enforced and validated by an integration layer.
- For this repo's public blog deployment, adopting it directly would mean operating a desktop application alongside the web app and handling local API reachability, source synchronization, user isolation, and citation/version mapping. Treat it as a reference implementation or an optional locally hosted knowledge service, not a drop-in Q&A SDK/API.

## Primary sources

- [Chinese README](https://github.com/nashsu/llm_wiki/blob/e08cfce65aad8b76b13546a081c1a8d4422b70c3/README_CN.md)
- [MCP server README](https://github.com/nashsu/llm_wiki/blob/e08cfce65aad8b76b13546a081c1a8d4422b70c3/mcp-server/README.md)
- [Rust API server](https://github.com/nashsu/llm_wiki/blob/e08cfce65aad8b76b13546a081c1a8d4422b70c3/src-tauri/src/api_server.rs)
- [Default/configurable bind address](https://github.com/nashsu/llm_wiki/blob/e08cfce65aad8b76a081c1a8d4422b70c3/src-tauri/src/server_bind.rs)
- [API base URL and port](https://github.com/nashsu/llm_wiki/blob/e08cfce65aad8b76a081c1a8d4422b70c3/src/lib/api-server-constants.ts)
