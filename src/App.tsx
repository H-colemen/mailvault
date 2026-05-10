import { Routes, Route } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import AppLayout from "@/components/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Inbox from "./pages/Inbox";
import Sent from "./pages/Sent";
import Drafts from "./pages/Drafts";
import Trash from "./pages/Trash";
import Spam from "./pages/Spam";
import Archive from "./pages/Archive";
import Starred from "./pages/Starred";
import EmailDetail from "./pages/EmailDetail";
import Compose from "./pages/Compose";
import Settings from "./pages/Settings";
import Domains from "./pages/Domains";
import Mailboxes from "./pages/Mailboxes";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="mailvault-theme">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Inbox />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/sent" element={<Sent />} />
          <Route path="/drafts" element={<Drafts />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/spam" element={<Spam />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/starred" element={<Starred />} />
          <Route path="/email/:id" element={<EmailDetail />} />
          <Route path="/compose" element={<Compose />} />
          <Route path="/compose/:replyTo" element={<Compose />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/domains" element={<Domains />} />
          <Route path="/mailboxes" element={<Mailboxes />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  );
}
