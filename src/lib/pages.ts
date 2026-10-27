import { invoke } from "@tauri-apps/api/core";
export type BlockKind =
  | "text"
  | "heading"
  | "subheading"
  | "bullet"
  | "checklist"
  | "quote"
  | "divider";
export interface Block {
  id: string;
  kind: BlockKind;
  text: string;
  checked: boolean;
}
export interface PageInput {
  title: string;
  blocks: Block[];
}
export interface NotePage extends PageInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export function newBlock(kind: BlockKind = "text"): Block {
  return { id: crypto.randomUUID(), kind, text: "", checked: false };
}
export const pageInput = (page: PageInput): PageInput => ({
  title: page.title.trim() || "Untitled",
  blocks: page.blocks,
});
export const pagesApi = {
  list: () => invoke<NotePage[]>("list_pages"),
  create: (input: PageInput) => invoke<NotePage>("create_page", { input }),
  update: (id: string, input: PageInput) =>
    invoke<NotePage>("update_page", { id, input }),
  remove: (id: string) => invoke<void>("delete_page", { id }),
};
