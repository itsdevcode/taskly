import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Dialog } from "../../components/Dialog";
import "./pages.css";
import { desktop, errorMessage } from "../../lib/api";
import {
  newBlock,
  pageInput,
  pagesApi,
  type Block,
  type BlockKind,
  type NotePage,
} from "../../lib/pages";

const kinds: Record<BlockKind, string> = {
  text: "Text",
  heading: "Heading",
  subheading: "Subheading",
  bullet: "Bullet list",
  checklist: "Checklist",
  quote: "Quote",
  divider: "Divider",
};
function BlockText({
  block,
  index,
  onChange,
  onEnter,
}: {
  block: Block;
  index: number;
  onChange: (text: string) => void;
  onEnter: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [block.text, block.kind]);
  return (
    <textarea
      ref={ref}
      className={`block-text ${block.kind} ${block.checked ? "checked" : ""}`}
      aria-label={`${kinds[block.kind]} block ${index + 1}`}
      placeholder={
        block.kind === "heading"
          ? "Heading"
          : block.kind === "subheading"
            ? "Subheading"
            : block.kind === "quote"
              ? "Something worth remembering…"
              : "Write something…"
      }
      rows={1}
      value={block.text}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onEnter();
        }
      }}
    />
  );
}
export function PagesWorkspace({
  active,
  onCountChange,
  onNeedsAttention,
}: {
  active: boolean;
  onCountChange: (count: number) => void;
  onNeedsAttention: () => void;
}) {
  const [pages, setPages] = useState<NotePage[]>([]);
  const [draft, setDraft] = useState<NotePage | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const current = useRef<NotePage | null>(null);
  const saved = useRef("");
  const flight = useRef<Promise<void> | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const reveal = useRef(onNeedsAttention);
  reveal.current = onNeedsAttention;
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!desktop) throw new Error("Open the desktop app to use local pages.");
      setPages(await pagesApi.list());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => onCountChange(pages.length), [pages.length, onCountChange]);
  function open(page: NotePage | null) {
    current.current = page;
    saved.current = page ? JSON.stringify(pageInput(page)) : "";
    setDraft(page);
  }
  function change(page: NotePage) {
    current.current = page;
    setDraft(page);
  }
  // One writer at a time. Edits made during a save are sent in the next iteration.
  const persist = useCallback(() => {
    if (flight.current) return flight.current;
    if (!current.current) return Promise.resolve();
    const operation = async () => {
      setSaving(true);
      try {
        while (current.current) {
          const snapshot = current.current;
          const input = pageInput(snapshot);
          const encoded = JSON.stringify(input);
          if (encoded === saved.current) break;
          const result = await pagesApi.update(snapshot.id, input);
          saved.current = encoded;
          setPages((previous) =>
            previous.map((page) => (page.id === result.id ? result : page)),
          );
        }
        setError("");
      } catch (err) {
        setError(errorMessage(err));
        throw err;
      } finally {
        setSaving(false);
      }
    };
    flight.current = operation().finally(() => {
      flight.current = null;
    });
    return flight.current;
  }, []);
  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => void persist().catch(() => {}), 600);
    return () => clearTimeout(timer);
  }, [draft, persist]);
  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const subscription = getCurrentWindow().onCloseRequested(async (event) => {
      setSwitching(true);
      try {
        await persist();
      } catch {
        event.preventDefault();
        setSwitching(false);
        reveal.current();
      }
    });
    void subscription
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch((err) => setError(errorMessage(err)));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [persist]);
  useEffect(() => {
    function saveOnBlur() {
      void persist().catch(() => {});
    }
    window.addEventListener("blur", saveOnBlur);
    return () => window.removeEventListener("blur", saveOnBlur);
  }, [persist]);
  async function navigate(page: NotePage | null) {
    setSwitching(true);
    try {
      await persist();
      open(page);
    } catch {
      /* Keep unsaved text in the editor. */
    } finally {
      setSwitching(false);
    }
  }
  async function create() {
    if (switching || !desktop) return;
    setSwitching(true);
    try {
      await persist();
      const page = await pagesApi.create({
        title: "Untitled",
        blocks: [newBlock()],
      });
      setPages((previous) => [page, ...previous]);
      open(page);
      setTimeout(
        () =>
          container.current
            ?.querySelector<HTMLInputElement>(".page-title")
            ?.focus(),
        0,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSwitching(false);
    }
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        !active ||
        deleting ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void persist().catch(() => {});
      }
      if (key === "n") {
        event.preventDefault();
        void create();
      }
      if (key === "f") {
        event.preventDefault();
        search.current?.focus();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function remove() {
    if (!current.current) return;
    setSwitching(true);
    try {
      await persist();
      const id = current.current.id;
      await pagesApi.remove(id);
      setPages((previous) => previous.filter((p) => p.id !== id));
      open(null);
      setDeleting(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSwitching(false);
    }
  }
  function updateBlock(id: string, patch: Partial<Block>) {
    if (!current.current) return;
    change({
      ...current.current,
      blocks: current.current.blocks.map((block) =>
        block.id === id ? { ...block, ...patch } : block,
      ),
    });
  }
  function addBlock(kind: BlockKind = "text", after?: number) {
    if (!current.current) return;
    const block = newBlock(kind);
    const blocks = [...current.current.blocks];
    blocks.splice(after === undefined ? blocks.length : after + 1, 0, block);
    change({ ...current.current, blocks });
    setTimeout(
      () =>
        container.current
          ?.querySelector<HTMLTextAreaElement>(
            `[data-block-id="${block.id}"] textarea`,
          )
          ?.focus(),
      0,
    );
  }
  function moveBlock(index: number, offset: number) {
    if (!current.current) return;
    const blocks = [...current.current.blocks];
    [blocks[index], blocks[index + offset]] = [
      blocks[index + offset],
      blocks[index],
    ];
    change({ ...current.current, blocks });
  }
  const dirty = !!draft && JSON.stringify(pageInput(draft)) !== saved.current;
  const visible = pages
    .filter((page) =>
      `${page.id === draft?.id ? draft.title : page.title} ${page.id === draft?.id ? draft.blocks.map((b) => b.text).join(" ") : page.blocks.map((b) => b.text).join(" ")}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <section
      className="pages-workspace"
      hidden={!active}
      ref={container}
      aria-label="Pages workspace"
    >
      <div className="pages-heading">
        <div>
          <div className="eyebrow">ROOM FOR YOUR IDEAS</div>
          <h1>
            Pages<span className="heading-count">{pages.length}</span>
          </h1>
          <p className="subtitle">Notes, plans, and everything in between.</p>
        </div>
        <button
          className="primary"
          onClick={() => void create()}
          disabled={!desktop || loading || switching}
        >
          <Plus size={17} />
          New page
        </button>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            onClick={() => void (draft ? persist() : load()).catch(() => {})}
          >
            Retry
          </button>
        </div>
      )}
      <div className="pages-layout">
        <aside className="page-list">
          <div className="search-field">
            <Search size={15} />
            <input
              ref={search}
              aria-label="Search pages"
              placeholder="Find a page…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {loading ? (
            <p className="pages-hint">Opening your pages…</p>
          ) : visible.length ? (
            visible.map((page) => (
              <button
                key={page.id}
                className={`page-link ${draft?.id === page.id ? "selected" : ""}`}
                disabled={switching}
                onClick={() => {
                  if (page.id !== draft?.id) void navigate(page);
                }}
              >
                <FileText size={16} />
                <span>
                  {page.id === draft?.id
                    ? draft.title || "Untitled"
                    : page.title}
                  <small>
                    {new Date(page.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p className="pages-hint">
              {query ? "No matching pages." : "Your pages will appear here."}
            </p>
          )}
        </aside>
        {draft ? (
          <article className="page-editor">
            <header className="page-editor-toolbar">
              <span className="save-state" role="status">
                {saving ? (
                  <>
                    <LoaderCircle size={13} className="spinner" />
                    Saving…
                  </>
                ) : error ? (
                  "Changes not saved"
                ) : dirty ? (
                  "Unsaved changes"
                ) : (
                  <>
                    <Check size={13} />
                    Saved on this device
                  </>
                )}
              </span>
              <button
                className="secondary"
                disabled={switching || saving || !dirty}
                onClick={() => void persist().catch(() => {})}
              >
                Save
              </button>
              <button
                className="icon-button delete"
                aria-label="Delete page"
                disabled={switching}
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={16} />
              </button>
            </header>
            <fieldset disabled={switching} className="page-fields">
              <div className="page-document-icon">
                <FileText size={37} strokeWidth={1.4} />
              </div>
              <input
                className="page-title"
                aria-label="Page title"
                placeholder="Untitled"
                maxLength={150}
                value={draft.title}
                onChange={(e) => change({ ...draft, title: e.target.value })}
              />
              <p className="page-editor-hint">
                Make it yours. Enter adds a block · Shift + Enter adds a line.
              </p>
              <div className="page-blocks">
                {draft.blocks.map((block, index) => (
                  <div
                    key={block.id}
                    data-block-id={block.id}
                    className={`page-block ${block.kind}`}
                  >
                    <div className="block-content">
                      {block.kind === "bullet" && (
                        <span className="bullet-marker">•</span>
                      )}
                      {block.kind === "checklist" && (
                        <input
                          type="checkbox"
                          aria-label={`Check item ${index + 1}`}
                          checked={block.checked}
                          onChange={(e) =>
                            updateBlock(block.id, { checked: e.target.checked })
                          }
                        />
                      )}
                      {block.kind === "divider" ? (
                        <hr />
                      ) : (
                        <BlockText
                          block={block}
                          index={index}
                          onChange={(text) => updateBlock(block.id, { text })}
                          onEnter={() =>
                            addBlock(
                              block.kind === "bullet" ||
                                block.kind === "checklist"
                                ? block.kind
                                : "text",
                              index,
                            )
                          }
                        />
                      )}
                    </div>
                    <div className="block-controls">
                      <label className="block-type">
                        <select
                          aria-label={`Block ${index + 1} type`}
                          value={block.kind}
                          onChange={(e) =>
                            updateBlock(block.id, {
                              kind: e.target.value as BlockKind,
                            })
                          }
                        >
                          {Object.entries(kinds).map(([kind, label]) => (
                            <option key={kind} value={kind}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={11} />
                      </label>
                      <button
                        className="icon-button"
                        disabled={index === 0}
                        aria-label={`Move block ${index + 1} up`}
                        onClick={() => moveBlock(index, -1)}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        className="icon-button"
                        disabled={index === draft.blocks.length - 1}
                        aria-label={`Move block ${index + 1} down`}
                        onClick={() => moveBlock(index, 1)}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        className="icon-button delete"
                        aria-label={`Remove block ${index + 1}`}
                        onClick={() =>
                          change({
                            ...draft,
                            blocks: draft.blocks.filter(
                              (b) => b.id !== block.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="add-block" onClick={() => addBlock()}>
                <Plus size={16} />
                Add a block
              </button>
            </fieldset>
          </article>
        ) : (
          <div className="pages-empty">
            <FileText size={42} strokeWidth={1} />
            <h2>A home for your next idea.</h2>
            <p>
              Open a page or start a new one.
              <br />
              Everything stays on this device.
            </p>
            <button
              className="secondary"
              onClick={() => void create()}
              disabled={!desktop || loading || switching}
            >
              <Plus size={15} />
              Create a page
            </button>
          </div>
        )}
      </div>
      {deleting && draft && (
        <Dialog
          title="Delete this page?"
          busy={switching}
          onClose={() => setDeleting(false)}
        >
          <div className="form-body">
            <p className="delete-copy">
              “{draft.title || "Untitled"}” and all its blocks will be
              permanently deleted. This can’t be undone.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="dialog-footer">
            <button
              className="secondary"
              disabled={switching}
              onClick={() => setDeleting(false)}
            >
              Keep page
            </button>
            <button
              className="danger"
              disabled={switching}
              onClick={() => void remove()}
            >
              {switching ? "Deleting…" : "Delete page"}
            </button>
          </footer>
        </Dialog>
      )}
    </section>
  );
}
