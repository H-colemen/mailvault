import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Globe,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  Copy,
  Mail,
} from "lucide-react";

export default function Domains() {
  const [newDomain, setNewDomain] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDnsDialog, setShowDnsDialog] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: domains, isLoading } = trpc.domain.list.useQuery();

  const createMutation = trpc.domain.create.useMutation({
    onSuccess: () => {
      utils.domain.list.invalidate();
      setShowAddDialog(false);
      setNewDomain("");
      toast.success("Domain added successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add domain");
    },
  });

  const verifyMutation = trpc.domain.verify.useMutation({
    onSuccess: () => {
      utils.domain.list.invalidate();
      toast.success("Domain verified");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to verify domain");
    },
  });

  const deleteMutation = trpc.domain.delete.useMutation({
    onSuccess: () => {
      utils.domain.list.invalidate();
      toast.success("Domain deleted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete domain");
    },
  });

  const handleAddDomain = () => {
    if (!newDomain || !newDomain.includes(".")) {
      toast.error("Please enter a valid domain name");
      return;
    }
    createMutation.mutate({ domainName: newDomain });
  };

  const handleShowDns = (domainId: string) => {
    setSelectedDomain(domainId);
    setShowDnsDialog(true);
  };

  const domain = domains?.find((d) => d.id === selectedDomain);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Domains</h1>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Domain
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
        ) : !domains || domains.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No domains yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Add your first custom domain to start receiving emails
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Domain
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {domains.map((domain) => (
              <Card key={domain.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{domain.domainName}</CardTitle>
                      {domain.verified ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      {domain.isDefault && (
                        <Badge variant="outline">Default</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShowDns(domain.id)}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        DNS
                      </Button>
                      {!domain.verified && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => verifyMutation.mutate({ id: domain.id })}
                          disabled={verifyMutation.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Verify
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this domain?")) {
                            deleteMutation.mutate({ id: domain.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    {domain.mailboxes?.length || 0} mailboxes configured
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${domain.mxConfigured ? "bg-green-500" : "bg-yellow-500"}`} />
                      <span className="text-muted-foreground">MX</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${domain.spfConfigured ? "bg-green-500" : "bg-yellow-500"}`} />
                      <span className="text-muted-foreground">SPF</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${domain.dkimConfigured ? "bg-green-500" : "bg-yellow-500"}`} />
                      <span className="text-muted-foreground">DKIM</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${domain.dmarcConfigured ? "bg-green-500" : "bg-yellow-500"}`} />
                      <span className="text-muted-foreground">DMARC</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Domain Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Domain</DialogTitle>
            <DialogDescription>
              Enter your domain name to start receiving emails
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain Name</Label>
              <Input
                id="domain"
                placeholder="example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleAddDomain}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Domain
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DNS Settings Dialog */}
      <Dialog open={showDnsDialog} onOpenChange={setShowDnsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>DNS Records for {domain?.domainName}</DialogTitle>
            <DialogDescription>
              Add these records to your DNS provider to enable email routing
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  MX Record
                </Label>
                <div className="bg-muted p-3 rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-mono">MX</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-mono">@</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Priority:</span>
                    <span className="font-mono">10</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">Value:</span>
                    <code className="text-xs bg-background px-2 py-1 rounded flex items-center gap-2">
                      route1.mx.cloudflare.net
                      <Copy
                        className="h-3 w-3 cursor-pointer hover:text-primary"
                        onClick={() => copyToClipboard("route1.mx.cloudflare.net")}
                      />
                    </code>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  SPF Record
                </Label>
                <div className="bg-muted p-3 rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-mono">TXT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-mono">@</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">Value:</span>
                    <code className="text-xs bg-background px-2 py-1 rounded flex items-center gap-2">
                      v=spf1 include:_spf.cloudflare.net ~all
                      <Copy
                        className="h-3 w-3 cursor-pointer hover:text-primary"
                        onClick={() =>
                          copyToClipboard("v=spf1 include:_spf.cloudflare.net ~all")
                        }
                      />
                    </code>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  DMARC Record
                </Label>
                <div className="bg-muted p-3 rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-mono">TXT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-mono">_dmarc</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">Value:</span>
                    <code className="text-xs bg-background px-2 py-1 rounded flex items-center gap-2">
                      v=DMARC1; p=quarantine; rua=mailto:dmarc@{domain?.domainName}
                      <Copy
                        className="h-3 w-3 cursor-pointer hover:text-primary"
                        onClick={() =>
                          copyToClipboard(
                            `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain?.domainName}`
                          )
                        }
                      />
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
