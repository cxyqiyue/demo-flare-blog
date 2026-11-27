import { useCallback, useEffect, useRef, useState } from "react";
import {
  arePostEditorSnapshotsEqual,
  toPostEditorSnapshot,
} from "../post-editor-save-state";
import type { PostEditorData, SaveStatus } from "../types";

interface UseAutoSaveOptions {
  post: PostEditorData;
  onSave: (data: PostEditorData) => Promise<void>;
  debounceMs?: number;
}

interface UseAutoSaveReturn {
  saveStatus: SaveStatus;
  lastSaved: Date | null;
  error: string | null;
  setError: (error: string | null) => void;
  setSaveStatus: (status: SaveStatus) => void;
  isDirty: boolean;
  markSaved: (post: PostEditorData) => void;
  flushSave: () => Promise<PostEditorData>;
}

export function useAutoSave({
  post,
  onSave,
  debounceMs = 1500,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("SYNCED");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(false);
  const latestPostRef = useRef(post);
  const onSaveRef = useRef(onSave);
  const lastSavedSnapshot = useRef(toPostEditorSnapshot(post));
  const pendingSave = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  latestPostRef.current = post;
  onSaveRef.current = onSave;

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const markSaved = useCallback((savedPost: PostEditorData) => {
    cancelTimer();
    lastSavedSnapshot.current = toPostEditorSnapshot(savedPost);
    setError(null);
    setSaveStatus("SYNCED");
    setLastSaved(new Date());
  }, [cancelTimer]);

  // Publishing shares the same queue as auto-save. Wait for any older request,
  // then save all edits that arrived while it was in flight before resolving.
  const flushSave = useCallback(async (): Promise<PostEditorData> => {
    cancelTimer();
    try {
      while (
        pendingSave.current ||
        !arePostEditorSnapshotsEqual(
          lastSavedSnapshot.current,
          toPostEditorSnapshot(latestPostRef.current),
        )
      ) {
        if (isMounted.current) {
          setSaveStatus("SAVING");
          setError(null);
        }
        if (!pendingSave.current) {
          const savingPost = latestPostRef.current;
          pendingSave.current = Promise.resolve()
            .then(() => onSaveRef.current(savingPost))
            .then(() => {
              lastSavedSnapshot.current = toPostEditorSnapshot(savingPost);
              if (isMounted.current) setLastSaved(new Date());
            });
        }
        const request = pendingSave.current;
        try {
          await request;
        } finally {
          if (pendingSave.current === request) pendingSave.current = null;
        }
      }
      if (isMounted.current) setSaveStatus("SYNCED");
      return latestPostRef.current;
    } catch (err) {
      if (isMounted.current) {
        setSaveStatus("ERROR");
        setError("AUTO_SAVE_FAILED");
      }
      throw err;
    }
  }, [cancelTimer]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      cancelTimer();
    };
  }, [cancelTimer]);

  useEffect(() => {
    if (arePostEditorSnapshotsEqual(lastSavedSnapshot.current, toPostEditorSnapshot(post))) {
      if (!pendingSave.current) setSaveStatus("SYNCED");
      return;
    }
    setSaveStatus("SAVING");
    cancelTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushSave().catch((err: unknown) => {
        console.error("Auto-save failed:", err);
      });
    }, debounceMs);
    return cancelTimer;
  }, [post, debounceMs, cancelTimer, flushSave]);

  return {
    saveStatus,
    lastSaved,
    error,
    setError,
    setSaveStatus,
    isDirty: !arePostEditorSnapshotsEqual(lastSavedSnapshot.current, toPostEditorSnapshot(post)),
    markSaved,
    flushSave,
  };
}
