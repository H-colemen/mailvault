import { Send } from "lucide-react";
import EmailListPage from "@/components/EmailListPage";

export default function Sent() {
  return (
    <EmailListPage
      title="Sent"
      direction="outbound"
      isDraft={false}
      icon={Send}
      emptyMessage="No sent emails"
    />
  );
}
