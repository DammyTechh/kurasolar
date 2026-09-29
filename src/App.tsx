import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAdmin, RequireAuth } from './components/layout/Guards';
import { PublicLayout, ScrollToTop } from './components/layout/PublicLayout';
import { Spinner } from './components/ui/Misc';
import HomePage from './pages/HomePage';

const CalculatorPage = lazy(() => import('./pages/CalculatorPage'));
const AssessmentPage = lazy(() => import('./pages/AssessmentPage'));
const PaymentCallbackPage = lazy(() => import('./pages/PaymentCallbackPage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const PackagesPage = lazy(() => import('./pages/PackagesPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const QuotePage = lazy(() => import('./pages/QuotePage'));
const InstallersPage = lazy(() => import('./pages/InstallersPage'));
const InstallerRequestPage = lazy(() => import('./pages/InstallerRequestPage'));
const InstallerJoinPage = lazy(() => import('./pages/InstallerJoinPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const PostPage = lazy(() => import('./pages/PostPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const SignInPage = lazy(() => import('./pages/auth/SignInPage'));
const WelcomePage = lazy(() => import('./pages/auth/WelcomePage'));
const AccountLayout = lazy(() => import('./pages/account/AccountLayout'));
const AccountHome = lazy(() => import('./pages/account/AccountHome'));
const AccountAssessments = lazy(() => import('./pages/account/AccountAssessments'));
const AccountOrders = lazy(() => import('./pages/account/AccountOrders'));
const AccountPayments = lazy(() => import('./pages/account/AccountPayments'));
const AccountRequests = lazy(() => import('./pages/account/AccountRequests'));
const AccountSaved = lazy(() => import('./pages/account/AccountSaved'));
const AccountProfile = lazy(() => import('./pages/account/AccountProfile'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const AdminLoginPage = lazy(() => import('./admin/AdminLoginPage'));

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/*" element={<RequireAdmin><AdminApp /></RequireAdmin>} />
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="solar-calculator" element={<CalculatorPage />} />
            <Route path="assessments/:id" element={<RequireAuth><AssessmentPage /></RequireAuth>} />
            <Route path="payment/callback" element={<RequireAuth><PaymentCallbackPage /></RequireAuth>} />
            <Route path="shop" element={<ShopPage />} />
            <Route path="shop/:category" element={<ShopPage />} />
            <Route path="product/:slug" element={<ProductPage />} />
            <Route path="packages" element={<PackagesPage />} />
            <Route path="checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
            <Route path="quote" element={<QuotePage />} />
            <Route path="solar-installers" element={<InstallersPage />} />
            <Route path="solar-installers/request" element={<InstallerRequestPage />} />
            <Route path="solar-installers/join" element={<InstallerJoinPage />} />
            <Route path="blog" element={<BlogPage />} />
            <Route path="blog/:slug" element={<PostPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="sign-in" element={<SignInPage />} />
            <Route path="welcome" element={<RequireAuth><WelcomePage /></RequireAuth>} />
            <Route path="account" element={<RequireAuth><AccountLayout /></RequireAuth>}>
              <Route index element={<AccountHome />} />
              <Route path="assessments" element={<AccountAssessments />} />
              <Route path="orders" element={<AccountOrders />} />
              <Route path="payments" element={<AccountPayments />} />
              <Route path="requests" element={<AccountRequests />} />
              <Route path="saved" element={<AccountSaved />} />
              <Route path="profile" element={<AccountProfile />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
