import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";
import { useProductOrderConfig } from "@/hooks/useProductOrderConfig";
import { useThemeConfig } from "@/hooks/useThemeConfig";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { PublicLayout } from "@/components/PublicLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { VendorLayout } from "@/components/VendorLayout";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QuickCompareBar } from "@/components/QuickCompareBar";
import NotFound from "./pages/NotFound";

const HomePage = lazy(() => import("./pages/HomePage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const AllCategoriesPage = lazy(() => import("./pages/AllCategoriesPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const WriteReviewPage = lazy(() => import("./pages/WriteReviewPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const ComparisonDetailPage = lazy(() => import("./pages/ComparisonDetailPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const BlogTaxonomyPage = lazy(() => import("./pages/BlogTaxonomyPage"));
const AuthorPage = lazy(() => import("./pages/AuthorPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SubmitProductPage = lazy(() => import("./pages/SubmitProductPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"));
const AdminProductCleanupPage = lazy(() => import("./pages/admin/AdminProductCleanupPage"));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage"));
const AdminReviewsPage = lazy(() => import("./pages/admin/AdminReviewsPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminBlogPage = lazy(() => import("./pages/admin/AdminBlogPage"));
const AdminSeedPage = lazy(() => import("./pages/admin/AdminSeedPage"));
const AdminTranslationsPage = lazy(() => import("./pages/admin/AdminTranslationsPage"));
const AdminAIImportPage = lazy(() => import("./pages/admin/AdminAIImportPage"));
const AdminBlogEditorPage = lazy(() => import("./pages/admin/AdminBlogEditorPage"));
const AdminBlogSeoDashboardPage = lazy(() => import("./pages/admin/AdminBlogSeoDashboardPage"));
const AdminBlogSeoAuditPage = lazy(() => import("./pages/admin/AdminBlogSeoAuditPage"));
const AdminBrevoPage = lazy(() => import("./pages/admin/AdminBrevoPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminAIPage = lazy(() => import("./pages/admin/AdminAIPage"));
const AdminActivityPage = lazy(() => import("./pages/admin/AdminActivityPage"));
const AdminBackfillLogPage = lazy(() => import("./pages/admin/AdminBackfillLogPage"));
const AdminWebsiteReviewQueuePage = lazy(() => import("./pages/admin/AdminWebsiteReviewQueuePage"));
const AdminSlugAuditPage = lazy(() => import("./pages/admin/AdminSlugAuditPage"));
const AdminSeoRouteAuditPage = lazy(() => import("./pages/admin/AdminSeoRouteAuditPage"));
const AdminProductEditorPage = lazy(() => import("./pages/admin/AdminProductEditorPage"));
const AdminSubmissionsPage = lazy(() => import("./pages/admin/AdminSubmissionsPage"));
const AdminAdsPage = lazy(() => import("./pages/admin/AdminAdsPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminMediaPage = lazy(() => import("./pages/admin/AdminMediaPage"));
const AdminPagesPage = lazy(() => import("./pages/admin/AdminPagesPage"));
const AdminAlternativesPage = lazy(() => import("./pages/admin/AdminAlternativesPage"));
const AdminComparisonBuilderPage = lazy(() => import("./pages/admin/AdminComparisonBuilderPage"));
const AdminBroadcastPage = lazy(() => import("./pages/admin/AdminBroadcastPage"));
const AdminProductImportExportPage = lazy(() => import("./pages/admin/AdminProductImportExportPage"));
const AdminSentimentPage = lazy(() => import("./pages/admin/AdminSentimentPage"));
const AdminSubscribersPage = lazy(() => import("./pages/admin/AdminSubscribersPage"));
const AdminSubscriptionsPage = lazy(() => import("./pages/admin/AdminSubscriptionsPage"));
const AdminPaddleEventsPage = lazy(() => import("./pages/admin/AdminPaddleEventsPage"));
const AdminPricingPage = lazy(() => import("./pages/admin/AdminPricingPage"));
const AdminHomepageSectionsPage = lazy(() => import("./pages/admin/AdminHomepageSectionsPage"));
const StaticPage = lazy(() => import("./pages/StaticPage"));
const ActivityFeedPage = lazy(() => import("./pages/ActivityFeedPage"));
const PricingComparisonPage = lazy(() => import("./pages/PricingComparisonPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const ListsPage = lazy(() => import("./pages/ListsPage"));
const ListDetailPage = lazy(() => import("./pages/ListDetailPage"));
const ListEditorPage = lazy(() => import("./pages/ListEditorPage"));
const AwardsPage = lazy(() => import("./pages/AwardsPage"));

const VendorDashboard = lazy(() => import("./pages/vendor/VendorDashboard"));
const VendorProductsPage = lazy(() => import("./pages/vendor/VendorProductsPage"));
const VendorReviewsPage = lazy(() => import("./pages/vendor/VendorReviewsPage"));
const VendorClaimPage = lazy(() => import("./pages/vendor/VendorClaimPage"));
const VendorAnalyticsPage = lazy(() => import("./pages/vendor/VendorAnalyticsPage"));
const VendorProductEditorPage = lazy(() => import("./pages/vendor/VendorProductEditorPage"));
const VendorCompetitorsPage = lazy(() => import("./pages/vendor/VendorCompetitorsPage"));
const VendorResponseTemplatesPage = lazy(() => import("./pages/vendor/VendorResponseTemplatesPage"));
const VendorPlansPage = lazy(() => import("./pages/vendor/VendorPlansPage"));
const VendorLeadsPage = lazy(() => import("./pages/vendor/VendorLeadsPage"));
const VendorLeadAnalyticsPage = lazy(() => import("./pages/vendor/VendorLeadAnalyticsPage"));
const VendorSponsoredPage = lazy(() => import("./pages/vendor/VendorSponsoredPage"));
const VendorROIPage = lazy(() => import("./pages/vendor/VendorROIPage"));

const DiscussionsPage = lazy(() => import("./pages/DiscussionsPage"));
const DiscussionDetailPage = lazy(() => import("./pages/DiscussionDetailPage"));
const LandingPageView = lazy(() => import("./pages/LandingPageView"));
const AdminLandingPagesPage = lazy(() => import("./pages/admin/AdminLandingPagesPage"));
const TechStacksPage = lazy(() => import("./pages/TechStacksPage"));
const TechStackDetailPage = lazy(() => import("./pages/TechStackDetailPage"));
const BuyerGuidesListPage = lazy(() => import("./pages/BuyerGuidesListPage"));
const BuyerGuidePage = lazy(() => import("./pages/BuyerGuidePage"));
const VendorWarRoomPage = lazy(() => import("./pages/vendor/VendorWarRoomPage"));
const AdminBuyerGuidesPage = lazy(() => import("./pages/admin/AdminBuyerGuidesPage"));
const AdminModerationPage = lazy(() => import("./pages/admin/AdminModerationPage"));
const AdminGlossaryPage = lazy(() => import("./pages/admin/AdminGlossaryPage"));
const AdminTrendReportsPage = lazy(() => import("./pages/admin/AdminTrendReportsPage"));
const AdminCohortPage = lazy(() => import("./pages/admin/AdminCohortPage"));
const AlternativesPage = lazy(() => import("./pages/AlternativesPage"));
const GlossaryPage = lazy(() => import("./pages/GlossaryPage"));
const GlossaryTermPage = lazy(() => import("./pages/GlossaryTermPage"));
const PartnerLinksPage = lazy(() => import("./pages/PartnerLinksPage"));
const AdminPartnerLinksPage = lazy(() => import("./pages/admin/AdminPartnerLinksPage"));
const AdminAffiliateAnalyticsPage = lazy(() => import("./pages/admin/AdminAffiliateAnalyticsPage"));
const KeywordLandingPage = lazy(() => import("./pages/KeywordLandingPage"));
const AdminKeywordLandingPage = lazy(() => import("./pages/admin/AdminKeywordLandingPage"));
const DealsPage = lazy(() => import("./pages/DealsPage"));
const DealDetailPage = lazy(() => import("./pages/DealDetailPage"));
const AdminDealsPage = lazy(() => import("./pages/admin/AdminDealsPage"));
const AdminDealsImportPage = lazy(() => import("./pages/admin/AdminDealsImportPage"));
const ChoosePlanPage = lazy(() => import("./pages/ChoosePlanPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));

import { KEYWORD_ROOT_SLUGS } from "@/lib/seo-canonical";

const queryClient = new QueryClient();

import { RouteSkeleton } from "./components/RouteSkeleton";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";

function AppContent() {
  useLanguagePreference();
  useProductOrderConfig();
  useThemeConfig();
  return (
    <RouteErrorBoundary>
    <Suspense fallback={<RouteSkeleton />}>


      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<ErrorBoundary><HomePage /></ErrorBoundary>} />
          <Route path="/categories" element={<ErrorBoundary><AllCategoriesPage /></ErrorBoundary>} />
          <Route path="/category/:slug" element={<ErrorBoundary><CategoryPage /></ErrorBoundary>} />
          <Route path="/product/:slug" element={<ErrorBoundary><ProductDetailPage /></ErrorBoundary>} />
          <Route path="/product/:slug/write-review" element={<ErrorBoundary><WriteReviewPage /></ErrorBoundary>} />
          <Route path="/search" element={<ErrorBoundary><SearchPage /></ErrorBoundary>} />
          <Route path="/compare" element={<ErrorBoundary><ComparePage /></ErrorBoundary>} />
          <Route path="/compare/:slug" element={<ErrorBoundary><ComparisonDetailPage /></ErrorBoundary>} />
          <Route path="/blog" element={<ErrorBoundary><BlogPage /></ErrorBoundary>} />
          <Route path="/blog/tag/:tag" element={<ErrorBoundary><BlogTaxonomyPage mode="tag" /></ErrorBoundary>} />
          <Route path="/blog/category/:category" element={<ErrorBoundary><BlogTaxonomyPage mode="category" /></ErrorBoundary>} />
          <Route path="/blog/:slug" element={<ErrorBoundary><BlogPostPage /></ErrorBoundary>} />
          <Route path="/author/:id" element={<ErrorBoundary><AuthorPage /></ErrorBoundary>} />
          <Route path="/submit-product" element={<ErrorBoundary><SubmitProductPage /></ErrorBoundary>} />
          <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="/leaderboard" element={<ErrorBoundary><LeaderboardPage /></ErrorBoundary>} />
          <Route path="/user/:id" element={<ErrorBoundary><UserProfilePage /></ErrorBoundary>} />
          <Route path="/page/:slug" element={<ErrorBoundary><StaticPage /></ErrorBoundary>} />
          <Route path="/activity" element={<ErrorBoundary><ActivityFeedPage /></ErrorBoundary>} />
          <Route path="/compare-pricing" element={<ErrorBoundary><PricingComparisonPage /></ErrorBoundary>} />
          <Route path="/pricing" element={<ErrorBoundary><PricingPage /></ErrorBoundary>} />
          <Route path="/lists" element={<ErrorBoundary><ListsPage /></ErrorBoundary>} />
          <Route path="/lists/new" element={<ErrorBoundary><ListEditorPage /></ErrorBoundary>} />
          <Route path="/lists/:slug" element={<ErrorBoundary><ListDetailPage /></ErrorBoundary>} />
          <Route path="/lists/:slug/edit" element={<ErrorBoundary><ListEditorPage /></ErrorBoundary>} />
          <Route path="/awards" element={<ErrorBoundary><AwardsPage /></ErrorBoundary>} />
          <Route path="/discussions" element={<ErrorBoundary><DiscussionsPage /></ErrorBoundary>} />
          <Route path="/discussions/:id" element={<ErrorBoundary><DiscussionDetailPage /></ErrorBoundary>} />
          <Route path="/best/:slug" element={<ErrorBoundary><LandingPageView /></ErrorBoundary>} />
          <Route path="/stacks" element={<ErrorBoundary><TechStacksPage /></ErrorBoundary>} />
          <Route path="/stacks/:slug" element={<ErrorBoundary><TechStackDetailPage /></ErrorBoundary>} />
          <Route path="/guides" element={<ErrorBoundary><BuyerGuidesListPage /></ErrorBoundary>} />
          <Route path="/guides/:slug" element={<ErrorBoundary><BuyerGuidePage /></ErrorBoundary>} />
          <Route path="/alternatives/:slug" element={<ErrorBoundary><AlternativesPage /></ErrorBoundary>} />
          <Route path="/glossary" element={<ErrorBoundary><GlossaryPage /></ErrorBoundary>} />
          <Route path="/glossary/:slug" element={<ErrorBoundary><GlossaryTermPage /></ErrorBoundary>} />
          <Route path="/partners" element={<ErrorBoundary><PartnerLinksPage /></ErrorBoundary>} />
          <Route path="/deals" element={<ErrorBoundary><DealsPage /></ErrorBoundary>} />
          <Route path="/deals/:slug" element={<ErrorBoundary><DealDetailPage /></ErrorBoundary>} />
          <Route path="/choose-plan" element={<ErrorBoundary><ChoosePlanPage /></ErrorBoundary>} />
          <Route path="/checkout" element={<ErrorBoundary><CheckoutPage /></ErrorBoundary>} />

          {/* Programmatic SEO route families */}
          <Route path="/features/:slug" element={<ErrorBoundary><KeywordLandingPage pageType="feature" pathPrefix="/features" /></ErrorBoundary>} />
          <Route path="/use-cases/:slug" element={<ErrorBoundary><KeywordLandingPage pageType="use_case" pathPrefix="/use-cases" /></ErrorBoundary>} />
          <Route path="/industry/:slug" element={<ErrorBoundary><KeywordLandingPage pageType="industry" pathPrefix="/industry" /></ErrorBoundary>} />
          <Route path="/templates/:slug" element={<ErrorBoundary><KeywordLandingPage pageType="template" pathPrefix="/templates" /></ErrorBoundary>} />

          {/* Apploye-style root-level keyword landing pages */}
          {KEYWORD_ROOT_SLUGS.map((slug) => (
            <Route
              key={slug}
              path={`/${slug}`}
              element={<ErrorBoundary><KeywordLandingPage pageType="keyword" slugOverride={slug} /></ErrorBoundary>}
            />
          ))}
          <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
        </Route>


        {/* Admin routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
          <Route path="products" element={<ErrorBoundary><AdminProductsPage /></ErrorBoundary>} />
          <Route path="products/new" element={<ErrorBoundary><AdminProductEditorPage /></ErrorBoundary>} />
          <Route path="products/sponsored" element={<ErrorBoundary><AdminProductsPage /></ErrorBoundary>} />
          <Route path="products/cleanup" element={<ErrorBoundary><AdminProductCleanupPage /></ErrorBoundary>} />
          <Route path="products/:id/edit" element={<ErrorBoundary><AdminProductEditorPage /></ErrorBoundary>} />
          <Route path="categories" element={<ErrorBoundary><AdminCategoriesPage /></ErrorBoundary>} />
          <Route path="categories/new" element={<ErrorBoundary><AdminCategoriesPage /></ErrorBoundary>} />
          <Route path="reviews" element={<ErrorBoundary><AdminReviewsPage /></ErrorBoundary>} />
          <Route path="reviews/pending" element={<ErrorBoundary><AdminReviewsPage /></ErrorBoundary>} />
          <Route path="reviews/flagged" element={<ErrorBoundary><AdminReviewsPage /></ErrorBoundary>} />
          <Route path="users" element={<ErrorBoundary><AdminUsersPage /></ErrorBoundary>} />
          <Route path="blog" element={<ErrorBoundary><AdminBlogPage /></ErrorBoundary>} />
          <Route path="blog/seo" element={<ErrorBoundary><AdminBlogSeoDashboardPage /></ErrorBoundary>} />
          <Route path="blog/seo-audit" element={<ErrorBoundary><AdminBlogSeoAuditPage /></ErrorBoundary>} />
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
          <Route path="backfill-log" element={<ErrorBoundary><AdminBackfillLogPage /></ErrorBoundary>} />
          <Route path="website-review-queue" element={<ErrorBoundary><AdminWebsiteReviewQueuePage /></ErrorBoundary>} />
          <Route path="ads" element={<ErrorBoundary><AdminAdsPage /></ErrorBoundary>} />
          <Route path="settings" element={<ErrorBoundary><AdminSettingsPage /></ErrorBoundary>} />
          <Route path="media" element={<ErrorBoundary><AdminMediaPage /></ErrorBoundary>} />
          <Route path="pages" element={<ErrorBoundary><AdminPagesPage /></ErrorBoundary>} />
          <Route path="alternatives" element={<ErrorBoundary><AdminAlternativesPage /></ErrorBoundary>} />
          <Route path="comparisons" element={<ErrorBoundary><AdminComparisonBuilderPage /></ErrorBoundary>} />
          <Route path="broadcast" element={<ErrorBoundary><AdminBroadcastPage /></ErrorBoundary>} />
          <Route path="import-export" element={<ErrorBoundary><AdminProductImportExportPage /></ErrorBoundary>} />
          <Route path="sentiment" element={<ErrorBoundary><AdminSentimentPage /></ErrorBoundary>} />
          <Route path="emails" element={<ErrorBoundary><AdminBrevoPage /></ErrorBoundary>} />
          <Route path="subscribers" element={<ErrorBoundary><AdminSubscribersPage /></ErrorBoundary>} />
          <Route path="pricing" element={<ErrorBoundary><AdminPricingPage /></ErrorBoundary>} />
          <Route path="landing-pages" element={<ErrorBoundary><AdminLandingPagesPage /></ErrorBoundary>} />
          <Route path="buyer-guides" element={<ErrorBoundary><AdminBuyerGuidesPage /></ErrorBoundary>} />
          <Route path="moderation" element={<ErrorBoundary><AdminModerationPage /></ErrorBoundary>} />
          <Route path="glossary" element={<ErrorBoundary><AdminGlossaryPage /></ErrorBoundary>} />
          <Route path="trend-reports" element={<ErrorBoundary><AdminTrendReportsPage /></ErrorBoundary>} />
          <Route path="cohort" element={<ErrorBoundary><AdminCohortPage /></ErrorBoundary>} />
          <Route path="partner-links" element={<ErrorBoundary><AdminPartnerLinksPage /></ErrorBoundary>} />
          <Route path="affiliate-analytics" element={<ErrorBoundary><AdminAffiliateAnalyticsPage /></ErrorBoundary>} />
          <Route path="slug-audit" element={<ErrorBoundary><AdminSlugAuditPage /></ErrorBoundary>} />
          <Route path="seo-route-audit" element={<ErrorBoundary><AdminSeoRouteAuditPage /></ErrorBoundary>} />
          <Route path="keyword-pages" element={<ErrorBoundary><AdminKeywordLandingPage /></ErrorBoundary>} />
          <Route path="deals" element={<ErrorBoundary><AdminDealsPage /></ErrorBoundary>} />
          <Route path="deals/import" element={<ErrorBoundary><AdminDealsImportPage /></ErrorBoundary>} />
          <Route path="subscriptions" element={<ErrorBoundary><AdminSubscriptionsPage /></ErrorBoundary>} />
          <Route path="paddle-events" element={<ErrorBoundary><AdminPaddleEventsPage /></ErrorBoundary>} />
          <Route path="homepage-sections" element={<ErrorBoundary><AdminHomepageSectionsPage /></ErrorBoundary>} />
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
          <Route path="plans" element={<ErrorBoundary><VendorPlansPage /></ErrorBoundary>} />
          <Route path="leads" element={<ErrorBoundary><VendorLeadsPage /></ErrorBoundary>} />
          <Route path="leads/analytics" element={<ErrorBoundary><VendorLeadAnalyticsPage /></ErrorBoundary>} />
          <Route path="sponsored" element={<ErrorBoundary><VendorSponsoredPage /></ErrorBoundary>} />
          <Route path="roi" element={<ErrorBoundary><VendorROIPage /></ErrorBoundary>} />
          <Route path="war-room" element={<ErrorBoundary><VendorWarRoomPage /></ErrorBoundary>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
    </RouteErrorBoundary>
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
            <QuickCompareBar />
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
