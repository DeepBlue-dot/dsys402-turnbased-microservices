"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { playerApi } from "@/lib/api";
import { clearToken } from "@/lib/session";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
  const router = useRouter();
  const { loading, player, refreshUser, user } = useAuth();
  const [profile, setProfile] = useState({
    username: "",
    avatarUrl: "",
    bio: "",
  });
  const [email, setEmail] = useState("");
  const [passwords, setPasswords] = useState({
    oldPassword: "",
    newPassword: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!player) return;

    setProfile({
      username: player.profile?.username || "",
      avatarUrl: player.profile?.avatarUrl || "",
      bio: player.profile?.bio || "",
    });
    setEmail(player.email || "");
  }, [player]);

  async function runSave(action: () => Promise<unknown>, success: string) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await action();
      await refreshUser();
      setMessage(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Settings update failed.");
    } finally {
      setSaving(false);
    }
  }

  function deleteAccount() {
    const confirmed = window.confirm(
      "Delete this account permanently? This cannot be undone.",
    );
    if (!confirmed) return;

    void runSave(async () => {
      await playerApi.deleteMe();
      clearToken();
      router.push("/");
    }, "Account deleted.");
  }

  if (loading || !user) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <p className="animate-pulse text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and account.</p>
      </div>

      {message && (
        <div className="rounded-md border border-green-400/30 bg-green-400/10 px-4 py-3 text-sm text-green-300">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void runSave(
                  () =>
                    playerApi.updateProfile({
                      username: profile.username || undefined,
                      avatarUrl: profile.avatarUrl,
                      bio: profile.bio || undefined,
                    }),
                  "Profile updated.",
                );
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={profile.username}
                  onChange={(event) =>
                    setProfile({ ...profile, username: event.target.value })
                  }
                  minLength={3}
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input
                  id="avatarUrl"
                  value={profile.avatarUrl}
                  onChange={(event) =>
                    setProfile({ ...profile, avatarUrl: event.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Input
                  id="bio"
                  value={profile.bio}
                  onChange={(event) =>
                    setProfile({ ...profile, bio: event.target.value })
                  }
                  maxLength={200}
                />
              </div>
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" aria-hidden="true" />
                Save Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runSave(
                    () => playerApi.updateEmail({ email }),
                    "Email updated.",
                  );
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save Email
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runSave(
                    () => playerApi.updatePassword(passwords),
                    "Password updated.",
                  );
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="oldPassword">Current Password</Label>
                  <Input
                    id="oldPassword"
                    type="password"
                    value={passwords.oldPassword}
                    onChange={(event) =>
                      setPasswords({
                        ...passwords,
                        oldPassword: event.target.value,
                      })
                    }
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwords.newPassword}
                    onChange={(event) =>
                      setPasswords({
                        ...passwords,
                        newPassword: event.target.value,
                      })
                    }
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={deleteAccount} disabled={saving}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
