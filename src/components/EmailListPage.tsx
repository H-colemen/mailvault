import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Star,
  Archive,
  Trash2,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  InboxIcon,
  Mail,
} from "lucide-react";
import type { Email } from "@db/schema";
import { formatDistanceToNow } from "date-fns";

function EmailListItem({
  email,
  selected,
  onSelect,
  onToggleStar,
  onClick,
}: {
  email: Email;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onToggleStar: () => void;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-start gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors hover:bg-accent/50 ${
        !email.isRead ? "bg-primary/[0.02]" : ""
      }`}
    >
      <div className="flex items-center pt-1" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={(checked) => onSelect(checked === true)} />
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
        className="pt-1 shrink-0"
      >
        <Star
          className={`h-4 w-4 transition-colors ${
            email.isStarred
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground hover:text-yellow-400"
          }`}
        />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm truncate ${!email.isRead ? "font-semibold" : ""}`}>
            {email.direction === "outbound" ? `To: ${email.recipientTo?.[0]?.email || ""}` : (email.senderName || email.senderEmail)}
          </span>
          {!email.isRead && (
            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
          )}
        </div>
        <p className={`text-sm truncate ${!email.isRead ? "font-medium" : "text-muted-foreground"}`}>
          {email.subject || "(no subject)"}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {email.bodyPreview || email.bodyText?.substring(0, 100) || ""}
        </p>
      </div>

      <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0 pt-1">
        {email.receivedAt
          ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: false })
          : ""}
      </div>
    </div>
  );
}

type EmailListPageProps = {
  title: string;
  status?: "active" | "archived" | "spam" | "trashed" | "deleted";
  direction?: "inbound" | "outbound";
  isDraft?: boolean;
  isStarred?: boolean;
  icon: typeof InboxIcon;
  emptyMessage: string;
  showRestore?: boolean;
};

export default function EmailListPage({
  title,
  status,
  direction,
  isDraft,
  isStarred,
  icon: Icon,
  emptyMessage,
  showRestore,
}: EmailListPageProps) {
  const [page, setPage] = useState(1);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.email.list.useQuery(
    {
      status,
      direction,
      isDraft,
      isStarred,
      page,
      pageSize: 25,
    },
    { refetchInterval: 30000 }
  );

  const toggleStarMutation = trpc.email.toggleStar.useMutation({
    onSuccess: () => {
      utils.email.list.invalidate();
      utils.email.stats.invalidate();
    },
  });

  const bulkActionMutation = trpc.email.bulkAction.useMutation({
    onSuccess: () => {
      utils.email.list.invalidate();
      utils.email.stats.invalidate();
      setSelectedEmails(new Set());
    },
  });

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedEmails);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedEmails(next);
  };

  const toggleSelectAll = () => {
    if (selectedEmails.size === (data?.emails.length || 0)) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(data?.emails.map((e) => e.id) || []));
    }
  };

  const handleBulkAction = (action: "archive" | "trash" | "spam" | "notSpam" | "restore") => {
    if (selectedEmails.size === 0) return;
    if (action === "restore") {
      // For restore, we need to mark as active - use archive mutation to unarchive
      bulkActionMutation.mutate(
        { ids: Array.from(selectedEmails), action: "archive" },
        {
          onSuccess: () => {
            toast.success("Emails restored");
            utils.email.list.invalidate();
          },
        }
      );
      return;
    }
    
    bulkActionMutation.mutate(
      { ids: Array.from(selectedEmails), action: action as any },
      {
        onSuccess: () => {
          const messages: Record<string, string> = {
            archive: "Emails archived",
            trash: "Emails moved to trash",
            spam: "Emails marked as spam",
            notSpam: "Emails marked as not spam",
          };
          toast.success(messages[action] || "Action completed");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border shrink-0">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-border">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-4" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-border shrink-0">
        <Checkbox
          checked={selectedEmails.size > 0 && selectedEmails.size === (data?.emails.length || 0)}
          onCheckedChange={toggleSelectAll}
        />

        {selectedEmails.size > 0 ? (
          <>
            <span className="text-xs text-muted-foreground">
              {selectedEmails.size} selected
            </span>
            <div className="flex items-center gap-1 ml-2">
              {showRestore ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => handleBulkAction("restore")}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Restore
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => handleBulkAction("archive")}
                  >
                    <Archive className="h-4 w-4 mr-1" />
                    Archive
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => handleBulkAction("trash")}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Trash
                  </Button>
                </>
              )}
              {status === "spam" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => handleBulkAction("notSpam")}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Not Spam
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => handleBulkAction("spam")}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Spam
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <h1 className="text-sm font-medium">{title}</h1>
          </>
        )}
      </div>

      {/* Email List */}
      <ScrollArea className="flex-1">
        {data?.emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Icon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">{emptyMessage}</h3>
          </div>
        ) : (
          data?.emails.map((email) => (
            <EmailListItem
              key={email.id}
              email={email}
              selected={selectedEmails.has(email.id)}
              onSelect={(checked) => toggleSelect(email.id, checked)}
              onToggleStar={() => toggleStarMutation.mutate({ id: email.id })}
              onClick={() => {}}
            />
          ))
        )}
      </ScrollArea>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 h-12 border-t border-border shrink-0">
          <span className="text-xs text-muted-foreground">
            {((data.pagination.page - 1) * data.pagination.pageSize) + 1} -
            {Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)} of{" "}
            {data.pagination.total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={data.pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={data.pagination.page >= data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
