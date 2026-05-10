import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Star,
  Archive,
  Trash2,
  Reply,
  ReplyAll,
  AlertTriangle,
  MailOpen,
  Mail,
  Download,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

export default function EmailDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data: email, isLoading } = trpc.email.get.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const markReadMutation = trpc.email.markRead.useMutation({
    onSuccess: () => {
      utils.email.stats.invalidate();
      utils.email.get.invalidate({ id: id! });
    },
  });

  const toggleStarMutation = trpc.email.toggleStar.useMutation({
    onSuccess: () => {
      utils.email.get.invalidate({ id: id! });
      utils.email.stats.invalidate();
    },
  });

  const archiveMutation = trpc.email.archive.useMutation({
    onSuccess: () => {
      toast.success("Email archived");
      navigate(-1);
    },
  });

  const trashMutation = trpc.email.trash.useMutation({
    onSuccess: () => {
      toast.success("Email moved to trash");
      navigate(-1);
    },
  });

  const spamMutation = trpc.email.markSpam.useMutation({
    onSuccess: () => {
      toast.success("Email marked as spam");
      navigate(-1);
    },
  });

  const notSpamMutation = trpc.email.notSpam.useMutation({
    onSuccess: () => {
      toast.success("Email marked as not spam");
      utils.email.get.invalidate({ id: id! });
    },
  });

  const restoreMutation = trpc.email.restore.useMutation({
    onSuccess: () => {
      toast.success("Email restored");
      utils.email.get.invalidate({ id: id! });
    },
  });

  // Auto-mark as read when viewing
  if (email && !email.isRead) {
    markReadMutation.mutate({ id: email.id, isRead: true });
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-48" />
          <Separator />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <p className="text-muted-foreground">Email not found</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-2">
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 h-14 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => toggleStarMutation.mutate({ id: email.id })}
        >
          <Star
            className={`h-4 w-4 ${
              email.isStarred ? "fill-yellow-400 text-yellow-400" : ""
            }`}
          />
        </Button>

        {email.status !== "archived" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => archiveMutation.mutate({ id: email.id })}
          >
            <Archive className="h-4 w-4" />
          </Button>
        )}

        {email.status === "trashed" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => restoreMutation.mutate({ id: email.id })}
          >
            <Mail className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => trashMutation.mutate({ id: email.id })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        {email.status === "spam" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => notSpamMutation.mutate({ id: email.id })}
          >
            <MailOpen className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => spamMutation.mutate({ id: email.id })}
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>
        )}

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => navigate(`/compose/${email.id}`)}
        >
          <Reply className="h-4 w-4 mr-1" />
          Reply
        </Button>

        {email.recipientTo && email.recipientTo.length > 1 && (
          <Button variant="ghost" size="sm" className="h-8">
            <ReplyAll className="h-4 w-4 mr-1" />
            Reply All
          </Button>
        )}
      </div>

      {/* Email Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto p-6">
          {/* Subject */}
          <h1 className="text-xl font-semibold mb-4">{email.subject || "(no subject)"}</h1>

          {/* Sender Info */}
          <div className="flex items-start gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">
              {(email.senderName || email.senderEmail).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{email.senderName || email.senderEmail}</span>
                <span className="text-sm text-muted-foreground">&lt;{email.senderEmail}&gt;</span>
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                <span>To: </span>
                {email.recipientTo?.map((r, i) => (
                  <span key={i}>
                    {r.name ? `${r.name} <${r.email}>` : r.email}
                    {i < (email.recipientTo?.length || 0) - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
              {email.recipientCc && email.recipientCc.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <span>Cc: </span>
                  {email.recipientCc.map((r, i) => (
                    <span key={i}>
                      {r.name ? `${r.name} <${r.email}>` : r.email}
                      {i < email.recipientCc!.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-sm text-muted-foreground mt-1">
                {email.receivedAt
                  ? format(new Date(email.receivedAt), "PPpp")
                  : ""}
              </div>
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Body */}
          <div className="prose dark:prose-invert max-w-none">
            {email.bodyHtml ? (
              <div
                dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                className="email-body"
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm">{email.bodyText}</pre>
            )}
          </div>

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <>
              <Separator className="my-6" />
              <div>
                <h3 className="text-sm font-medium mb-3">
                  Attachments ({email.attachments.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {email.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg"
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{att.filename}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(att.fileSize / 1024).toFixed(1)} KB)
                      </span>
                      {att.storageUrl && (
                        <a
                          href={att.storageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Thread View */}
          {email.thread && email.thread.emails && email.thread.emails.length > 1 && (
            <>
              <Separator className="my-6" />
              <div>
                <h3 className="text-sm font-medium mb-3">
                  Conversation ({email.thread.emails.length} messages)
                </h3>
                <div className="space-y-3">
                  {email.thread.emails
                    .filter((e) => e.id !== email.id)
                    .map((threadEmail) => (
                      <div
                        key={threadEmail.id}
                        className="p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => navigate(`/email/${threadEmail.id}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">
                            {threadEmail.senderName || threadEmail.senderEmail}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {threadEmail.receivedAt
                              ? format(new Date(threadEmail.receivedAt), "PPp")
                              : ""}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{threadEmail.subject}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {threadEmail.bodyPreview || threadEmail.bodyText?.substring(0, 200)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
