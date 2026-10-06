import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Eye, EyeOff } from "lucide-react";
import { getAdminPassword, hasAdminPassword } from "@/lib/adminPassword";

export default function PasswordConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive,
}) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    setPassword("");
    setError("");
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (!hasAdminPassword()) {
      setError("Set an admin password in Settings before using this action.");
      return;
    }

    if (password === getAdminPassword()) {
      onConfirm();
      handleClose();
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="max-w-sm shadow-xl"
        overlayClassName="bg-slate-900/25"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4" /> {title || "Admin Confirmation Required"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {description || "Enter the admin password to continue."}
        </p>
        <form
          className="space-y-2"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            handleConfirm();
          }}
        >
          <input
            type="text"
            name="username"
            autoComplete="username"
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
          />
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              name="admin-password"
              autoComplete="new-password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className={error ? "border-red-500 pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden" : "pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={handleConfirm}>
            {confirmLabel || "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
