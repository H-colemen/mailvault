import { FileText } from "lucide-react";
import EmailListPage from "@/components/EmailListPage";

export default function Drafts() {
  return (
    <EmailListPage
      title="Drafts"
      isDraft={true}
      icon={FileText}
      emptyMessage="No drafts"
    />
  );
}
