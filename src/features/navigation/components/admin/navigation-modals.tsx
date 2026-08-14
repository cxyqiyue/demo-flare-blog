import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2, X } from "lucide-react";
import type { ComponentProps } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { NavigationPublicData } from "@/features/navigation/navigation.schema";
import {
  createBookmarkInputSchema,
  createFolderInputSchema,
  createSearchEngineInputSchema,
} from "@/features/navigation/navigation.schema";
import type {
  CreateBookmarkFormValues,
  CreateFolderFormValues,
  CreateSearchEngineFormValues,
} from "@/features/navigation/navigation.schema";
import { m } from "@/paraglide/messages";

// ==================== Modal Shell ====================

interface ModalShellProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const ModalShellInternal = ({
  title,
  description,
  isOpen,
  onClose,
  children,
}: ModalShellProps) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative bg-background border border-border/30 p-6 md:p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 shadow-lg">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
        <h3 className="text-xl font-serif font-medium mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mb-6">{description}</p>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
};

export function ModalShell(props: ModalShellProps) {
  return (
    <ClientOnly>
      <ModalShellInternal {...props} />
    </ClientOnly>
  );
}

function ModalField({
  label,
  placeholder,
  error,
  inputProps,
}: {
  label: string;
  placeholder?: string;
  error?: string;
  inputProps: ComponentProps<typeof Input>;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <Input
        {...inputProps}
        placeholder={placeholder}
        className="bg-transparent border-0 border-b border-border/50 text-base px-0 rounded-none focus-visible:ring-0 focus-visible:border-foreground transition-all shadow-none h-auto py-1.5 placeholder:text-muted-foreground/30"
      />
      {error && <p className="text-xs text-red-500">! {error}</p>}
    </div>
  );
}

function ModalActions({
  onCancel,
  isSubmitting,
  submitLabel,
}: {
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-4">
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        className="font-mono text-xs uppercase tracking-widest rounded-none"
      >
        {m.friend_links_batch_cancel()}
      </Button>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-xs uppercase tracking-widest"
      >
        {isSubmitting ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          submitLabel
        )}
      </Button>
    </div>
  );
}

// ==================== Engine Form Modal ====================

interface EngineFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSearchEngineFormValues) => Promise<boolean>;
  isSubmitting?: boolean;
  initialData?: NavigationPublicData["engines"][number];
  /** 是否已有其它引擎（决定默认引擎选项） */
  hasExisting: boolean;
}

const EngineFormModalInternal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  initialData,
  hasExisting,
}: EngineFormModalProps) => {
  const form = useForm<CreateSearchEngineFormValues>({
    resolver: standardSchemaResolver(createSearchEngineInputSchema(m)),
    defaultValues: {
      name: initialData?.name ?? "",
      urlTemplate: initialData?.urlTemplate ?? "",
      domain: initialData?.domain ?? "",
      iconUrl: initialData?.iconUrl ?? "",
      sortOrder: initialData?.sortOrder ?? 0,
      enabled: initialData?.enabled ?? true,
      isDefault: initialData?.isDefault ?? false,
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = async (data: CreateSearchEngineFormValues) => {
    const success = await onSubmit(data);
    if (success) {
      reset();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShellInternal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        initialData
          ? m.navigation_admin_engine_modal_edit()
          : m.navigation_admin_engine_modal_add()
      }
    >
      <form onSubmit={handleSubmit(handleConfirm)} className="space-y-4">
        <ModalField
          label={m.navigation_field_name()}
          error={errors.name?.message}
          inputProps={register("name")}
        />
        <ModalField
          label={m.navigation_field_url()}
          placeholder={m.navigation_field_url_ph({ query: "{query}" })}
          error={errors.urlTemplate?.message}
          inputProps={register("urlTemplate")}
        />
        <ModalField
          label={m.navigation_field_domain()}
          placeholder={m.navigation_field_domain_ph()}
          error={errors.domain?.message}
          inputProps={register("domain")}
        />
        <ModalField
          label={m.navigation_field_icon()}
          error={errors.iconUrl?.message}
          inputProps={{
            ...register("iconUrl"),
            placeholder: "https://example.com/icon.png",
          }}
        />
        <ModalField
          label="Sort"
          error={errors.sortOrder?.message}
          inputProps={{ ...register("sortOrder"), type: "number" }}
        />
        <div className="flex items-center gap-8 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox {...register("enabled")} />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {m.navigation_field_enabled()}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              {...register("isDefault")}
              disabled={!hasExisting && !initialData?.isDefault}
            />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {m.navigation_admin_engine_default()}
            </span>
          </label>
        </div>
        <ModalActions
          onCancel={handleClose}
          isSubmitting={isSubmitting}
          submitLabel={m.navigation_admin_edit()}
        />
      </form>
    </ModalShellInternal>
  );
};

export function EngineFormModal(props: EngineFormModalProps) {
  return (
    <ClientOnly>
      <EngineFormModalInternal {...props} />
    </ClientOnly>
  );
}

// ==================== Folder Form Modal ====================

interface FolderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateFolderFormValues) => Promise<boolean>;
  isSubmitting?: boolean;
  initialData?: NavigationPublicData["folders"][number];
}

const FolderFormModalInternal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  initialData,
}: FolderFormModalProps) => {
  const form = useForm<CreateFolderFormValues>({
    resolver: standardSchemaResolver(createFolderInputSchema(m)),
    defaultValues: {
      name: initialData?.name ?? "",
      sortOrder: initialData?.sortOrder ?? 0,
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = async (data: CreateFolderFormValues) => {
    const success = await onSubmit(data);
    if (success) {
      reset();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShellInternal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        initialData
          ? m.navigation_admin_folder_modal_edit()
          : m.navigation_admin_folder_modal_add()
      }
    >
      <form onSubmit={handleSubmit(handleConfirm)} className="space-y-4">
        <ModalField
          label={m.navigation_field_folder_name()}
          error={errors.name?.message}
          inputProps={register("name")}
        />
        <ModalActions
          onCancel={handleClose}
          isSubmitting={isSubmitting}
          submitLabel={m.navigation_admin_edit()}
        />
      </form>
    </ModalShellInternal>
  );
};

export function FolderFormModal(props: FolderFormModalProps) {
  return (
    <ClientOnly>
      <FolderFormModalInternal {...props} />
    </ClientOnly>
  );
}

// ==================== Bookmark Form Modal ====================

interface BookmarkFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBookmarkFormValues) => Promise<boolean>;
  isSubmitting?: boolean;
  initialData?: NavigationPublicData["bookmarks"][number];
  folders: NavigationPublicData["folders"];
  defaultFolderId?: number | null;
}

const BookmarkFormModalInternal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  initialData,
  folders,
  defaultFolderId,
}: BookmarkFormModalProps) => {
  const form = useForm<CreateBookmarkFormValues>({
    resolver: standardSchemaResolver(createBookmarkInputSchema(m)),
    defaultValues: {
      name: initialData?.name ?? "",
      url: initialData?.url ?? "",
      folderId:
        initialData?.folderId ?? (defaultFolderId !== undefined ? defaultFolderId : null),
      sortOrder: initialData?.sortOrder ?? 0,
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = async (data: CreateBookmarkFormValues) => {
    const success = await onSubmit(data);
    if (success) {
      reset();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShellInternal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        initialData
          ? m.navigation_admin_bookmark_modal_edit()
          : m.navigation_admin_bookmark_modal_add()
      }
    >
      <form onSubmit={handleSubmit(handleConfirm)} className="space-y-4">
        <ModalField
          label={m.navigation_field_bookmark_name()}
          error={errors.name?.message}
          inputProps={register("name")}
        />
        <ModalField
          label={m.navigation_field_bookmark_url()}
          error={errors.url?.message}
          inputProps={register("url")}
        />
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {m.navigation_field_folder()}
          </label>
          <select
            {...register("folderId", { valueAsNumber: true })}
            className="w-full bg-background border border-border/50 px-3 py-2 text-sm focus:border-foreground/60 focus:outline-none transition-colors"
          >
            <option value={""}>{m.navigation_field_none()}</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          {errors.folderId?.message && (
            <p className="text-xs text-red-500">! {errors.folderId.message}</p>
          )}
        </div>
        <ModalActions
          onCancel={handleClose}
          isSubmitting={isSubmitting}
          submitLabel={m.navigation_admin_edit()}
        />
      </form>
    </ModalShellInternal>
  );
};

export function BookmarkFormModal(props: BookmarkFormModalProps) {
  return (
    <ClientOnly>
      <BookmarkFormModalInternal {...props} />
    </ClientOnly>
  );
}
