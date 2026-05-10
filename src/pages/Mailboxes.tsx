import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Mail,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Copy,
  AtSign,
  Infinity,
} from "lucide-react";

export default function Mailboxes() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [name, setName] = useState("");
  const [isAlias, setIsAlias] = useState(false);
  const [forwardTo, setForwardTo] = useState("");

  const utils = trpc.useUtils();

  const { data: mailboxes, isLoading } = trpc.mailbox.list.useQuery();
  const { data: domains } = trpc.domain.list.useQuery();

  const createMutation = trpc.mailbox.create.useMutation({
    onSuccess: () => {
      utils.mailbox.list.invalidate();
      setShowAddDialog(false);
      resetForm();
      toast.success("Mailbox created successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create mailbox");
    },
  });

  const toggleActiveMutation = trpc.mailbox.toggleActive.useMutation({
    onSuccess: () => {
      utils.mailbox.list.invalidate();
      toast.success("Mailbox status updated");
    },
  });

  const deleteMutation = trpc.mailbox.delete.useMutation({
    onSuccess: () => {
      utils.mailbox.list.invalidate();
      toast.success("Mailbox deleted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete mailbox");
    },
  });

  const resetForm = () => {
    setSelectedDomain("");
    setLocalPart("");
    setName("");
    setIsAlias(false);
    setForwardTo("");
  };

  const handleCreate = () => {
    if (!selectedDomain || !localPart) {
      toast.error("Please select a domain and enter a local part");
      return;
    }
    createMutation.mutate({
      domainId: selectedDomain,
      localPart,
      name: name || localPart,
      isAlias,
      forwardTo: forwardTo || undefined,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Mailboxes</h1>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Mailbox
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !mailboxes || mailboxes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AtSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No mailboxes yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Create your first email address
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Mailbox
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {mailboxes.map((mailbox) => (
              <Card key={mailbox.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        {mailbox.isCatchAll ? (
                          <Infinity className="h-5 w-5 text-primary" />
                        ) : (
                          <Mail className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{mailbox.address}</span>
                          {mailbox.active ? (
                            <Badge variant="default" className="bg-green-600 text-[10px]">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                          {mailbox.isCatchAll && (
                            <Badge variant="outline" className="text-[10px]">Catch-all</Badge>
                          )}
                          {mailbox.isAlias && (
                            <Badge variant="outline" className="text-[10px]">Alias</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{mailbox.name}</p>
                        {mailbox.forwardTo && (
                          <p className="text-xs text-muted-foreground">
                            Forwards to: {mailbox.forwardTo}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(mailbox.address)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={mailbox.active}
                        onCheckedChange={() => toggleActiveMutation.mutate({ id: mailbox.id })}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this mailbox?")) {
                            deleteMutation.mutate({ id: mailbox.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Mailbox Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Mailbox</DialogTitle>
            <DialogDescription>
              Create a new email address for your domain
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Domain</Label>
              <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                <SelectTrigger>
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  {domains?.map((domain) => (
                    <SelectItem key={domain.id} value={domain.id}>
                      {domain.domainName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="localPart">Email Address</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="localPart"
                  placeholder="hello"
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value)}
                />
                <span className="text-muted-foreground shrink-0">
                  @{domains?.find((d) => d.id === selectedDomain)?.domainName || "domain.com"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Display Name (optional)</Label>
              <Input
                id="name"
                placeholder="Support Team"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={isAlias} onCheckedChange={setIsAlias} id="alias" />
              <Label htmlFor="alias">This is an alias</Label>
            </div>

            {isAlias && (
              <div className="space-y-2">
                <Label htmlFor="forwardTo">Forward To</Label>
                <Input
                  id="forwardTo"
                  type="email"
                  placeholder="your@email.com"
                  value={forwardTo}
                  onChange={(e) => setForwardTo(e.target.value)}
                />
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Mailbox
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
