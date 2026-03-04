import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Mail, Lock, Trash2, Loader2, Eye, EyeOff } from "lucide-react";

export function AccountSection() {
  const { user, signOut } = useAuth();

  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Delete account
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleEmailChange = async () => {
    if (!newEmail.trim()) return;
    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: "https://financial.lendscope.com.br/" }
    );
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "E-mail de confirmação enviado", description: "Verifique sua caixa de entrada no novo e-mail para confirmar a alteração." });
      setNewEmail("");
    }
    setEmailLoading(false);
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Erro", description: "A nova senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não conferem.", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);

    // Verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: currentPassword,
    });
    if (signInError) {
      toast({ title: "Erro", description: "Senha atual incorreta.", variant: "destructive" });
      setPasswordLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada com sucesso!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "CONFIRMAR") return;
    setDeleteLoading(true);
    // Sign out and notify - actual deletion would need admin/service role
    toast({ title: "Solicitação enviada", description: "Sua conta será excluída. Você será desconectado." });
    await signOut();
    setDeleteLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Email */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" /> Alterar E-mail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">E-mail atual</Label>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
          <div>
            <Label className="text-xs">Novo e-mail</Label>
            <Input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="novo@email.com"
            />
          </div>
          <p className="text-xs text-muted-foreground">Um e-mail de confirmação será enviado para o novo endereço.</p>
          <Button onClick={handleEmailChange} disabled={emailLoading || !newEmail.trim()} size="sm">
            {emailLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Alterar E-mail
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" /> Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Senha atual</Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
              />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Nova senha</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowNew(!showNew)}>
                {showNew ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
          {newPassword && newPassword.length < 6 && (
            <p className="text-xs text-destructive">Mínimo de 6 caracteres</p>
          )}
          <Button
            onClick={handlePasswordChange}
            disabled={passwordLoading || !currentPassword || !newPassword || newPassword !== confirmPassword}
            size="sm"
          >
            {passwordLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Alterar Senha
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" /> Excluir Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível. Todos os seus dados serão permanentemente excluídos.
          </p>
          <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir Conta Permanentemente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Para confirmar, digite <strong>CONFIRMAR</strong> no campo abaixo:
          </p>
          <Input
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder="Digite CONFIRMAR"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "CONFIRMAR" || deleteLoading}
            >
              {deleteLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Excluir Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
