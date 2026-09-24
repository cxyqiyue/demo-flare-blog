import type { Locale } from "@/lib/i18n";
import { m } from "@/paraglide/messages";
import { EmailLayout } from "./EmailLayout";

interface AuthEmailProps {
  locale: Locale;
  type: "verification" | "reset-password" | "otp";
  url?: string;
  code?: string;
  purpose?: "login" | "register";
}

export const AuthEmail = ({
  locale,
  type,
  url,
  code,
  purpose,
}: AuthEmailProps) => {
  const isVerification = type === "verification";
  const title = isVerification
    ? m.email_auth_verification_subject({}, { locale })
    : m.email_auth_reset_subject({}, { locale });

  if (type === "otp") {
    const desc =
      purpose === "login"
        ? m.email_otp_login_desc({}, { locale })
        : m.email_otp_register_desc({}, { locale });

    return (
      <EmailLayout locale={locale} previewText={m.email_otp_subject({}, { locale })}>
        <h1
          style={{
            fontFamily: '"Playfair Display", "Georgia", serif',
            fontSize: "20px",
            fontWeight: "500",
            color: "#1a1a1a",
            marginBottom: "24px",
            lineHeight: "1.4",
          }}
        >
          {m.email_otp_subject({}, { locale })}
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#444",
            lineHeight: "1.6",
            marginBottom: "24px",
          }}
        >
          {desc}
        </p>
        <div
          style={{
            backgroundColor: "#f5f5f5",
            padding: "24px",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          <span
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "40px",
              fontWeight: "700",
              color: "#1a1a1a",
              letterSpacing: "0.12em",
            }}
          >
            {code}
          </span>
        </div>
        <p style={{ fontSize: "12px", color: "#999", lineHeight: "1.6" }}>
          {m.email_otp_expiry_notice({}, { locale })}
        </p>
        <p
          style={{
            fontSize: "12px",
            color: "#999",
            marginTop: "24px",
            fontStyle: "italic",
          }}
        >
          {m.email_auth_expiry_notice({}, { locale })}
        </p>
      </EmailLayout>
    );
  }

  const description = isVerification
    ? m.email_auth_verification_desc({}, { locale })
    : m.email_auth_reset_desc({}, { locale });
  const buttonText = isVerification
    ? m.email_auth_verification_action({}, { locale })
    : m.email_auth_reset_action({}, { locale });

  return (
    <EmailLayout locale={locale} previewText={title}>
      <h1
        style={{
          fontFamily: '"Playfair Display", "Georgia", serif',
          fontSize: "20px",
          fontWeight: "500",
          color: "#1a1a1a",
          marginBottom: "24px",
          lineHeight: "1.4",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: "14px",
          color: "#444",
          lineHeight: "1.6",
          marginBottom: "32px",
        }}
      >
        {description}
      </p>
      <div style={{ marginBottom: "32px" }}>
        <a
          href={url}
          style={{
            backgroundColor: "#1a1a1a",
            color: "#ffffff",
            padding: "12px 24px",
            textDecoration: "none",
            fontSize: "13px",
            display: "inline-block",
            letterSpacing: "0.05em",
          }}
        >
          {buttonText}
        </a>
      </div>
      <p style={{ fontSize: "12px", color: "#999", lineHeight: "1.6" }}>
        {m.email_auth_link_fallback({}, { locale })}
        <br />
        <a href={url} style={{ color: "#666", wordBreak: "break-all" }}>
          {url}
        </a>
      </p>
      <p
        style={{
          fontSize: "12px",
          color: "#999",
          marginTop: "24px",
          fontStyle: "italic",
        }}
      >
        {m.email_auth_expiry_notice({}, { locale })}
      </p>
    </EmailLayout>
  );
};