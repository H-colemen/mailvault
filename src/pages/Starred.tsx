import { Star } from "lucide-react";
import EmailListPage from "@/components/EmailListPage";

export default function Starred() {
  return (
    <EmailListPage
      title="Starred"
      isStarred={true}
      icon={Star}
      emptyMessage="No starred emails"
    />
  );
}
