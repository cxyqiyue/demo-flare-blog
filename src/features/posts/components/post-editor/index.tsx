import { useQuery } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import type { JSONContent, Editor as TiptapEditor } from "@tiptap/react";
import { History, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@/components/tiptap-editor";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { markdownToJsonContent } from "@/features/import-export/utils/markdown-parser";
import { jsonContentToMarkdown } from "@/features/import-export/utils/markdown-serializer";
import { extensions } from "@/features/posts/editor/config";
import type { PostRevisionSnapshot } from "@/features/posts/schema/post-revisions.schema";
import { tagsAdminQueryOptions } from "@/features/tags/queries";
import { ContentRenderer } from "@/features/theme/themes/default/components/content/content-renderer";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { AiArticlePanel } from "./ai-article-panel";
import { EditorTableOfContents } from "./editor-table-of-contents";
import { useAutoSave, usePostActions } from "./hooks";
import { PostEditorHeader } from "./post-editor-header";
import { PostEditorHistoryPanel } from "./post-editor-history-panel";
import { PostEditorMetadata } from "./post-editor-metadata";
import { PostEditorStatusBar } from "./post-editor-status-bar";
import type { PostEditorData, PostEditorProps } from "./types";

type EditorMode = "wysiwyg" | "markdown" | "preview";

export function PostEditor({ initialData, onSave }: PostEditorProps) {
  // Initialize post state from initialData (always provided)
  const [post, setPost] = useState<PostEditorData>(() => ({
    title: initialData.title,
    summary: initialData.summary,
    slug: initialData.slug,
    status: initialData.status,
    readTimeInMinutes: initialData.readTimeInMinutes,
    contentJson: initialData.contentJson ?? null,
    publishedAt: initialData.publishedAt,
    pinnedAt: initialData.pinnedAt,
    tagIds: initialData.tagIds,
    skillId: initialData.skillId,
    isSynced: initialData.isSynced,
    hasPublicCache: initialData.hasPublicCache,
    visibility: initialData.visibility,
    password: initialData.password,
    passwordChannel: initialData.passwordChannel,
  }));

  // Sync state when initialData updates (e.g. after background refetch/invalidation)
  const [prevInitialDataId, setPrevInitialDataId] = useState(initialData.id);
  const [prevTagIds, setPrevTagIds] = useState(() =>
    [...initialData.tagIds].sort().join(","),
  );

  const currentTagIdsStr = [...initialData.tagIds].sort().join(",");

  if (prevInitialDataId !== initialData.id || prevTagIds !== currentTagIdsStr) {
    setPrevInitialDataId(initialData.id);
    setPrevTagIds(currentTagIdsStr);
    setPost((prev) => ({
      ...prev,
      tagIds: initialData.tagIds,
      isSynced: initialData.isSynced,
    }));
  }

  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(
    null,
  );
  const [editorRenderKey, setEditorRenderKey] = useState(
    `editor:${initialData.id}`,
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

  const [editorMode, setEditorMode] = useState<EditorMode>("wysiwyg");
  const [markdownSource, setMarkdownSource] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const markdownSourceRef = useRef("");
  const convertedSourceRef = useRef("");
  const markdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all tags for AI context and matching
  const { data: allTags = [] } = useQuery(tagsAdminQueryOptions());

  // Auto-save hook
  const useAutoSaveReturn = useAutoSave({
    post,
    onSave,
  });

  const { saveStatus, lastSaved, setError, markSaved } = useAutoSaveReturn;

  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: () => saveStatus === "SAVING",
    withResolver: true,
  });

  // Post actions hook
  const {
    isGeneratingSlug,
    isCalculatingReadTime,
    isGeneratingSummary,
    handleGenerateSlug,
    handleCalculateReadTime,
    handleGenerateSummary,
    handleProcessData,
    processState,
    isGeneratingTags,
    handleGenerateTags,
    isDirty: isPostDirty,
    contentStats,
  } = usePostActions({
    postId: initialData.id,
    post,
    initialData,
    setPost,
    setError,
    allTags,
  });

  const handleContentChange = useCallback((json: JSONContent) => {
    setPost((prev) => ({ ...prev, contentJson: json }));
  }, []);

  const handlePostChange = useCallback((updates: Partial<PostEditorData>) => {
    setPost((prev) => ({ ...prev, ...updates }));
  }, []);

  const scheduleMarkdownConversion = useCallback(
    (source: string) => {
      if (markdownTimerRef.current) {
        clearTimeout(markdownTimerRef.current);
      }
      setIsConverting(true);
      markdownTimerRef.current = setTimeout(() => {
        void markdownToJsonContent(source)
          .then((json) => {
            if (markdownSourceRef.current !== source) return;
            convertedSourceRef.current = source;
            handleContentChange(json);
          })
          .catch(() => {})
          .finally(() => {
            if (markdownSourceRef.current === source) {
              setIsConverting(false);
            }
          });
      }, 500);
    },
    [handleContentChange],
  );

  const handleMarkdownChange = useCallback(
    (source: string) => {
      markdownSourceRef.current = source;
      setMarkdownSource(source);
      scheduleMarkdownConversion(source);
    },
    [scheduleMarkdownConversion],
  );

  const flushMarkdown = useCallback(async () => {
    if (markdownTimerRef.current) {
      clearTimeout(markdownTimerRef.current);
      markdownTimerRef.current = null;
    }
    const source = markdownSourceRef.current;
    if (source === convertedSourceRef.current) {
      setIsConverting(false);
      return;
    }
    try {
      const json = await markdownToJsonContent(source);
      if (markdownSourceRef.current !== source) return;
      convertedSourceRef.current = source;
      handleContentChange(json);
    } finally {
      setIsConverting(false);
    }
  }, [handleContentChange]);

  const handleModeChange = useCallback(
    async (mode: EditorMode) => {
      if (mode === editorMode) return;

      if (editorMode === "markdown") {
        await flushMarkdown();
        if (mode === "wysiwyg") {
          setEditorRenderKey(`editor:${initialData.id}:${Date.now()}`);
        }
      } else if (mode === "markdown") {
        const source = jsonContentToMarkdown(
          post.contentJson ?? { type: "doc" },
        );
        markdownSourceRef.current = source;
        convertedSourceRef.current = source;
        setMarkdownSource(source);
      }

      setEditorMode(mode);
    },
    [editorMode, flushMarkdown, initialData.id, post.contentJson],
  );

  const handleAiInsertFallback = useCallback(
    (generated: { markdown: string; content: JSONContent }) => {
      if (editorMode === "markdown") {
        const base = markdownSourceRef.current.trimEnd();
        const inserted = base
          ? `${base}\n\n${generated.markdown.trim()}`
          : generated.markdown.trim();
        markdownSourceRef.current = inserted;
        setMarkdownSource(inserted);
        scheduleMarkdownConversion(inserted);
        return;
      }
      handleContentChange(generated.content);
      setEditorRenderKey(`editor:${initialData.id}:${Date.now()}`);
      setEditorMode("wysiwyg");
    },
    [
      editorMode,
      handleContentChange,
      initialData.id,
      scheduleMarkdownConversion,
    ],
  );

  useEffect(() => {
    return () => {
      if (markdownTimerRef.current) {
        clearTimeout(markdownTimerRef.current);
      }
    };
  }, []);

  const resetMarkdownSource = useCallback(
    (contentJson: PostEditorData["contentJson"]) => {
      if (markdownTimerRef.current) {
        clearTimeout(markdownTimerRef.current);
        markdownTimerRef.current = null;
      }
      const source = jsonContentToMarkdown(contentJson ?? { type: "doc" });
      markdownSourceRef.current = source;
      convertedSourceRef.current = source;
      setMarkdownSource(source);
      setIsConverting(false);
    },
    [],
  );

  const handleRestoreApplied = useCallback(
    ({
      snapshot,
    }: {
      snapshot: {
        title: string;
        summary: string | null;
        slug: string;
        status: PostEditorData["status"];
        publishedAt: string | null;
        readTimeInMinutes: number;
        contentJson: PostEditorData["contentJson"];
        tagIds: Array<number>;
      };
    }) => {
      const hasPublicCache = post.hasPublicCache;
      const restoredPost: PostEditorData = {
        title: snapshot.title,
        summary: snapshot.summary ?? "",
        slug: snapshot.slug,
        status: snapshot.status,
        readTimeInMinutes: snapshot.readTimeInMinutes,
        contentJson: snapshot.contentJson,
        publishedAt: snapshot.publishedAt
          ? new Date(snapshot.publishedAt)
          : null,
        pinnedAt: post.pinnedAt,
        tagIds: snapshot.tagIds,
        skillId: post.skillId,
        isSynced: snapshot.status === "draft" ? !hasPublicCache : false,
        hasPublicCache,
        visibility: post.visibility,
        password: post.password,
        passwordChannel: post.passwordChannel,
      };

      setPost(restoredPost);
      if (editorMode === "markdown") {
        resetMarkdownSource(restoredPost.contentJson);
      }
      setEditorRenderKey(`editor:${initialData.id}:${Date.now()}`);
      markSaved(restoredPost);
    },
    [
      editorMode,
      initialData.id,
      markSaved,
      post.hasPublicCache,
      resetMarkdownSource,
    ],
  );

  const currentSnapshot = useMemo<PostRevisionSnapshot>(
    () => ({
      title: post.title,
      summary: post.summary.trim() || null,
      slug: post.slug,
      status: post.status,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      readTimeInMinutes: post.readTimeInMinutes,
      contentJson: post.contentJson,
      tagIds: [...new Set(post.tagIds)].sort((a, b) => a - b),
    }),
    [
      post.contentJson,
      post.publishedAt,
      post.readTimeInMinutes,
      post.slug,
      post.status,
      post.summary,
      post.tagIds,
      post.title,
    ],
  );

  return (
    <div className="fixed inset-0 z-80 flex flex-col bg-background overflow-hidden">
      <ConfirmationModal
        isOpen={status === "blocked"}
        onClose={() => reset?.()}
        onConfirm={() => proceed?.()}
        title={m.editor_leave_title()}
        message={m.editor_leave_message()}
        confirmLabel={m.editor_leave_confirm()}
      />

      <PostEditorHeader
        post={post}
        saveStatus={saveStatus}
        processState={processState}
        isPostDirty={isPostDirty}
        onPreview={() => {
          if (post.slug) window.open(`/post/${encodeURIComponent(post.slug)}`, "_blank");
        }}
        onProcess={handleProcessData}
        onOpenAi={() => setIsAiOpen(true)}
      />

      <AiArticlePanel
        editor={editorMode === "wysiwyg" ? editorInstance : null}
        open={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        onApplyTitle={(title) => handlePostChange({ title })}
        onInsertFallback={handleAiInsertFallback}
      />

      <PostEditorHistoryPanel
        postId={initialData.id}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        currentSnapshot={currentSnapshot}
        allTags={allTags}
        onRestoreApplied={handleRestoreApplied}
      />

      {/* Main Content Area (Only this scrolls) */}
      <div
        id="post-editor-scroll-container"
        className="flex-1 overflow-y-auto custom-scrollbar relative scroll-smooth animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-both delay-100"
      >
        <div className="w-full mx-auto py-20 px-6 md:px-12 grid grid-cols-1 xl:grid-cols-[1fr_240px] 2xl:grid-cols-[1fr_56rem_1fr] gap-12 items-start">
          <div className="hidden 2xl:block" />
          <div className="min-w-0 w-full max-w-4xl mx-auto 2xl:mx-0">
            <div className="mb-6 flex justify-end xl:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHistoryOpen(true)}
                className="rounded-none text-[10px] font-mono uppercase tracking-[0.18em]"
              >
                <History size={14} />
                <span className="ml-2">{m.editor_history_open()}</span>
              </Button>
            </div>

            <PostEditorMetadata
              post={post}
              isGeneratingSlug={isGeneratingSlug}
              isCalculatingReadTime={isCalculatingReadTime}
              isGeneratingSummary={isGeneratingSummary}
              isGeneratingTags={isGeneratingTags}
              onPostChange={handlePostChange}
              onGenerateSlug={handleGenerateSlug}
              onCalculateReadTime={handleCalculateReadTime}
              onGenerateSummary={handleGenerateSummary}
              onGenerateTags={handleGenerateTags}
            />

            {/* Mode switcher */}
            <div className="mb-4 flex items-center gap-1 border-b border-border/20 pb-4">
              {(
                [
                  { key: "wysiwyg", label: m.editor_mode_wysiwyg() },
                  { key: "markdown", label: m.editor_mode_markdown() },
                  { key: "preview", label: m.editor_mode_preview() },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void handleModeChange(key)}
                  className={cn(
                    "px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
                    editorMode === key
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
              {isConverting && (
                <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" />
                  {m.editor_markdown_converting()}
                </span>
              )}
            </div>

            {/* Editor Area */}
            <div className="min-h-[60vh] pb-32">
              {editorMode === "wysiwyg" && (
                <Editor
                  key={editorRenderKey}
                  extensions={extensions}
                  content={post.contentJson ?? ""}
                  onChange={handleContentChange}
                  onCreated={setEditorInstance}
                />
              )}

              {editorMode === "markdown" && (
                <textarea
                  value={markdownSource}
                  onChange={(e) => handleMarkdownChange(e.target.value)}
                  placeholder={m.editor_markdown_placeholder()}
                  spellCheck={false}
                  className="w-full min-h-[60vh] resize-y whitespace-pre-wrap border border-border/30 bg-muted/5 px-4 py-4 font-mono text-sm leading-6 text-foreground/90 transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10 focus-visible:outline-none"
                />
              )}

              {editorMode === "preview" && (
                <div className="min-h-[60vh] border border-border/20 bg-muted/5 px-6 py-6">
                  <ContentRenderer content={post.contentJson} />
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="hidden xl:block sticky top-20 h-full max-h-[calc(100vh-10rem)] w-60">
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="flex w-full items-center justify-between border border-border/30 px-4 py-3 text-left transition-colors hover:border-foreground/20 hover:bg-muted/30"
              >
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/55">
                    {m.editor_history_eyebrow()}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {m.editor_history_title()}
                  </p>
                </div>
                {saveStatus === "SAVING" ? (
                  <Loader2
                    size={14}
                    className="animate-spin text-muted-foreground"
                  />
                ) : (
                  <History size={16} className="text-muted-foreground" />
                )}
              </button>

              {editorMode === "wysiwyg" && editorInstance && (
                <EditorTableOfContents editor={editorInstance} />
              )}
            </div>
          </aside>
        </div>
      </div>

      <PostEditorStatusBar
        chars={contentStats.chars}
        words={contentStats.words}
        saveStatus={saveStatus}
        lastSaved={lastSaved}
      />
    </div>
  );
}
