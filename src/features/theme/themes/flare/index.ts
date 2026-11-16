import "./styles/index.css";
import Toaster from "@/components/ui/toaster";
import type { SiteConfig } from "@/features/config/site-config.schema";
import type { ThemeComponents } from "@/features/theme/contract/components";
import { config } from "./config";
import { AuthLayout } from "./layouts/auth-layout";
import { PublicLayout } from "./layouts/public-layout";
import { UserLayout } from "./layouts/user-layout";
import { AboutPage, AboutPageSkeleton } from "./pages/about";
import { ForgotPasswordPage } from "./pages/auth/forgot-password";
import { LoginPage } from "./pages/auth/login";
import { RegisterPage } from "./pages/auth/register";
import { ResetPasswordPage } from "./pages/auth/reset-password";
import { VerifyEmailPage } from "./pages/auth/verify-email";
import { FriendLinksPage, FriendLinksPageSkeleton } from "./pages/friend-links";
import { HomePage, HomePageSkeleton } from "./pages/home";
import { MomentsPage, MomentsPageSkeleton } from "./pages/moments";
import { NavigationPage, NavigationPageSkeleton } from "./pages/navigation";
import { PostPage, PostPageSkeleton } from "./pages/post";
import { PostsPage, PostsPageSkeleton } from "./pages/posts";
import { SearchPage } from "./pages/search";
import { SubmitFriendLinkPage } from "./pages/submit-friend-link";
import { ProfilePage } from "./pages/user/profile";

/**
 * Flare theme — immersive-style frontend adapted to demo-flare-blog.
 * Implements the full ThemeComponents contract.
 */
export default {
  config,
  getDocumentStyle: (_siteConfig: SiteConfig) => undefined,
  HomePage,
  HomePageSkeleton,
  PostsPage,
  PostsPageSkeleton,
  PostPage,
  PostPageSkeleton,
  AboutPage,
  AboutPageSkeleton,
  markdownClassName: "flare-md",
  PublicLayout,
  AuthLayout,
  UserLayout,
  FriendLinksPage,
  FriendLinksPageSkeleton,
  MomentsPage,
  MomentsPageSkeleton,
  NavigationPage,
  NavigationPageSkeleton,
  SearchPage,
  SubmitFriendLinkPage,
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
  ProfilePage,
  Toaster,
} satisfies ThemeComponents;
