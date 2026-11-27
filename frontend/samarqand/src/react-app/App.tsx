import { BrowserRouter as Router, Routes, Route } from "react-router";
import { lazy, Suspense } from "react";
import HomePage from "@/react-app/pages/Home";
import About from "@/react-app/pages/About";
import Projects from "@/react-app/pages/Projects";
import Contact from "@/react-app/pages/Contact";
import Services from "@/react-app/pages/Services";
import Tools from "@/react-app/pages/Tools";
import Showcase from "@/react-app/pages/Showcase";
const ControlLayout = lazy(() => import("@/react-app/pages/control/ControlLayout"));
const ControlLogin = lazy(() => import("@/react-app/pages/control/Login"));
const ControlUsers = lazy(() => import("@/react-app/pages/control/Users"));
const ControlLeads = lazy(() => import("@/react-app/pages/control/Leads"));
const ControlChangePassword = lazy(() => import("@/react-app/pages/control/ChangePassword"));
import AdminRedirect from "@/react-app/pages/control/AdminRedirect";
const ControlDashboard = lazy(() => import("@/react-app/pages/control/Dashboard"));
const ControlProjects = lazy(() => import("@/react-app/pages/control/Projects"));
const ControlProjectEdit = lazy(() => import("@/react-app/pages/control/ProjectEdit"));
const ControlBlogs = lazy(() => import("@/react-app/pages/control/Blogs"));
const ControlBlogEdit = lazy(() => import("@/react-app/pages/control/BlogEdit"));
const ControlServices = lazy(() => import("@/react-app/pages/control/Services"));
const ControlServiceEdit = lazy(() => import("@/react-app/pages/control/ServiceEdit"));
const ControlTestimonials = lazy(() => import("@/react-app/pages/control/Testimonials"));
const ControlHomeSections = lazy(() => import("@/react-app/pages/control/HomeSections"));
const ControlPages = lazy(() => import("@/react-app/pages/control/Pages"));
const ControlPageEdit = lazy(() => import("@/react-app/pages/control/PageEdit"));
const ControlMedia = lazy(() => import("@/react-app/pages/control/Media"));
const ControlCompanyDocuments = lazy(() => import("@/react-app/pages/control/CompanyDocuments"));
const ControlRFQDocuments = lazy(() => import("@/react-app/pages/control/RFQDocuments"));
const ControlRFQDocumentEdit = lazy(() => import("@/react-app/pages/control/RFQDocumentEdit"));
const ControlBackup = lazy(() => import("@/react-app/pages/control/Backup"));
const ControlOps = lazy(() => import("@/react-app/pages/control/Ops"));
const ControlBOQ = lazy(() => import("@/react-app/pages/control/BOQ"));
const ControlFieldDocs = lazy(() => import("@/react-app/pages/control/FieldDocs"));
const ControlHR = lazy(() => import("@/react-app/pages/control/HR"));
const ControlFleet = lazy(() => import("@/react-app/pages/control/Fleet"));
const ControlMail = lazy(() => import("@/react-app/pages/control/Mail"));
const ControlCompanySettings = lazy(() => import("@/react-app/pages/control/settings/Company"));
const ControlHomeSettings = lazy(() => import("@/react-app/pages/control/settings/Home"));
const ControlAISettings = lazy(() => import("@/react-app/pages/control/settings/AI"));
const ControlCalculatorSettings = lazy(() => import("@/react-app/pages/control/settings/Calculator"));
const ControlVisibilitySettings = lazy(() => import("@/react-app/pages/control/settings/Visibility"));
const ControlContentSettings = lazy(() => import("@/react-app/pages/control/settings/Content"));
import NotFound from "@/react-app/pages/NotFound";
import ContentList from "@/react-app/pages/ContentList";
import ContentDetail from "@/react-app/pages/ContentDetail";
import ErrorBoundary from "@/react-app/components/ErrorBoundary";
import ApiErrorBanner from "@/react-app/components/ApiErrorBanner";

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ApiErrorBanner />
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center text-slate-600">
              جارٍ التحميل…
            </div>
          }
        >
          <main className="min-h-screen">
          <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<About />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/services" element={<Services />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/showcase" element={<Showcase />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/request-quote" element={<Contact />} />
        <Route path="/blog" element={<ContentList kind="articles" />} />
        <Route path="/blog/:slug" element={<ContentDetail kind="articles" />} />
        <Route path="/events" element={<ContentList kind="events" />} />
        <Route path="/events/:slug" element={<ContentDetail kind="events" />} />
        <Route path="/locations" element={<ContentList kind="locations" />} />
        <Route path="/locations/:slug" element={<ContentDetail kind="locations" />} />
        <Route path="/admin/*" element={<AdminRedirect />} />
        <Route path="/control" element={<ControlLayout />}>
          <Route index element={<ControlDashboard />} />
          <Route path="login" element={<ControlLogin />} />
          <Route path="dashboard" element={<ControlDashboard />} />
          <Route path="team" element={<ControlDashboard mode="team" />} />
          <Route path="users" element={<ControlUsers />} />
        <Route path="leads" element={<ControlLeads />} />
          <Route path="password" element={<ControlChangePassword />} />
          <Route path="projects" element={<ControlProjects />} />
          <Route path="projects/:id" element={<ControlProjectEdit />} />
          <Route path="services" element={<ControlServices />} />
          <Route path="services/:id" element={<ControlServiceEdit />} />
          <Route path="blogs" element={<ControlBlogs />} />
          <Route path="blogs/:id" element={<ControlBlogEdit />} />
          <Route path="testimonials" element={<ControlTestimonials />} />
          <Route path="home-sections" element={<ControlHomeSections />} />
          <Route path="pages" element={<ControlPages />} />
          <Route path="pages/:id" element={<ControlPageEdit />} />
          <Route path="media" element={<ControlMedia />} />
          <Route path="company-documents" element={<ControlCompanyDocuments />} />
          <Route path="rfq" element={<ControlRFQDocuments />} />
          <Route path="rfq/:id" element={<ControlRFQDocumentEdit />} />
          <Route path="ops" element={<ControlOps />} />
          <Route path="boq" element={<ControlBOQ />} />
          <Route path="field-docs" element={<ControlFieldDocs />} />
          <Route path="hr" element={<ControlHR />} />
          <Route path="fleet" element={<ControlFleet />} />
          <Route path="mail" element={<ControlMail />} />
          <Route path="backup" element={<ControlBackup />} />
          <Route path="settings/company" element={<ControlCompanySettings />} />
          <Route path="settings/home" element={<ControlHomeSettings />} />
          <Route path="settings/ai" element={<ControlAISettings />} />
          <Route path="settings/calculator" element={<ControlCalculatorSettings />} />
          <Route path="settings/visibility" element={<ControlVisibilitySettings />} />
          <Route path="settings/content" element={<ControlContentSettings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
          </Routes>
          </main>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}
