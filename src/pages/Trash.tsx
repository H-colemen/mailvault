import { Trash2 } from "lucide-react";
import EmailListPage from "@/components/EmailListPage";

export default function Trash() {
  return (
    <EmailListPage
      title="Trash"
      status="trashed"
      icon={Trash2}
      emptyMessage="Trash is empty"
      showRestore
    />
  );
}
