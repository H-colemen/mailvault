import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import {
  Shield,
  Users,
  Mail,
  Globe,
  Inbox,
  Send,
  AlertTriangle,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: number | string;
  icon: typeof Users;
  description?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/");
    }
  }, [authLoading, isAdmin, navigate]);

  const { data: stats } = trpc.admin.stats.useQuery(undefined, {
    enabled: isAdmin,
  });

  const { data: usersData } = trpc.admin.users.useQuery(
    { page: 1, pageSize: 10 },
    { enabled: isAdmin }
  );

  const { data: webhookData } = trpc.admin.webhookLogs.useQuery(
    { page: 1, pageSize: 10 },
    { enabled: isAdmin }
  );

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          <Badge variant="secondary">Admin</Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value={stats?.users || 0}
            icon={Users}
            description="Registered accounts"
          />
          <StatCard
            title="Total Emails"
            value={stats?.emails || 0}
            icon={Mail}
            description="All emails processed"
          />
          <StatCard
            title="Domains"
            value={stats?.domains || 0}
            icon={Globe}
            description="Custom domains"
          />
          <StatCard
            title="Mailboxes"
            value={stats?.mailboxes || 0}
            icon={Inbox}
            description="Email addresses"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Inbound"
            value={stats?.inboundEmails || 0}
            icon={Inbox}
          />
          <StatCard
            title="Outbound"
            value={stats?.outboundEmails || 0}
            icon={Send}
          />
          <StatCard
            title="Unread"
            value={stats?.unreadEmails || 0}
            icon={AlertTriangle}
          />
        </div>

        {/* Recent Users */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Recent Users
              </CardTitle>
              <CardDescription>Recently registered users</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {usersData?.users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                          {(user.name || user.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                          {user.role}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {user.createdAt
                            ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!usersData?.users || usersData.users.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No users yet
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Webhook Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Webhook Activity
              </CardTitle>
              <CardDescription>Recent webhook events</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {webhookData?.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {log.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{log.provider}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.eventType || "inbound_email"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={log.success ? "default" : "destructive"}
                          className="text-[10px]"
                        >
                          {log.success ? "Success" : "Failed"}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {log.createdAt
                            ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!webhookData?.logs || webhookData.logs.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No webhook activity yet
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              System Health
            </CardTitle>
            <CardDescription>Current system status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">API Server</p>
                  <p className="text-xs text-muted-foreground">Running</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Database</p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Uptime</p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date())}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
