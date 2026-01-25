import { BrowserRouter as Router, Routes, Route } from "react-router";
import HomePage from "@/react-app/pages/Home";
import About from "@/react-app/pages/About";
import Projects from "@/react-app/pages/Projects";
import Contact from "@/react-app/pages/Contact";
import Services from "@/react-app/pages/Services";
import Tools from "@/react-app/pages/Tools";
import Showcase from "@/react-app/pages/Showcase";
import ControlLayout from "@/react-app/pages/control/ControlLayout";
import ControlLogin from "@/react-app/pages/control/Login";
import ControlUsers from "@/react-app/pages/control/Users";
import ControlChangePassword from "@/react-app/pages/control/ChangePassword";
import AdminRedirect from "@/react-app/pages/control/AdminRedirect";
import ControlDashboard from "@/react-app/pages/control/Dashboard";
import ControlProjects from "@/react-app/pages/control/Projects";
import ControlProjectEdit from "@/react-app/pages/control/ProjectEdit";
import ControlBlogs from "@/react-app/pages/control/Blogs";
import ControlBlogEdit from "@/react-app/pages/control/BlogEdit";
import ControlServices from "@/react-app/pages/control/Services";
import ControlServiceEdit from "@/react-app/pages/control/ServiceEdit";
import ControlTestimonials from "@/react-app/pages/control/Testimonials";
import ControlHomeSections from "@/react-app/pages/control/HomeSections";
import ControlPages from "@/react-app/pages/control/Pages";
import ControlPageEdit from "@/react-app/pages/control/PageEdit";
import ControlMedia from "@/react-app/pages/control/Media";
import ControlRFQDocuments from "@/react-app/pages/control/RFQDocuments";
import ControlRFQDocumentEdit from "@/react-app/pages/control/RFQDocumentEdit";
import ControlBackup from "@/react-app/pages/control/Backup";
import ControlCompanySettings from "@/react-app/pages/control/settings/Company";
import ControlHomeSettings from "@/react-app/pages/control/settings/Home";
import ControlAISettings from "@/react-app/pages/control/settings/AI";
import ControlCalculatorSettings from "@/react-app/pages/control/settings/Calculator";
import ControlVisibilitySettings from "@/react-app/pages/control/settings/Visibility";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<About />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/services" element={<Services />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/showcase" element={<Showcase />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/admin/*" element={<AdminRedirect />} />
        <Route path="/control" element={<ControlLayout />}>
          <Route index element={<ControlDashboard />} />
          <Route path="login" element={<ControlLogin />} />
          <Route path="dashboard" element={<ControlDashboard />} />
          <Route path="team" element={<ControlDashboard mode="team" />} />
          <Route path="users" element={<ControlUsers />} />
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
          <Route path="rfq" element={<ControlRFQDocuments />} />
          <Route path="rfq/:id" element={<ControlRFQDocumentEdit />} />
          <Route path="backup" element={<ControlBackup />} />
          <Route path="settings/company" element={<ControlCompanySettings />} />
          <Route path="settings/home" element={<ControlHomeSettings />} />
          <Route path="settings/ai" element={<ControlAISettings />} />
          <Route path="settings/calculator" element={<ControlCalculatorSettings />} />
          <Route path="settings/visibility" element={<ControlVisibilitySettings />} />
        </Route>
      </Routes>
    </Router>
  );
}
