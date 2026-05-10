import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Paperclip, Loader2 } from "lucide-react";

type ComposeEmailProps = {
  open: boolean;
  onClose: () => void;
  replyToId?: string;
};

export default function ComposeEmail({ open, onClose, replyToId }: ComposeEmailProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const utils = trpc.useUtils();

  const { data: replyEmail } = trpc.email.get.useQuery(
    { id: replyToId! },
    { enabled: !!replyToId }
  );

  const sendMutation = trpc.send.send.useMutation({
    onSuccess: () => {
      utils.email.list.invalidate();
      utils.email.stats.invalidate();
      toast.success("Email sent successfully");
      onClose();
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send email");
    },
  });

  const saveDraftMutation = trpc.send.saveDraft.useMutation({
    onSuccess: () => {
      utils.email.list.invalidate();
      toast.success("Draft saved");
    },
  });

  const replyMutation = trpc.send.reply.useMutation({
    onSuccess: () => {
      utils.email.list.invalidate();
      utils.email.stats.invalidate();
      toast.success("Reply sent successfully");
      onClose();
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send reply");
    },
  });

  useEffect(() => {
    if (replyEmail && replyToId) {
      setTo(replyEmail.senderEmail);
      setSubject(replyEmail.subject?.startsWith("Re:") ? replyEmail.subject : `Re: ${replyEmail.subject}`);
    }
  }, [replyEmail, replyToId]);

  const resetForm = () => {
    setTo("");
    setCc("");
    setSubject("");
    setBody("");
    setShowCc(false);
  };

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSending(true);

    try {
      if (replyToId) {
        await replyMutation.mutateAsync({
          emailId: replyToId,
          bodyText: body,
          bodyHtml: body.replace(/\n/g, "<br>"),
        });
      } else {
        const toAddresses = to.split(",").map((email) => ({
          email: email.trim(),
          name: undefined,
        }));

        const ccAddresses = cc
          ? cc.split(",").map((email) => ({
              email: email.trim(),
              name: undefined,
            }))
          : undefined;

        await sendMutation.mutateAsync({
          from: "user@example.com", // Will be replaced with actual domain
          to: toAddresses,
          ...(ccAddresses ? { cc: ccAddresses } : {}),
          subject,
          bodyText: body,
          bodyHtml: body.replace(/\n/g, "<br>"),
        });
      }
    } catch {
      // Error handled by mutation callbacks
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = () => {
    saveDraftMutation.mutate({
      to: to ? to.split(",").map((email) => ({ email: email.trim() })) : [],
      subject: subject || undefined,
      bodyText: body || undefined,
      bodyHtml: body ? body.replace(/\n/g, "<br>") : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="flex items-center justify-between">
            <span>{replyToId ? "Reply" : "Compose Email"}</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {/* From */}
            {!replyToId && (
              <div className="space-y-2">
                <Label htmlFor="from">From</Label>
                <Input
                  id="from"
                  placeholder="select@yourdomain.com"
                  disabled
                  value="user@yourdomain.com"
                />
              </div>
            )}

            {/* To */}
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                placeholder="recipient@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>

            {/* CC */}
            {showCc && (
              <div className="space-y-2">
                <Label htmlFor="cc">Cc</Label>
                <Input
                  id="cc"
                  placeholder="cc@example.com"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                />
              </div>
            )}

            {!showCc && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground"
                onClick={() => setShowCc(true)}
              >
                + Cc
              </Button>
            )}

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Write your message..."
                className="min-h-[200px] resize-none"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" disabled title="Attachments coming soon">
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSaveDraft} disabled={saveDraftMutation.isPending}>
              Save Draft
            </Button>
            <Button onClick={handleSend} disabled={isSending || sendMutation.isPending}>
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {replyToId ? "Send Reply" : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
