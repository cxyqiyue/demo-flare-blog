import type { Locale } from "@/lib/i18n";
import { m } from "@/paraglide/messages";
import { EmailLayout } from "./EmailLayout";

interface AdminNotificationEmailProps {
  commentPreview: string;
  commentUrl: string;
  commenterName: string;
  locale: Locale;
  mode: "new" | "pending" | "blocked";
  postTitle: string;
  reason?: string;
}

export const AdminNotificationEmail = ({
  commentPreview,
  commentUrl,
  commenterName,
  locale,
  mode,
  postTitle,
  reason,
}: AdminNotificationEmailProps) => {
  const isPending = mode === "pending";
  const isBlocked = mode === "blocked";
  const accentColor = isBlocked ? "#dc2626" : "#1a1a1a";

  const previewText = isBlocked
    ? m.email_comment_admin_blocked_preview(
        { commenterName, postTitle },
        { locale },
      )
    : isPending
      ? m.email_comment_admin_pending_preview(
          { commenterName, postTitle },
          { locale },
        )
      : m.email_comment_admin_root_preview(
          { commenterName, postTitle },
          { locale },
        );

  const title = isBlocked
    ? m.email_comment_admin_blocked_title({}, { locale })
    : isPending
      ? m.email_comment_admin_pending_title({}, { locale })
      : m.email_comment_admin_root_title({}, { locale });

  const intro = isBlocked
    ? m.email_comment_admin_blocked_intro(
        { commenterName, postTitle },
        { locale },
      )
    : isPending
      ? m.email_comment_admin_pending_intro(
          { commenterName, postTitle },
          { locale },
        )
      : m.email_comment_admin_root_intro(
          { commenterName, postTitle },
          { locale },
        );

  const action = isBlocked
    ? m.email_comment_admin_blocked_action({}, { locale })
    : isPending
      ? m.email_comment_admin_pending_action({}, { locale })
      : m.email_comment_admin_root_action({}, { locale });

  return (
    <EmailLayout locale={locale} previewText={previewText}>
      <h1
        style={{
          fontFamily: '"Playfair Display", "Georgia", serif',
          fontSize: "20px",
          fontWeight: "500",
          color: isBlocked ? "#dc2626" : "#1a1a1a",
          marginBottom: "24px",
          lineHeight: "1.4",
        }}
      >
        {title}
      </h1>
      <p style={{ fontSize: "14px", color: "#444", lineHeight: "1.6" }}>
        {intro}
      </p>
      <blockquote
        style={{
          borderLeft: `2px solid ${isBlocked ? "#fca5a5" : "#e5e5e5"}`,
          margin: "24px 0",
          paddingLeft: "16px",
          fontStyle: "italic",
          color: "#666",
          fontSize: "14px",
          lineHeight: "1.6",
        }}
      >
        {commentPreview}
      </blockquote>
      {isBlocked && reason && (
        <div
          style={{
            margin: "24px 0",
            padding: "12px 16px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: "13px",
            lineHeight: "1.6",
          }}
        >
          {m.email_comment_admin_blocked_reason({ reason }, { locale })}
        </div>
      )}
      <div style={{ marginTop: "32px" }}>
        <a
          href={commentUrl}
          style={{
            backgroundColor: accentColor,
            color: "#ffffff",
            padding: "12px 24px",
            textDecoration: "none",
            fontSize: "13px",
            display: "inline-block",
            letterSpacing: "0.05em",
          }}
        >
          {action}
        </a>
      </div>
    </EmailLayout>
  );
};
