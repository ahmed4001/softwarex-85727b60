import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { PublicLayout } from "@/components/PublicLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { VendorLayout } from "@/components/VendorLayout";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "./pages/NotFound";

const HomePage = lazy(() => import("./pages/HomePage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const AllCategoriesPage = lazy(() => import("./pages/AllCategoriesPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const ComparisonDetailPage = lazy(() => import("./pages/ComparisonDetailPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SubmitProductPage = lazy(() => import("./pages/SubmitProductPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage"));
const AdminReviewsPage = lazy(() => import("./pages/admin/AdminReviewsPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminBlogPage = lazy(() => import("./pages/admin/AdminBlogPage"));
const AdminSeedPage = lazy(() => import("./pages/admin/AdminSeedPage"));
const AdminTranslationsPage = lazy(() => import("./pages/admin/AdminTranslationsPage"));
const AdminAIImportPage = lazy(() => import("./pages/admin/AdminAIImportPage"));
const AdminBlogEditorPage = lazy(() => import("./pages/admin/AdminBlogEditorPage"));
const AdminBrevoPage = lazy(() => import("./pages/admin/AdminBrevoPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminAIPage = lazy(() => import("./pages/admin/AdminAIPage"));
const AdminActivityPage = lazy(() => import("./pages/admin/AdminActivityPage"));
const AdminProductEditorPage = lazy(() => import("./pages/admin/AdminProductEditorPage"));
const AdminSubmissionsPage = lazy(() => import("./pages/admin/AdminSubmissionsPage"));
const AdminAdsPage = lazy(() => import("./pages/admin/AdminAdsPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminMediaPage = lazy(() => import("./pages/admin/AdminMediaPage"));
const AdminPagesPage = lazy(() => import("./pages/admin/AdminPagesPage"));

const VendorDashboard = lazy(() => import("./pages/vendor/VendorDashboard"));
const VendorProductsPage = lazy(() => import("./pages/vendor/VendorProductsPage"));
const VendorReviewsPage = lazy(() => import("./pages/vendor/VendorReviewsPage"));
const VendorClaimPage = lazy(() => import("./pages/vendor/VendorClaimPage"));
const VendorAnalyticsPage = lazy(() => import("./pages/vendor/VendorAnalyticsPage"));
const VendorProductEditorPage = lazy(() => import("./pages/vendor/VendorProductEditorPage"));
const VendorCompetitorsPage = lazy(() => import("./pages/vendor/VendorCompetitorsPage"));
const VendorResponseTemplatesPage = lazy(() => import("./pages/vendor/VendorResponseTemplatesPage"));

const queryClient = new QueryClient();

const Loading = () => <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">Loading...</div>;

function AppContent() {
  useLanguagePreference();
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<ErrorBoundary><HomePage /></ErrorBoundary>} />
          <Route path="/categories" element={<ErrorBoundary><AllCategoriesPage /></ErrorBoundary>} />
          <Route path="/category/:slug" element={<ErrorBoundary><CategoryPage /></ErrorBoundary>} />
          <Route path="/product/:slug" element={<ErrorBoundary><ProductDetailPage /></ErrorBoundary>} />
          <Route path="/search" element={<ErrorBoundary><SearchPage /></ErrorBoundary>} />
          <Route path="/compare" element={<ErrorBoundary><ComparePage /></ErrorBoundary>} />
          <Route path="/compare/:slug" element={<ErrorBoundary><ComparisonDetailPage /></ErrorBoundary>} />
          <Route path="/blog" element={<ErrorBoundary><BlogPage /></ErrorBoundary>} />
          <Route path="/blog/:slug" element={<ErrorBoundary><BlogPostPage /></ErrorBoundary>} />
          <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
          <Route path="/submit-product" element={<ErrorBoundary><SubmitProductPage /></ErrorBoundary>} />
          <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="/leaderboard" element={<ErrorBoundary><LeaderboardPage /></ErrorBoundary>} />
          <Route path="/user/:id" element={<ErrorBoundary><UserProfilePage /></ErrorBoundary>} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
          <Route path="products" element={<ErrorBoundary><AdminProductsPage /></ErrorBoundary>} />
          <Route path="products/new" element={<ErrorBoundary><AdminProductEditorPage /></ErrorBoundary>} />
          <Route path="products/:id/edit" element={<ErrorBoundary><AdminProductEditorPage /></ErrorBoundary>} />
          <Route path="categories" element={<ErrorBoundary><AdminCategoriesPage /></ErrorBoundary>} />
          <Route path="reviews" element={<ErrorBoundary><AdminReviewsPage /></ErrorBoundary>} />
          <Route path="reviews/pending" element={<ErrorBoundary><AdminReviewsPage /></ErrorBoundary>} />
          <Route path="reviews/flagged" element={<ErrorBoundary><AdminReviewsPage /></ErrorBoundary>} />
          <Route path="users" element={<ErrorBoundary><AdminUsersPage /></ErrorBoundary>} />
          <Route path="blog" element={<ErrorBoundary><AdminBlogPage /></ErrorBoundary>} />
          <Route path="blog/new" element={<ErrorBoundary><AdminBlogEditorPage /></ErrorBoundary>} />
          <Route path="blog/:id/edit" element={<ErrorBoundary><AdminBlogEditorPage /></ErrorBoundary>} />
          <Route path="seed" element={<ErrorBoundary><AdminSeedPage /></ErrorBoundary>} />
          <Route path="ai-import" element={<ErrorBoundary><AdminAIImportPage /></ErrorBoundary>} />
          <Route path="translations" element={<ErrorBoundary><AdminTranslationsPage /></ErrorBoundary>} />
          <Route path="brevo" element={<ErrorBoundary><AdminBrevoPage /></ErrorBoundary>} />
          <Route path="analytics" element={<ErrorBoundary><AdminAnalyticsPage /></ErrorBoundary>} />
          <Route path="ai" element={<ErrorBoundary><AdminAIPage /></ErrorBoundary>} />
          <Route path="submissions" element={<ErrorBoundary><AdminSubmissionsPage /></ErrorBoundary>} />
          <Route path="activity" element={<ErrorBoundary><AdminActivityPage /></ErrorBoundary>} />
          <Route path="ads" element={<ErrorBoundary><AdminAdsPage /></ErrorBoundary>} />
          <Route path="settings" element={<ErrorBoundary><AdminSettingsPage /></ErrorBoundary>} />
          <Route path="media" element={<ErrorBoundary><AdminMediaPage /></ErrorBoundary>} />
          <Route path="pages" element={<ErrorBoundary><AdminPagesPage /></ErrorBoundary>} />
        </Route>

        {/* Vendor routes */}
        <Route path="/vendor" element={<VendorLayout />}>
          <Route index element={<ErrorBoundary><VendorDashboard /></ErrorBoundary>} />
          <Route path="products" element={<ErrorBoundary><VendorProductsPage /></ErrorBoundary>} />
          <Route path="reviews" element={<ErrorBoundary><VendorReviewsPage /></ErrorBoundary>} />
          <Route path="claim" element={<ErrorBoundary><VendorClaimPage /></ErrorBoundary>} />
          <Route path="analytics" element={<ErrorBoundary><VendorAnalyticsPage /></ErrorBoundary>} />
          <Route path="products/:productId/edit" element={<ErrorBoundary><VendorProductEditorPage /></ErrorBoundary>} />
          <Route path="competitors" element={<ErrorBoundary><VendorCompetitorsPage /></ErrorBoundary>} />
          <Route path="templates" element={<ErrorBoundary><VendorResponseTemplatesPage /></ErrorBoundary>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
