import { Info } from "lucide-react";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

export function EmailDocPanel() {
  if (isFuwari) {
    return (
      <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-(--fuwari-btn-regular-bg) p-2.5 shrink-0">
            <Info className="h-5 w-5 fuwari-text-50" />
          </div>
          <div className="space-y-4 min-w-0">
            <h4 className="text-base font-bold fuwari-text-90">
              {m.settings_email_doc_title()}
            </h4>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 xl:grid-cols-2">
              <EmailDocTip index="1">{m.settings_email_doc_tip1()}</EmailDocTip>
              <EmailDocTip index="2">{m.settings_email_doc_tip2()}</EmailDocTip>
              <EmailDocTip index="3">{m.settings_email_doc_tip3()}</EmailDocTip>
              <EmailDocTip index="4">{m.settings_email_doc_tip4()}</EmailDocTip>
              <EmailDocTip index="5">{m.settings_email_doc_tip5()}</EmailDocTip>
              <EmailDocTip index="6">{m.settings_email_doc_tip6()}</EmailDocTip>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden border border-border/30 bg-muted/5 p-8 transition-all hover:bg-muted/10">
      <div className="relative z-10 flex items-start gap-6">
        <div className="rounded-full bg-foreground/5 p-3">
          <Info className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground">
            {m.settings_email_doc_title()}
          </h4>
          <div className="grid grid-cols-1 gap-x-12 gap-y-3 xl:grid-cols-2">
            <EmailDocTip index="1">{m.settings_email_doc_tip1()}</EmailDocTip>
            <EmailDocTip index="2">{m.settings_email_doc_tip2()}</EmailDocTip>
            <EmailDocTip index="3">{m.settings_email_doc_tip3()}</EmailDocTip>
            <EmailDocTip index="4">{m.settings_email_doc_tip4()}</EmailDocTip>
            <EmailDocTip index="5">{m.settings_email_doc_tip5()}</EmailDocTip>
            <EmailDocTip index="6">{m.settings_email_doc_tip6()}</EmailDocTip>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailDocTip({
  index,
  children,
}: {
  index: string;
  children: React.ReactNode;
}) {
  if (isFuwari) {
    return (
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--fuwari-btn-regular-bg) text-[10px] font-bold fuwari-text-50">
          {index}
        </span>
        <p className="text-xs sm:text-sm leading-relaxed fuwari-text-50">
          {children}
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/50 text-[10px] font-mono text-muted-foreground">
        {index}
      </span>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}
