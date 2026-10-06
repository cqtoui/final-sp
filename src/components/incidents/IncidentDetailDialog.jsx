// @ts-nocheck

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { format } from "date-fns";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ImageOff,
  MapPin,
  UserRound,
  Building2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { withApiKey } from "@/api/config";


function ensureArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch (_) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}


function formatIncidentDate(value) {
  if (!value) {
    return "—";
  }

  try {
    const date = new Date(value);

    if (
      Number.isNaN(date.getTime())
    ) {
      return "—";
    }

    return format(
      date,
      "MMM d, yyyy HH:mm"
    );
  } catch (_) {
    return "—";
  }
}


function normalizeScreenshotUrl(value) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  const trimmedValue =
    value.trim();

  if (!trimmedValue) {
    return "";
  }

  if (
    trimmedValue.startsWith(
      "blob:"
    )
  ) {
    return trimmedValue;
  }

  const backendBaseUrl =
    import.meta.env.VITE_API_URL ||
    "";

  if (
    trimmedValue.startsWith(
      "http://"
    ) ||
    trimmedValue.startsWith(
      "https://"
    )
  ) {
    return withApiKey(
      trimmedValue
    );
  }

  if (
    trimmedValue.startsWith("/")
  ) {
    return withApiKey(
      backendBaseUrl +
      trimmedValue
    );
  }

  return withApiKey(
    `${backendBaseUrl}/uploads/` +
    trimmedValue
  );
}


export default function IncidentDetailDialog({
  incident,
  open,
  onOpenChange,
}) {
  const [
    imageFailed,
    setImageFailed,
  ] = useState(false);

  useEffect(() => {
    if (open) {
      setImageFailed(false);
    }
  }, [
    open,
    incident?.id,
    incident?.screenshot_url,
  ]);

  const missingGear =
    useMemo(() => {
      return ensureArray(
        incident?.missing_gear
      );
    }, [incident?.missing_gear]);

  const detectedGear =
    useMemo(() => {
      return ensureArray(
        incident?.detected_gear
      );
    }, [incident?.detected_gear]);

  const screenshotUrl =
    useMemo(() => {
      return normalizeScreenshotUrl(
        incident?.screenshot_url
      );
    }, [incident?.screenshot_url]);

  if (!incident) {
    return null;
  }

  const incidentDate =
    incident.incident_time ||
    incident.created_date ||
    incident.created_at ||
    incident.date;

  const isOldBlobUrl =
    screenshotUrl.startsWith(
      "blob:"
    );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Incident Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                <UserRound className="h-3.5 w-3.5" />
                Worker
              </p>

              <p className="font-semibold text-sm">
                {incident.worker_name ||
                  "Unknown Worker"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                <Building2 className="h-3.5 w-3.5" />
                Department
              </p>

              <p className="font-semibold text-sm capitalize">
                {String(
                  incident.department ||
                    "—"
                ).replaceAll(
                  "_",
                  " "
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                <MapPin className="h-3.5 w-3.5" />
                Entry Point
              </p>

              <p className="font-semibold text-sm">
                {incident.entry_point ||
                  "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                <Clock3 className="h-3.5 w-3.5" />
                Time
              </p>

              <p className="font-semibold text-sm">
                {formatIncidentDate(
                  incidentDate
                )}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Missing Gear
            </p>

            <div className="flex flex-wrap gap-2">
              {missingGear.length > 0 ? (
                missingGear.map(
                  (gear, index) => (
                    <span
                      key={`missing-${String(
                        gear
                      )}-${index}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-600"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />

                      {String(gear)}
                    </span>
                  )
                )
              ) : (
                <span className="text-sm text-muted-foreground">
                  None
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Detected Gear
            </p>

            <div className="flex flex-wrap gap-2">
              {detectedGear.length > 0 ? (
                detectedGear.map(
                  (gear, index) => (
                    <span
                      key={`detected-${String(
                        gear
                      )}-${index}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-600"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />

                      {String(gear)}
                    </span>
                  )
                )
              ) : (
                <span className="text-sm text-muted-foreground">
                  None detected
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs text-muted-foreground">
                Screenshot
              </p>

              {screenshotUrl &&
                !imageFailed &&
                !isOldBlobUrl && (
                  <a
                    href={screenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open full image

                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
            </div>

            {screenshotUrl &&
            !imageFailed &&
            !isOldBlobUrl ? (
              <a
                href={screenshotUrl}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <img
                  src={screenshotUrl}
                  alt="Incident screenshot"
                  className="w-full max-h-[420px] rounded-lg border bg-muted object-contain"
                  onError={() => {
                    setImageFailed(true);
                  }}
                />
              </a>
            ) : (
              <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border bg-muted/40 px-4 text-center text-muted-foreground">
                <ImageOff className="mb-2 h-8 w-8" />

                <p className="text-sm font-medium">
                  Screenshot is unavailable
                </p>

                {isOldBlobUrl ? (
                  <p className="mt-1 max-w-sm text-xs">
                    This older incident used
                    a temporary browser image
                    URL. Temporary blob URLs
                    cannot be reopened after
                    the page is refreshed.
                  </p>
                ) : imageFailed ? (
                  <p className="mt-1 max-w-sm text-xs">
                    The saved image URL could
                    not be loaded. Confirm that
                    the FastAPI backend is
                    running and that the file
                    still exists in the uploads
                    folder.
                  </p>
                ) : (
                  <p className="mt-1 max-w-sm text-xs">
                    No screenshot URL was saved
                    for this incident.
                  </p>
                )}
              </div>
            )}
          </div>

          {incident.notes && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Notes
              </p>

              <p className="text-sm">
                {incident.notes}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}