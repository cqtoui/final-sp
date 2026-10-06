// @ts-nocheck

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Checkbox } from "@/components/ui/checkbox";

import {
  Camera,
  Loader2,
  Upload,
  User,
  X,
} from "lucide-react";

import { toast } from "sonner";


const DEPARTMENTS = [
  {
    value: "assembly",
    label: "Assembly",
  },
  {
    value: "electrical",
    label: "Electrical",
  },
  {
    value: "warehouse",
    label: "Warehouse",
  },
  {
    value: "chemical_lab",
    label: "Chemical Lab",
  },
  {
    value: "maintenance",
    label: "Maintenance",
  },
];


const GEAR_OPTIONS = [
  "helmet",
  "goggles",
  "safety_vest",
  "gloves",
  "ear_protection",
  "lab_coat",
];


const DEFAULT_REQUIRED_GEAR = [
  "helmet",
  "goggles",
  "safety_vest",
  "gloves",
];


const EMPTY_FORM = {
  full_name: "",
  employee_id: "",
  department: "warehouse",
  status: "active",
  required_gear:
    DEFAULT_REQUIRED_GEAR,
  photo_url: "",
  photo_file: null,
};


export default function WorkerFormDialog({
  worker,
  open,
  onOpenChange,
  onSave,
  saving,
}) {
  const [form, setForm] =
    useState(EMPTY_FORM);

  const [
    cameraOpen,
    setCameraOpen,
  ] = useState(false);

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);


  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject =
        null;
    }

    setCameraOpen(false);
  };


  const clearLocalPreview = () => {
    if (
      previewUrl &&
      previewUrl.startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        previewUrl
      );
    }
  };


  useEffect(() => {
    clearLocalPreview();

    const workerGear =
      Array.isArray(
        worker?.required_gear
      )
        ? worker.required_gear
        : DEFAULT_REQUIRED_GEAR;

    setForm({
      full_name:
        worker?.full_name || "",

      employee_id:
        worker?.employee_id || "",

      department:
        worker?.department ||
        "warehouse",

      status:
        worker?.status || "active",

      required_gear:
        workerGear.filter(
          (gear) =>
            ![
              "steel_toe_boots",
              "respirator",
              "face_shield",
            ].includes(gear)
        ),

      photo_url:
        worker?.photo_url || "",

      photo_file: null,
    });

    setPreviewUrl(
      worker?.photo_url || ""
    );

    setCameraOpen(false);
  }, [worker, open]);


  useEffect(() => {
    if (!open) {
      stopStream();
    }
  }, [open]);


  useEffect(() => {
    return () => {
      stopStream();
      clearLocalPreview();
    };
  }, []);


  const setPhotoFile = (
    file
  ) => {
    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      toast.error(
        "Please choose an image file."
      );

      return;
    }

    clearLocalPreview();

    const localPreview =
      URL.createObjectURL(file);

    setPreviewUrl(
      localPreview
    );

    setForm((previous) => ({
      ...previous,
      photo_file: file,
    }));
  };


  const openCamera =
    async () => {
      setCameraOpen(true);

      setTimeout(
        async () => {
          try {
            const stream =
              await navigator.mediaDevices.getUserMedia(
                {
                  video: {
                    facingMode:
                      "user",

                    width: {
                      ideal: 1280,
                    },

                    height: {
                      ideal: 720,
                    },
                  },

                  audio: false,
                }
              );

            streamRef.current =
              stream;

            if (
              videoRef.current
            ) {
              videoRef.current.srcObject =
                stream;

              await videoRef.current.play();
            }
          } catch (error) {
            console.error(
              error
            );

            toast.error(
              "Could not access the camera."
            );

            setCameraOpen(false);
          }
        },
        100
      );
    };


  const captureSnapshot =
    async () => {
      const video =
        videoRef.current;

      if (
        !video ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        toast.error(
          "The camera is not ready yet."
        );

        return;
      }

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        video.videoWidth;

      canvas.height =
        video.videoHeight;

      const context =
        canvas.getContext("2d");

      if (!context) {
        toast.error(
          "Could not capture the image."
        );

        return;
      }

      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const blob =
        await new Promise(
          (resolve) => {
            canvas.toBlob(
              resolve,
              "image/jpeg",
              0.95
            );
          }
        );

      if (!blob) {
        toast.error(
          "Could not create the photo."
        );

        return;
      }

      const file =
        new File(
          [blob],
          `worker-${Date.now()}.jpg`,
          {
            type: "image/jpeg",
          }
        );

      setPhotoFile(file);
      stopStream();

      toast.success(
        "Photo captured."
      );
    };


  const handleFileUpload = (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (file) {
      setPhotoFile(file);
    }

    event.target.value = "";
  };


  const removePhoto = () => {
    clearLocalPreview();

    setPreviewUrl("");

    setForm((previous) => ({
      ...previous,
      photo_file: null,
      photo_url: "",
    }));
  };


  const toggleGear = (
    gear
  ) => {
    setForm((previous) => ({
      ...previous,

      required_gear:
        previous.required_gear.includes(
          gear
        )
          ? previous.required_gear.filter(
              (item) =>
                item !== gear
            )
          : [
              ...previous.required_gear,
              gear,
            ],
    }));
  };


  const handleSubmit = () => {
    if (
      !form.full_name.trim()
    ) {
      toast.error(
        "Enter the worker's full name."
      );

      return;
    }

    if (
      !form.employee_id.trim()
    ) {
      toast.error(
        "Enter the employee ID."
      );

      return;
    }

    if (
      !worker &&
      !form.photo_file
    ) {
      toast.error(
        "A face photo is required for a new worker."
      );

      return;
    }

    if (
      worker &&
      !form.photo_file &&
      !form.photo_url
    ) {
      toast.error(
        "A face photo is required."
      );

      return;
    }

    onSave({
      ...form,

      full_name:
        form.full_name.trim(),

      employee_id:
        form.employee_id.trim(),
    });
  };


  const photoToDisplay =
    previewUrl ||
    form.photo_url;


  return (
    <Dialog
      open={open}
      onOpenChange={
        onOpenChange
      }
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {worker
              ? "Edit Worker"
              : "Add Worker"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              Face Recognition Photo

              <span className="text-[10px] text-amber-600 font-normal bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                Required for face ID
              </span>
            </Label>

            {cameraOpen ? (
              <div className="space-y-2">
                <div className="relative rounded-xl overflow-hidden bg-black w-full aspect-video border">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 h-full w-full origin-center object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={
                      captureSnapshot
                    }
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={
                      stopStream
                    }
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-3 rounded-xl border bg-muted/30">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                  {photoToDisplay ? (
                    <img
                      src={
                        photoToDisplay
                      }
                      alt="Worker"
                      className="w-full h-full object-cover"
                      onError={(
                        event
                      ) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />
                  ) : (
                    <User className="w-8 h-8 text-muted-foreground/30" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Use a clear,
                    front-facing photo
                    with one visible face.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={
                        openCamera
                      }
                    >
                      <Camera className="w-3.5 h-3.5 mr-1.5" />
                      Webcam
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Upload
                    </Button>

                    {photoToDisplay && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={
                          removePhoto
                        }
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>

                  <input
                    ref={
                      fileInputRef
                    }
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={
                      handleFileUpload
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Full Name
            </Label>

            <Input
              value={
                form.full_name
              }
              onChange={(event) =>
                setForm(
                  (previous) => ({
                    ...previous,
                    full_name:
                      event.target.value,
                  })
                )
              }
              placeholder="John Smith"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Employee ID
            </Label>

            <Input
              value={
                form.employee_id
              }
              onChange={(event) =>
                setForm(
                  (previous) => ({
                    ...previous,
                    employee_id:
                      event.target.value,
                  })
                )
              }
              placeholder="EMP-001"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Department
              </Label>

              <Select
                value={
                  form.department
                }
                onValueChange={(
                  value
                ) =>
                  setForm(
                    (previous) => ({
                      ...previous,
                      department:
                        value,
                    })
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {DEPARTMENTS.map(
                    (department) => (
                      <SelectItem
                        key={
                          department.value
                        }
                        value={
                          department.value
                        }
                      >
                        {
                          department.label
                        }
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Status
              </Label>

              <Select
                value={
                  form.status
                }
                onValueChange={(
                  value
                ) =>
                  setForm(
                    (previous) => ({
                      ...previous,
                      status:
                        value,
                    })
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="active">
                    Active
                  </SelectItem>

                  <SelectItem value="inactive">
                    Inactive
                  </SelectItem>

                  <SelectItem value="suspended">
                    Suspended
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Required Gear
            </Label>

            <div className="grid grid-cols-2 gap-2">
              {GEAR_OPTIONS.map(
                (gear) => (
                  <label
                    key={gear}
                    className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={
                        form.required_gear.includes(
                          gear
                        )
                      }
                      onCheckedChange={() =>
                        toggleGear(
                          gear
                        )
                      }
                    />

                    <span className="text-sm capitalize">
                      {gear.replaceAll(
                        "_",
                        " "
                      )}
                    </span>
                  </label>
                )
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onOpenChange(
                false
              )
            }
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={
              handleSubmit
            }
            disabled={saving}
          >
            {saving && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}

            {worker
              ? "Update Worker"
              : "Add Worker"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}