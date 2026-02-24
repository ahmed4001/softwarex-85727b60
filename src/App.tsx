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

const VendorDashboard = lazy(() => import("./pages/vendor/VendorDashboard"));
const VendorProductsPage = lazy(() => import("./pages/vendor/VendorProductsPage"));
const VendorReviewsPage = lazy(() => import("./pages/vendor/VendorReviewsPage"));
const VendorClaimPage = lazy(() => import("./pages/vendor/VendorClaimPage"));

const queryClient = new QueryClient();

const Loading = () => <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">Loading...</div>;

function AppContent() {
  useLanguagePreference();
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/categories" element={<AllCategoriesPage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/compare/:slug" element={<ComparisonDetailPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/submit-product" element={<SubmitProductPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="reviews/pending" element={<AdminReviewsPage />} />
          <Route path="reviews/flagged" element={<AdminReviewsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="blog" element={<AdminBlogPage />} />
          <Route path="blog/new" element={<AdminBlogEditorPage />} />
          <Route path="blog/:id/edit" element={<AdminBlogEditorPage />} />
          <Route path="seed" element={<AdminSeedPage />} />
          <Route path="ai-import" element={<AdminAIImportPage />} />
          <Route path="translations" element={<AdminTranslationsPage />} />
          <Route path="brevo" element={<AdminBrevoPage />} />
        </Route>

        {/* Vendor routes */}
        <Route path="/vendor" element={<VendorLayout />}>
          <Route index element={<VendorDashboard />} />
          <Route path="products" element={<VendorProductsPage />} />
          <Route path="reviews" element={<VendorReviewsPage />} />
          <Route path="claim" element={<VendorClaimPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
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
);

export default App;
