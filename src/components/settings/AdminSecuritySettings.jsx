import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Eye, EyeOff, User, CheckCircle2, XCircle, KeyRound } from "lucide-react";
import {
  getAdminPassword,
  hasAdminPassword,
  setAdminPassword,
} from "@/lib/adminPassword";

function getStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const strengthLabels = ["", "Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
const strengthColors = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-blue-500", "bg-emerald-500"];
const strengthTextColors = ["", "text-red-500", "text-orange-400", "text-yellow-500", "text-blue-500", "text-emerald-600"];

const requirements = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "Uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "Lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { label: "Number (0–9)", test: (p) => /[0-9]/.test(p) },
  { label: "Special character (!@#$...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

// ── View Password Panel ────────────────────────────────────────────────────────
function ViewPasswordPanel({ onClose }) {
  const [verifyPw, setVerifyPw] = useState("");
  const [showVerify, setShowVerify] = useState(false);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [showRevealed, setShowRevealed] = useState(false);

  const handleVerify = () => {
    if (!hasAdminPassword()) {
      setError("No admin password is set yet. Use Change Password to create one.");
      return;
    }
    if (verifyPw === getAdminPassword()) {
      setRevealed(true);
      setError("");
    } else {
      setError("Incorrect password.");
    }
  };

  if (revealed) {
    return (
      <div className="mt-4 p-4 rounded-lg border bg-muted/40 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Password</p>
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-white font-mono text-sm tracking-widest">
          <span className="flex-1">{showRevealed ? getAdminPassword() : "•".repeat(getAdminPassword().length || 8)}</span>
          <button type="button" onClick={() => setShowRevealed(!showRevealed)} className="text-muted-foreground hover:text-foreground">
            {showRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={onClose} className="w-full">Close</Button>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-lg border bg-muted/40 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Verify Identity</p>
      <p className="text-xs text-muted-foreground">Enter your admin password to reveal the stored password.</p>
      <div className="relative">
        <Input
          type={showVerify ? "text" : "password"}
          placeholder="Enter admin password"
          value={verifyPw}
          onChange={(e) => { setVerifyPw(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          className={error ? "border-red-400 pr-10" : "pr-10"}
        />
        <button type="button" onClick={() => setShowVerify(!showVerify)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {showVerify ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleVerify} size="sm" className="flex-1">Verify</Button>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Change Password Panel ──────────────────────────────────────────────────────
const APP_VERSION = "1.0.0";

function ChangePasswordPanel({ onClose, skipCurrentPassword = false }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const strength = getStrength(newPw);
  const allRequirementsMet = requirements.every((r) => r.test(newPw));
  const requireCurrent = hasAdminPassword() && !skipCurrentPassword;

  const handleSave = () => {
    const errs = {};
    if (requireCurrent && !currentPw) errs.current = "Current password is required.";
    else if (requireCurrent && currentPw !== getAdminPassword()) errs.current = "Incorrect current password.";
    if (!newPw) errs.new = "New password is required.";
    else if (!allRequirementsMet) errs.new = "New password does not meet all requirements.";
    if (!confirmPw) errs.confirm = "Please confirm your new password.";
    else if (newPw !== confirmPw) errs.confirm = "Passwords do not match.";

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setAdminPassword(newPw);
    setSuccess(true);
    setTimeout(() => { setSuccess(false); onClose(); }, 2500);
  };

  if (success) {
    return (
      <div className="mt-4 p-4 rounded-lg border bg-emerald-50 border-emerald-200 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <span className="text-sm text-emerald-700 font-medium">Password updated successfully!</span>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-lg border bg-muted/40 space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {skipCurrentPassword ? "Set a new password" : "Change Password"}
      </p>

      {/* Current Password */}
      {requireCurrent && (
      <div className="space-y-1">
        <label className="text-xs font-medium">Current Password</label>
        <div className="relative">
          <Input
            type={showCurrent ? "text" : "password"}
            placeholder="Enter current password"
            value={currentPw}
            onChange={(e) => { setCurrentPw(e.target.value); setErrors((p) => ({ ...p, current: undefined })); }}
            className={errors.current ? "border-red-400 pr-10" : "pr-10"}
          />
          <button type="button" onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.current && <p className="text-xs text-red-500">{errors.current}</p>}
      </div>
      )}

      {/* New Password */}
      <div className="space-y-1">
        <label className="text-xs font-medium">New Password</label>
        <div className="relative">
          <Input
            type={showNew ? "text" : "password"}
            placeholder="Enter new password"
            value={newPw}
            onChange={(e) => { setNewPw(e.target.value); setErrors((p) => ({ ...p, new: undefined })); }}
            className={errors.new ? "border-red-400 pr-10" : "pr-10"}
          />
          <button type="button" onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.new && <p className="text-xs text-red-500">{errors.new}</p>}

        {newPw.length > 0 && (
          <>
            <div className="space-y-1.5 mt-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? strengthColors[strength] : "bg-muted"}`} />
                ))}
              </div>
              <p className={`text-xs font-medium ${strengthTextColors[strength]}`}>{strengthLabels[strength]}</p>
            </div>
            <div className="mt-2 space-y-1">
              {requirements.map((req) => {
                const met = req.test(newPw);
                return (
                  <div key={req.label} className="flex items-center gap-2">
                    {met ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    <span className={`text-xs ${met ? "text-emerald-600" : "text-muted-foreground"}`}>{req.label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Confirm Password */}
      <div className="space-y-1">
        <label className="text-xs font-medium">Confirm New Password</label>
        <div className="relative">
          <Input
            type={showConfirm ? "text" : "password"}
            placeholder="Re-enter new password"
            value={confirmPw}
            onChange={(e) => { setConfirmPw(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })); }}
            className={errors.confirm ? "border-red-400 pr-10" : "pr-10"}
          />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.confirm && <p className="text-xs text-red-500">{errors.confirm}</p>}
        {confirmPw.length > 0 && newPw === confirmPw && !errors.confirm && (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} size="sm" className="flex-1">Save Changes</Button>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Forgot Password Panel ─────────────────────────────────────────────────────
function ForgotPasswordPanel({ onClose }) {
  const [version, setVersion] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = () => {
    if (version.trim() === APP_VERSION) {
      setVerified(true);
      setError("");
      return;
    }
    setError("Incorrect version number.");
  };

  if (verified) {
    return <ChangePasswordPanel onClose={onClose} skipCurrentPassword />;
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        Password recovery
      </p>
      <p className="text-xs text-muted-foreground">
        Confirm you are the admin by entering the app version from Settings → System Info.
        After that you can set a new password without the previous one.
      </p>
      <Input
        type="text"
        placeholder="x.x.x"
        value={version}
        onChange={(event) => {
          setVersion(event.target.value);
          setError("");
        }}
        onKeyDown={(event) => event.key === "Enter" && handleVerify()}
        className={error ? "border-red-400 bg-white" : "bg-white"}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleVerify} size="sm" className="flex-1">
          Verify
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminSecuritySettings() {
  const [panel, setPanel] = useState(null); // null | "view" | "change" | "forgot"

  return (
    <Card className="flex h-full flex-col border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Lock className="w-4 h-4" /> Admin Security Settings
        </CardTitle>
        <CardDescription className="text-xs">Manage admin account credentials</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Username */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Username</label>
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">SafeGuard Admin</span>
            <span className="ml-auto text-xs text-muted-foreground italic">Non-editable</span>
          </div>
        </div>

        {/* Password row */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
            <KeyRound className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-mono tracking-widest flex-1">••••••••</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPanel(panel === "view" ? null : "view")}
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" /> View Password
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPanel(panel === "change" ? null : "change")}
              >
                <Lock className="w-3.5 h-3.5 mr-1.5" /> Change Password
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPanel(panel === "forgot" ? null : "forgot")}
            className="text-xs text-primary hover:underline self-start"
          >
            Forgot Password?
          </button>
        </div>

        {/* Expandable panels */}
        {panel === "view" && <ViewPasswordPanel onClose={() => setPanel(null)} />}
        {panel === "change" && <ChangePasswordPanel onClose={() => setPanel(null)} />}
        {panel === "forgot" && <ForgotPasswordPanel onClose={() => setPanel(null)} />}
      </CardContent>
    </Card>
  );
}