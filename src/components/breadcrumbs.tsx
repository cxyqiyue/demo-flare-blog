import { Link, useRouterState } from "@tanstack/react-router";
import { Fragment } from "react";
import { isFuwari } from "@/lib/theme-mode";

export function Breadcrumbs() {
  const matches = useRouterState({ select: (s) => s.matches });

  const breadcrumbs = matches.flatMap(({ pathname, loaderData }) => {
    const title =
      typeof loaderData === "object" && "title" in loaderData
        ? loaderData.title
        : undefined;
    return title ? [{ title, path: pathname }] : [];
  });

  if (breadcrumbs.length === 0) return null;

  return (
    <nav
      className={
        isFuwari
          ? "flex items-center gap-1.5 text-sm fuwari-text-50 min-w-0"
          : "flex items-center gap-1.5 md:gap-2 text-[10px] tracking-[0.2em] md:tracking-[0.3em] text-muted-foreground min-w-0"
      }
    >
      {breadcrumbs.map((crumb, index) => (
        <Fragment key={crumb.path}>
          {index > 0 && (
            <span
              className={
                isFuwari ? "fuwari-text-30 shrink-0" : "opacity-30 shrink-0"
              }
            >
              {isFuwari ? "›" : "/"}
            </span>
          )}
          <Link
            to={crumb.path}
            className={`transition-colors truncate max-w-20 sm:max-w-30 md:max-w-none ${
              index === breadcrumbs.length - 1
                ? isFuwari
                  ? "text-(--fuwari-primary) font-bold shrink-0 sm:shrink"
                  : "text-foreground font-bold tracking-widest shrink-0 sm:shrink"
                : isFuwari
                  ? "hover:text-(--fuwari-primary)"
                  : "hover:text-foreground"
            } ${index < breadcrumbs.length - 2 ? "hidden sm:inline" : ""}`}
          >
            {crumb.title}
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
