import { Link } from "@tanstack/react-router";
import type {
  AuthLayoutProps,
  NavOption,
} from "@/features/theme/contract/layouts";
import { m } from "@/paraglide/messages";
import { PublicLayout } from "./public-layout";

export function AuthLayout({ children }: AuthLayoutProps) {
  const navOptions: NavOption[] = [
    { id: "navigation", to: "/navigation", label: m.nav_navigation() },
    { id: "home", to: "/", label: m.nav_home() },
    { id: "posts", to: "/posts", label: m.nav_posts() },
    { id: "moments", to: "/moments", label: m.nav_moments() },
    { id: "friend-links", to: "/friend-links", label: m.nav_friend_links() },
    { id: "about", to: "/about", label: m.nav_about() },
  ];
  return (
    <PublicLayout
      navOptions={navOptions}
      isSessionLoading={false}
      logout={async () => {}}
    >
      <div className="mx-auto w-full max-w-md min-w-0 space-y-4 flare-enter">
        <section className="flare-surface min-w-0 p-4 sm:p-6 md:p-8">
          {children}
        </section>
        <div className="text-center">
          <Link to="/" className="flare-chip min-h-11">
            {m.auth_layout_back_home()}
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
