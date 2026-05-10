import { ArchiveRestore } from "lucide-react";
import EmailListPage from "@/components/EmailListPage";

export default function Archive() {
  return (
    <EmailListPage
      title="Archive"
      status="archived"
      icon={ArchiveRestore}
      emptyMessage="No archived emails"
    />
  );
}
