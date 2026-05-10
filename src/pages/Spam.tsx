import { ShieldAlert } from "lucide-react";
import EmailListPage from "@/components/EmailListPage";

export default function Spam() {
  return (
    <EmailListPage
      title="Spam"
      status="spam"
      icon={ShieldAlert}
      emptyMessage="No spam emails"
      showRestore
    />
  );
}
