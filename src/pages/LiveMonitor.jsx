// @ts-nocheck

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { appClient } from "@/api/appClient";
import { calculateComplianceRate } from "@/lib/compliance";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Camera,
  CameraOff,
  AlertTriangle,
  CheckCircle,
  Shield,
  Video,
  Loader2,
  HardHat,
  Glasses,
  Shirt,
} from "lucide-react";

import DetectionGuide from "../components/monitor/DetectionGuide";
import WorkerScanPanel from "../components/monitor/WorkerScanPanel";

import { toast } from "sonner";

import BrandLogo from "../components/layout/BrandLogo";
import { API_BASE_URL, apiHeaders } from "@/api/config";


const BACKEND_BASE_URL = API_BASE_URL;

const BACKEND_SCAN_URL =
  `${BACKEND_BASE_URL}/api/scan`;

const SCAN_TIMEOUT_MS = 11500;



const IGNORED_GEAR_IDS = new Set([
  "steel_toe_boots",
  "respirator",
  "face_shield",
]);


const GEAR_DEFINITIONS = {
  helmet: {
    id: "helmet",
    label: "Helmet",
    icon: HardHat,
  },

  goggles: {
    id: "goggles",
    label: "Goggles",
    icon: Glasses,
  },

  safety_vest: {
    id: "safety_vest",
    label: "Safety Vest",
    icon: Shirt,
  },

  vest: {
    id: "safety_vest",
    label: "Safety Vest",
    icon: Shirt,
  },

  gloves: {
    id: "gloves",
    label: "Gloves",
    icon: Shield,
  },

  ear_protection: {
    id: "ear_protection",
    label: "Ear Protection",
    icon: Shield,
  },

  lab_coat: {
    id: "lab_coat",
    label: "Lab Coat",
    icon: Shirt,
  },
};


const DISPLAY_NAME_MAP = {
  helmet: "Helmet",
  hardhat: "Helmet",
  hard_hat: "Helmet",
  safety_helmet: "Helmet",

  goggles: "Goggles",
  goggle: "Goggles",
  safety_goggles: "Goggles",
  safety_glasses: "Goggles",

  safety_vest: "Safety Vest",
  vest: "Safety Vest",
  reflective_vest: "Safety Vest",

  gloves: "Gloves",
  glove: "Gloves",
  safety_gloves: "Gloves",

  ear_protection: "Ear Protection",
  earprotection: "Ear Protection",
  ear_muff: "Ear Protection",
  ear_muffs: "Ear Protection",
  earmuff: "Ear Protection",
  earmuffs: "Ear Protection",
  ear_plug: "Ear Protection",
  ear_plugs: "Ear Protection",
  earplug: "Ear Protection",
  earplugs: "Ear Protection",
  hearing_protection: "Ear Protection",
  hearingprotection: "Ear Protection",

  lab_coat: "Lab Coat",
  labcoat: "Lab Coat",
  lab_coats: "Lab Coat",
  labcoats: "Lab Coat",
};


function normalizeGearId(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}


function normalizeGearDisplay(value) {
  const normalizedValue =
    normalizeGearId(value);

  return (
    DISPLAY_NAME_MAP[normalizedValue] ||
    String(value || "")
  );
}


function toCanonicalGearId(value) {
  const normalizedValue = normalizeGearId(value);

  if (!normalizedValue || IGNORED_GEAR_IDS.has(normalizedValue)) {
    return "";
  }

  const definition = GEAR_DEFINITIONS[normalizedValue];
  if (definition?.id) {
    return definition.id;
  }

  const label = DISPLAY_NAME_MAP[normalizedValue];
  if (label) {
    const match = Object.values(GEAR_DEFINITIONS).find(
      (item) => item.label === label
    );
    if (match?.id) {
      return match.id;
    }
  }

  return "";
}


function uniqueRequiredGearIds(values) {
  const ids = [];

  for (const value of values || []) {
    const gearId = toCanonicalGearId(value);
    if (gearId && !ids.includes(gearId)) {
      ids.push(gearId);
    }
  }

  return ids;
}


function restrictGearToRequired(gearList, requiredIds) {
  const required = new Set(requiredIds || []);
  return uniqueRequiredGearIds(gearList).filter((gearId) =>
    required.has(gearId)
  );
}


function getScanOutcome(result) {
  const timedOut = Boolean(
    result.scan_timed_out ||
    result.ppe_status === "timeout" ||
    result.face_recognition_timed_out
  );
  const hasMissing = (result.missing_gear || []).length > 0;

  if (
    result.quality_rejected ||
    result.scan_failed ||
    result.ppe_status === "model_missing" ||
    result.ppe_status === "skipped_invalid_image"
  ) {
    return {
      title: "Scan could not complete",
      tone: "warning",
    };
  }

  if (result.compliant === true) {
    return {
      title: "Compliant",
      tone: "success",
    };
  }

  if (hasMissing) {
    return {
      title: "Violation detected",
      tone: "danger",
    };
  }

  if (timedOut) {
    return {
      title: "Scan incomplete",
      tone: "warning",
    };
  }

  return {
    title: "Scan complete",
    tone: "neutral",
  };
}


function getRequiredGearItems(requiredGearIds) {
  return requiredGearIds.map((gearId) => {
    const normalizedId =
      normalizeGearId(gearId);

    const definition =
      GEAR_DEFINITIONS[normalizedId];

    if (definition) {
      return definition;
    }

    return {
      id: normalizedId,
      label: normalizeGearDisplay(
        normalizedId
      ),
      icon: Shield,
    };
  });
}


let audioContext = null;


function getAudioContext() {
  if (!audioContext) {
    try {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      audioContext =
        new AudioContextClass();
    } catch (_) {
      return null;
    }
  }

  if (
    audioContext.state ===
    "suspended"
  ) {
    audioContext.resume();
  }

  return audioContext;
}


function playCorrectSound() {
  try {
    const audio = new Audio(
      "/sounds/correct.mp3"
    );
    audio.currentTime = 0;
    void audio.play();
  } catch (_) {}
}

function playScanResultSounds(
  result
) {
  if (
    !result ||
    result.quality_rejected ||
    result.scan_failed ||
    result.scan_timed_out ||
    result.ppe_status === "timeout" ||
    result.ppe_status === "model_missing" ||
    result.ppe_status === "skipped_invalid_image" ||
    result.ppe_status === "unavailable"
  ) {
    return;
  }

  if (
    Array.isArray(
      result.missing_gear
    ) &&
    result.missing_gear.length > 0
  ) {
    playDangerSound();
    return;
  }

  if (result.compliant === true) {
    playCorrectSound();
  }
}


function playDangerSound() {
  const context =
    getAudioContext();

  if (!context) {
    return;
  }

  try {
    const masterGain =
      context.createGain();

    masterGain.gain.setValueAtTime(
      1,
      context.currentTime
    );

    masterGain.connect(
      context.destination
    );

    for (
      let index = 0;
      index < 10;
      index += 1
    ) {
      const oscillator =
        context.createOscillator();

      const gain =
        context.createGain();

      oscillator.connect(gain);
      gain.connect(masterGain);

      oscillator.type = "square";

      oscillator.frequency.setValueAtTime(
        index % 2 === 0
          ? 1400
          : 900,
        context.currentTime +
          index * 0.2
      );

      gain.gain.setValueAtTime(
        0.8,
        context.currentTime +
          index * 0.2
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        context.currentTime +
          index * 0.2 +
          0.18
      );

      oscillator.start(
        context.currentTime +
          index * 0.2
      );

      oscillator.stop(
        context.currentTime +
          index * 0.2 +
          0.19
      );
    }
  } catch (_) {}
}


function ScanOverlay({
  scanning,
  scanResult,
  videoRef,
  containerRef,
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const displayBoxRef = useRef(null);
  const detectorRef = useRef(null);
  const detectedBoxRef = useRef(null);
  const lastDetectionRef = useRef(0);
  const sampleCanvasRef = useRef(null);
  const previousFrameRef = useRef(null);

  useEffect(() => {
    if ("FaceDetector" in window) {
      try {
        detectorRef.current =
          new window.FaceDetector({
            maxDetectedFaces: 1,
            fastMode: true,
          });
      } catch (_) {}
    }

    sampleCanvasRef.current =
      document.createElement(
        "canvas"
      );

    sampleCanvasRef.current.width =
      96;

    sampleCanvasRef.current.height =
      72;
  }, []);

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const lerp = (
      start,
      end,
      amount
    ) =>
      start +
      (end - start) *
        amount;

    const detectFace =
      async (now) => {
        const video =
          videoRef.current;

        if (
          !video ||
          video.readyState < 2
        ) {
          return;
        }

        if (
          now -
            lastDetectionRef.current <
          100
        ) {
          return;
        }

        lastDetectionRef.current =
          now;

        if (detectorRef.current) {
          try {
            const faces =
              await detectorRef.current.detect(
                video
              );

            if (faces.length > 0) {
              const {
                x,
                y,
                width,
                height,
              } =
                faces[0].boundingBox;

              const videoWidth =
                video.videoWidth ||
                video.clientWidth ||
                640;

              const videoHeight =
                video.videoHeight ||
                video.clientHeight ||
                480;

              detectedBoxRef.current =
                {
                  x: Math.max(
                    0,
                    (
                      x -
                      width * 0.15
                    ) /
                      videoWidth
                  ),

                  y: Math.max(
                    0,
                    (
                      y -
                      height * 0.3
                    ) /
                      videoHeight
                  ),

                  w: Math.min(
                    1,
                    (
                      width * 1.3
                    ) /
                      videoWidth
                  ),

                  h: Math.min(
                    1,
                    (
                      height * 2.2
                    ) /
                      videoHeight
                  ),
                };

              return;
            }
          } catch (_) {}
        }

        const sampleCanvas =
          sampleCanvasRef.current;

        if (!sampleCanvas) {
          return;
        }

        const sampleContext =
          sampleCanvas.getContext(
            "2d",
            {
              willReadFrequently:
                true,
            }
          );

        if (!sampleContext) {
          return;
        }

        sampleContext.drawImage(
          video,
          0,
          0,
          96,
          72
        );

        const frame =
          sampleContext.getImageData(
            0,
            0,
            96,
            72
          ).data;

        if (
          !previousFrameRef.current
        ) {
          previousFrameRef.current =
            new Uint8ClampedArray(
              frame
            );

          return;
        }

        let sumX = 0;
        let sumY = 0;
        let count = 0;
        let minX = 96;
        let minY = 72;
        let maxX = 0;
        let maxY = 0;

        const threshold = 60;

        for (
          let y = 0;
          y < 72;
          y += 1
        ) {
          for (
            let x = 0;
            x < 96;
            x += 1
          ) {
            const pixelIndex =
              (y * 96 + x) * 4;

            const difference =
              Math.abs(
                frame[pixelIndex] -
                  previousFrameRef
                    .current[
                    pixelIndex
                  ]
              ) +
              Math.abs(
                frame[
                  pixelIndex + 1
                ] -
                  previousFrameRef
                    .current[
                    pixelIndex + 1
                  ]
              ) +
              Math.abs(
                frame[
                  pixelIndex + 2
                ] -
                  previousFrameRef
                    .current[
                    pixelIndex + 2
                  ]
              );

            if (
              difference >
              threshold
            ) {
              sumX += x;
              sumY += y;
              count += 1;

              if (x < minX) {
                minX = x;
              }

              if (x > maxX) {
                maxX = x;
              }

              if (y < minY) {
                minY = y;
              }

              if (y > maxY) {
                maxY = y;
              }
            }
          }
        }

        previousFrameRef.current.set(
          frame
        );

        if (count < 25) {
          return;
        }

        const centerX =
          sumX / count / 96;

        const centerY =
          sumY / count / 72;

        const boxWidth =
          Math.max(
            0.25,
            (
              maxX -
              minX +
              6
            ) /
              96
          );

        const boxHeight =
          Math.max(
            0.4,
            (
              maxY -
              minY +
              6
            ) /
              72
          );

        detectedBoxRef.current = {
          x: Math.max(
            0,
            Math.min(
              0.7,
              centerX -
                boxWidth / 2
            )
          ),

          y: Math.max(
            0,
            Math.min(
              0.4,
              centerY -
                boxHeight / 2 -
                0.05
            )
          ),

          w: Math.min(
            0.65,
            boxWidth + 0.1
          ),

          h: Math.min(
            0.9,
            boxHeight + 0.25
          ),
        };
      };

    const draw = (timestamp) => {
      const container =
        containerRef.current;

      const video =
        videoRef.current;

      if (!container) {
        animationRef.current =
          requestAnimationFrame(
            draw
          );

        return;
      }

      canvas.width =
        container.clientWidth;

      canvas.height =
        container.clientHeight;

      const width =
        canvas.width;

      const height =
        canvas.height;

      const context =
        canvas.getContext("2d");

      if (!context) {
        animationRef.current =
          requestAnimationFrame(
            draw
          );

        return;
      }

      context.clearRect(
        0,
        0,
        width,
        height
      );

      const videoWidth =
        video?.videoWidth || 4;

      const videoHeight =
        video?.videoHeight || 3;

      const scale =
        Math.max(
          width / videoWidth,
          height / videoHeight
        );

      const displayedWidth =
        videoWidth * scale;

      const displayedHeight =
        videoHeight * scale;

      const offsetX =
        (
          width -
          displayedWidth
        ) / 2;

      const offsetY =
        (
          height -
          displayedHeight
        ) / 2;

      detectFace(timestamp);

      const target =
        detectedBoxRef.current
          ? {
              ...detectedBoxRef.current,
            }
          : {
              x: 0.25,
              y: 0.05,
              w: 0.5,
              h: 0.85,
            };

      if (
        !displayBoxRef.current
      ) {
        displayBoxRef.current = {
          ...target,
        };
      }

      const display =
        displayBoxRef.current;

      display.x = lerp(
        display.x,
        target.x,
        0.18
      );

      display.y = lerp(
        display.y,
        target.y,
        0.18
      );

      display.w = lerp(
        display.w,
        target.w,
        0.18
      );

      display.h = lerp(
        display.h,
        target.h,
        0.18
      );

      const boxX =
        display.x *
          displayedWidth +
        offsetX;

      const boxY =
        display.y *
          displayedHeight +
        offsetY;

      const boxWidth =
        display.w *
        displayedWidth;

      const boxHeight =
        display.h *
        displayedHeight;

      const color = scanResult
        ? scanResult.compliant
          ? "#EA580C"
          : "#DC2626"
        : "#EA580C";

      const cornerLength =
        Math.min(
          boxWidth,
          boxHeight
        ) * 0.14;

      context.fillStyle =
        `${color}10`;

      context.fillRect(
        boxX,
        boxY,
        boxWidth,
        boxHeight
      );

      context.strokeStyle =
        color;

      context.lineWidth = 2.5;
      context.shadowColor =
        color;

      context.shadowBlur = 16;

      [
        [
          boxX,
          boxY,
          1,
          1,
        ],

        [
          boxX + boxWidth,
          boxY,
          -1,
          1,
        ],

        [
          boxX,
          boxY + boxHeight,
          1,
          -1,
        ],

        [
          boxX + boxWidth,
          boxY + boxHeight,
          -1,
          -1,
        ],
      ].forEach(
        ([
          cornerX,
          cornerY,
          directionX,
          directionY,
        ]) => {
          context.beginPath();

          context.moveTo(
            cornerX +
              directionX *
                cornerLength,
            cornerY
          );

          context.lineTo(
            cornerX,
            cornerY
          );

          context.lineTo(
            cornerX,
            cornerY +
              directionY *
                cornerLength
          );

          context.stroke();
        }
      );

      if (scanning) {
        const progress =
          (
            timestamp /
            1200
          ) % 1;

        const lineY =
          boxY +
          boxHeight *
            progress;

        const gradient =
          context.createLinearGradient(
            boxX,
            lineY,
            boxX + boxWidth,
            lineY
          );

        gradient.addColorStop(
          0,
          "transparent"
        );

        gradient.addColorStop(
          0.5,
          `${color}bb`
        );

        gradient.addColorStop(
          1,
          "transparent"
        );

        context.beginPath();

        context.strokeStyle =
          gradient;

        context.lineWidth = 1.5;
        context.shadowBlur = 4;

        context.moveTo(
          boxX,
          lineY
        );

        context.lineTo(
          boxX + boxWidth,
          lineY
        );

        context.stroke();
      }

      context.shadowBlur = 0;

      animationRef.current =
        requestAnimationFrame(
          draw
        );
    };

    animationRef.current =
      requestAnimationFrame(draw);

    return () => {
      if (
        animationRef.current
      ) {
        cancelAnimationFrame(
          animationRef.current
        );
      }
    };
  }, [
    scanning,
    scanResult,
    videoRef,
    containerRef,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full origin-center [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
      style={{
        zIndex: 10,
      }}
    />
  );
}


export default function LiveMonitor() {
  const [
    cameraActive,
    setCameraActive,
  ] = useState(false);

  const [
    cameraStatus,
    setCameraStatus,
  ] = useState("idle");

  const [
    scanning,
    setScanning,
  ] = useState(false);

  const [
    scanResult,
    setScanResult,
  ] = useState(null);

  const [
    selectedEntry,
    setSelectedEntry,
  ] = useState("");

  const [
    uaeTime,
    setUaeTime,
  ] = useState("");

  const videoRef =
    useRef(null);

  const containerRef =
    useRef(null);

  const streamRef =
    useRef(null);

  const queryClient =
    useQueryClient();


  useEffect(() => {
    const updateClock = () => {
      const time =
        new Date().toLocaleTimeString(
          "en-GB",
          {
            timeZone:
              "Asia/Dubai",

            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }
        );

      const date =
        new Date().toLocaleDateString(
          "en-GB",
          {
            timeZone:
              "Asia/Dubai",

            day: "2-digit",
            month: "short",
            year: "numeric",
          }
        );

      setUaeTime(
        `${date} · ${time} UAE`
      );
    };

    updateClock();

    const interval =
      setInterval(
        updateClock,
        1000
      );

    return () =>
      clearInterval(interval);
  }, []);


  const {
    data: workers = [],
  } = useQuery({
    queryKey: ["workers"],

    queryFn: () =>
      appClient.entities.Worker.list(),
  });


  const {
    data: entryPoints = [],
    isFetched: entryPointsFetched,
  } = useQuery({
    queryKey: [
      "entryPoints",
    ],

    queryFn: () =>
      appClient.entities.EntryPoint.list(),
  });


  const selectedEntryPoint =
    useMemo(() => {
      return (
        entryPoints.find(
          (entryPoint) =>
            entryPoint.id ===
            selectedEntry
        ) || null
      );
    }, [
      entryPoints,
      selectedEntry,
    ]);


  const currentRequiredGearIds =
    useMemo(() => {
      const configuredGear =
        selectedEntryPoint
          ?.required_gear;

      if (
        !Array.isArray(
          configuredGear
        )
      ) {
        return [];
      }

      return uniqueRequiredGearIds(
        configuredGear
      );
    }, [selectedEntryPoint]);


  const currentRequiredGearItems =
    useMemo(() => {
      return getRequiredGearItems(
        currentRequiredGearIds
      );
    }, [currentRequiredGearIds]);


  const createIncident =
    useMutation({
      mutationFn: (data) =>
        appClient.entities.Incident.create(
          data
        ),

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            "incidents",
          ],
        });

        toast.success(
          "Incident logged successfully"
        );
      },

      onError: (error) => {
        console.error(
          "Incident creation failed:",
          error
        );

        toast.error(
          "The scan completed, but the incident could not be saved."
        );
      },
    });


  const startCamera =
    useCallback(async () => {
      if (
        !navigator.mediaDevices
          ?.getUserMedia
      ) {
        setCameraStatus(
          "unsupported"
        );
        toast.error(
          "This browser does not support camera access."
        );
        return;
      }

      if (
        !window.isSecureContext &&
        window.location.hostname !==
          "localhost" &&
        window.location.hostname !==
          "127.0.0.1"
      ) {
        setCameraStatus(
          "unsupported"
        );
        toast.error(
          "Camera access requires HTTPS in production."
        );
        return;
      }

      setCameraStatus("starting");

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

        if (videoRef.current) {
          videoRef.current.srcObject =
            stream;

          await videoRef.current.play();
        }

        streamRef.current =
          stream;

        setCameraActive(true);
        setCameraStatus("active");
      } catch (error) {
        const name =
          error?.name || "";

        let status = "error";
        let message =
          "The camera could not be started. Check that it is not already in use.";

        if (
          name === "NotAllowedError" ||
          name ===
            "PermissionDeniedError"
        ) {
          status = "denied";
          message =
            "Camera access was blocked. Allow permission in the browser, then try again.";
        } else if (
          name === "NotFoundError" ||
          name ===
            "DevicesNotFoundError"
        ) {
          status = "notfound";
          message =
            "No camera was found on this device.";
        } else if (
          name === "NotReadableError"
        ) {
          message =
            "The camera is already in use by another application.";
        }

        setCameraActive(false);
        setCameraStatus(status);
        toast.error(message);
      }
    }, []);


  const stopCamera =
    useCallback(() => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );

        streamRef.current =
          null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject =
          null;
      }

      setCameraActive(false);
      setCameraStatus("idle");
      setScanResult(null);
    }, []);


  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );
      }
    };
  }, []);


  const wait = (
    milliseconds
  ) =>
    new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          milliseconds
        )
    );


  const buildEmptyScanResult = (
    message
  ) => {
    return {
      worker_identified:
        "Unknown Worker",

      worker_id: "",

      employee_id: "",

      department:
        selectedEntryPoint
          ?.department ||
        "",

      detected_gear: [],

      required_gear:
        currentRequiredGearIds,

      missing_gear: [],

      compliant: false,

      confidence: 0,

      notes: message,

      raw_detections: [],

      image_url: "",

      face_recognition_status:
        "Scan failed",

      quality_rejected:
        false,

      scan_failed: true,

      scan_timed_out: false,

      ppe_status:
        "unavailable",

      scanned_at:
        new Date().toISOString(),

      compliance_rate: null,
    };
  };


  const updateWorkerStatistics =
    async (
      matchedWorker,
      result
    ) => {
      if (!matchedWorker) {
        return;
      }

      const previousTotalScans =
        Math.max(
          0,
          Number(
            matchedWorker.total_scans ||
              0
          )
        );

      const previousViolations =
        Math.max(
          0,
          Number(
            matchedWorker.total_violations ||
              0
          )
        );

      const newTotalScans =
        previousTotalScans +
        1;

      const newTotalViolations =
        result.compliant
          ? previousViolations
          : previousViolations +
            1;

      const newComplianceRate =
        calculateComplianceRate(
          newTotalViolations
        );

      await appClient.entities.Worker.update(
        matchedWorker.id,
        {
          total_scans:
            newTotalScans,

          total_violations:
            newTotalViolations,

          compliance_rate:
            newComplianceRate,
        }
      );

      await queryClient.invalidateQueries({
        queryKey: ["workers"],
      });

      return newComplianceRate;
    };


  const runScan = async () => {
    getAudioContext();

    if (
      !cameraActive ||
      !videoRef.current
    ) {
      toast.error(
        "Start the camera first."
      );

      return;
    }

    if (!selectedEntryPoint) {
      toast.error(
        "Select an entry point before scanning."
      );

      return;
    }

    setScanning(true);
    setScanResult(null);

    try {
      const video =
        videoRef.current;

      if (
        !video.videoWidth ||
        !video.videoHeight
      ) {
        throw new Error(
          "Camera is not ready yet. Wait one second and scan again."
        );
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
        canvas.getContext(
          "2d"
        );

      if (!context) {
        throw new Error(
          "Could not capture camera frame."
        );
      }

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
        throw new Error(
          "Could not create scan image."
        );
      }

      const imageFile =
        new File(
          [blob],
          "scan.jpg",
          {
            type:
              "image/jpeg",
          }
        );

      const formData =
        new FormData();

      formData.append(
        "file",
        imageFile
      );

      formData.append(
        "required_gear",
        JSON.stringify(
          currentRequiredGearIds
        )
      );

      const controller =
        new AbortController();

      const timeoutId =
        window.setTimeout(
          () =>
            controller.abort(),
          SCAN_TIMEOUT_MS
        );

      let response;

      try {
        const scanPromise =
          fetch(
            BACKEND_SCAN_URL,
            {
              method: "POST",
              headers: apiHeaders(),
              body: formData,
              signal:
                controller.signal,
            }
          );

        [response] =
          await Promise.all([
            scanPromise,
            wait(700),
          ]);
      } catch (error) {
        if (
          error?.name ===
          "AbortError"
        ) {
          const timeoutResult = {
            ...buildEmptyScanResult(
              "Scan timed out. Showing the available result."
            ),
            worker_identified:
              "Unknown Worker",
            face_recognition_status:
              "Face recognition timed out",
            scan_failed: false,
            scan_timed_out: true,
            ppe_status:
              "timeout",
            missing_gear: [],
            compliant: false,
          };

          setScanResult(
            timeoutResult
          );
          toast.error(
            "Scan timed out. PPE or face results were not ready in time."
          );
          return;
        }

        throw error;
      } finally {
        window.clearTimeout(
          timeoutId
        );
      }

      let backendResult = {};

      try {
        backendResult =
          await response.json();
      } catch (_) {
        backendResult = {};
      }

      if (!response.ok) {
        throw new Error(
          backendResult.detail ||
            `Backend scan failed. Status: ${response.status}`
        );
      }

      const backendDetectedGear =
        Array.isArray(
          backendResult.detected_gear
        )
          ? backendResult.detected_gear
          : [];

      const backendRequiredGear =
        uniqueRequiredGearIds(
          Array.isArray(
            backendResult.required_gear
          ) &&
            backendResult.required_gear
              .length > 0
            ? backendResult.required_gear
            : currentRequiredGearIds
        );

      const backendDetectedGearCanonical =
        restrictGearToRequired(
          backendDetectedGear,
          backendRequiredGear
        );

      const ppeCheckComplete =
        (backendResult.ppe_status ||
          "ok") === "ok";

      const backendMissingGear =
        ppeCheckComplete
          ? backendRequiredGear.filter(
              (gearId) =>
                !backendDetectedGearCanonical.includes(
                  gearId
                )
            )
          : restrictGearToRequired(
              backendResult.missing_gear ||
                [],
              backendRequiredGear
            );

      const result = {
        worker_identified:
          backendResult.worker_identified ||
          "Unknown Worker",

        worker_id:
          backendResult.worker_id ||
          "",

        employee_id:
          backendResult.employee_id ||
          "",

        department:
          backendResult.department ||
          selectedEntryPoint
            ?.department ||
          "",

        detected_gear:
          backendDetectedGearCanonical,

        required_gear:
          backendRequiredGear,

        missing_gear:
          backendMissingGear,

        compliant:
          ppeCheckComplete
            ? backendMissingGear.length ===
              0
            : Boolean(
                backendResult.compliant
              ),

        confidence:
          Number(
            backendResult.confidence ||
              0
          ),

        notes:
          backendResult.notes ||
          "Scan completed.",

        raw_detections:
          Array.isArray(
            backendResult.raw_detections
          )
            ? backendResult.raw_detections
            : [],

        image_url:
          backendResult.image_url ||
          "",

        face_recognition_status:
          backendResult.face_recognition_status ||
          "",

        face_distance:
          backendResult.face_distance ??
          null,

        quality_rejected:
          Boolean(
            backendResult.quality_rejected
          ),

        image_quality:
          backendResult.image_quality ||
          null,

        face_recognition_timed_out:
          Boolean(
            backendResult.face_recognition_timed_out
          ),

        ppe_status:
          backendResult.ppe_status ||
          "ok",

        scan_time_seconds:
          backendResult.scan_time_seconds ??
          null,

        scan_timed_out: false,

        scan_failed: false,

        scanned_at:
          new Date().toISOString(),

        compliance_rate: null,
      };

      setScanResult(result);

      if (
        result.quality_rejected
      ) {
        toast.error(
          result.notes
        );

        return;
      }

      playScanResultSounds(
        result
      );

      const matchedWorker =
        result.worker_id
          ? workers.find(
              (worker) =>
                worker.backend_worker_id ===
                  result.worker_id ||
                worker.id ===
                  result.worker_id
            )
          : workers.find(
              (worker) =>
                String(
                  worker.full_name ||
                    ""
                ).toLowerCase() ===
                String(
                  result.worker_identified ||
                    ""
                ).toLowerCase()
            );

      if (matchedWorker) {
        result.employee_id =
          result.employee_id ||
          matchedWorker.employee_id ||
          "";

        try {
          result.compliance_rate =
            await updateWorkerStatistics(
              matchedWorker,
              result
            );
        } catch (error) {
          console.error(
            "Worker statistics update failed:",
            error
          );

          toast.error(
            "The scan completed, but the worker compliance score could not be updated."
          );
        }
      }

      setScanResult({
        ...result,
      });

      if (selectedEntryPoint) {
        appClient.entities.EntryPoint.update(
          selectedEntryPoint.id,
          {
            scans_today:
              Number(
                selectedEntryPoint.scans_today ||
                  0
              ) + 1,

            violations_today:
              !result.compliant
                ? Number(
                    selectedEntryPoint.violations_today ||
                      0
                  ) + 1
                : Number(
                    selectedEntryPoint.violations_today ||
                      0
                  ),
          }
        )
          .then(() => {
            queryClient.invalidateQueries({
              queryKey: [
                "entryPoints",
              ],
            });
          })
          .catch((error) => {
            console.error(
              "Entry point update failed:",
              error
            );
          });
      }

      if (
        !result.compliant &&
        result.missing_gear.length >
          0
      ) {
        const incidentDate =
          new Date();

        const workerName =
          matchedWorker?.full_name ||
          (
            result.worker_identified &&
            result.worker_identified !==
              ""
              ? result.worker_identified
              : "Unknown Worker"
          );

        createIncident.mutate({
          worker_id:
            matchedWorker?.id ||
            result.worker_id ||
            "",

          worker_name:
            workerName,

          department:
            result.department ||
            matchedWorker?.department ||
            selectedEntryPoint
              ?.department ||
            "",

          missing_gear:
            result.missing_gear,

          detected_gear:
            result.detected_gear,

          required_gear:
            result.required_gear,

          severity:
            result.missing_gear.length >=
            3
              ? "critical"
              : result.missing_gear.length >=
                  2
              ? "high"
              : "medium",

          status: "open",

          entry_point:
            selectedEntryPoint?.name ||
            "Default Entry",

          screenshot_url:
            result.image_url ||
            "",

          notes:
            result.notes ||
            "",

          incident_time:
            incidentDate.toISOString(),
        });
      }
    } catch (error) {
      console.error(
        "Scan failed:",
        error
      );

      const message =
        error?.message ||
        "Scan failed.";

      const result =
        buildEmptyScanResult(
          message
        );

      setScanResult(result);

      toast.error(message);
    } finally {
      setScanning(false);
    }
  };


  const cameraStatusCopy = {
    idle: {
      title: "Camera Offline",
      detail:
        "Start the camera to preview the entry point and run a gear scan.",
    },
    starting: {
      title: "Starting camera…",
      detail:
        "Waiting for browser permission and the video stream.",
    },
    denied: {
      title: "Camera permission blocked",
      detail:
        "Allow camera access in the browser settings, then press Start Camera.",
    },
    notfound: {
      title: "No camera found",
      detail:
        "Connect a webcam and try again.",
    },
    unsupported: {
      title: "Camera not available",
      detail:
        "Use a current browser over HTTPS (or localhost) with camera support.",
    },
    error: {
      title: "Camera could not start",
      detail:
        "Close other apps using the camera, then try again.",
    },
  }[cameraStatus] || null;

  const cameraStarting =
    cameraStatus === "starting";

  return (
    <div className="mx-auto flex max-w-[1920px] flex-col p-4 sm:p-5 lg:h-screen lg:min-h-0 lg:overflow-hidden lg:p-6 xl:p-7">
      <div className="mb-4 flex shrink-0 flex-col justify-between gap-3 sm:flex-row sm:items-start lg:mb-5">
        <div className="flex min-w-0 flex-col gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Live Monitor
            </h1>

            <p className="text-sm text-muted-foreground font-mono">
              {uaeTime ||
                "Loading time..."}
            </p>
          </div>

          <Select
            value={
              selectedEntry
            }
            onValueChange={
              setSelectedEntry
            }
            disabled={
              entryPoints.length ===
              0
            }
          >
            <SelectTrigger
              className="w-full max-w-[240px]"
              aria-label="Select entry point"
            >
              <SelectValue placeholder="Select entry point" />
            </SelectTrigger>

            <SelectContent>
              {entryPoints.map(
                (entryPoint) => (
                  <SelectItem
                    key={
                      entryPoint.id
                    }
                    value={
                      entryPoint.id
                    }
                  >
                    {entryPoint.name}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          {entryPointsFetched && entryPoints.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add an entry point
              before scanning so
              required gear can be
              checked.
            </p>
          )}
        </div>

        <BrandLogo />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
        <div className="flex min-h-0 lg:col-span-2">
          <Card className="flex min-h-[22rem] w-full flex-col overflow-hidden border shadow-sm sm:min-h-[26rem] lg:min-h-0">
            <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 py-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Video className="w-5 h-5" aria-hidden="true" />
                Camera Feed
              </CardTitle>

              {cameraActive && (
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-red-500 motion-safe:animate-pulse" />

                  <span className="text-xs font-mono text-red-600">
                    Live
                  </span>
                </div>
              )}
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <div
                ref={
                  containerRef
                }
                className="relative min-h-[16rem] w-full flex-1 overflow-hidden bg-black sm:min-h-[18rem] lg:min-h-0"
                aria-live="polite"
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 h-full w-full origin-center object-cover object-center [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
                />

                {cameraActive && (
                  <ScanOverlay
                    scanning={
                      scanning
                    }
                    scanResult={
                      scanResult
                    }
                    videoRef={
                      videoRef
                    }
                    containerRef={
                      containerRef
                    }
                  />
                )}

                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-sidebar/95 px-6 text-center">
                    {cameraStarting ? (
                      <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
                    ) : (
                      <CameraOff className="mb-3 h-12 w-12 text-muted-foreground/40" />
                    )}

                    <p className="text-sm font-medium text-sidebar-foreground">
                      {cameraStatusCopy
                        ?.title ||
                        "Camera Offline"}
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-sidebar-foreground/70">
                      {cameraStatusCopy
                        ?.detail}
                    </p>
                  </div>
                )}

                {scanning && (
                  <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/75 px-4 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />

                    <span className="text-xs text-white font-mono">
                      Analyzing gear
                      compliance...
                    </span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border bg-card px-4 py-3 sm:px-5">
                {!cameraActive ? (
                  <Button
                    size="lg"
                    onClick={
                      startCamera
                    }
                    disabled={
                      cameraStarting
                    }
                    className="min-w-[168px]"
                  >
                    {cameraStarting ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Camera className="mr-2 h-5 w-5" />
                    )}
                    {cameraStarting
                      ? "Starting…"
                      : "Start Camera"}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      onClick={
                        stopCamera
                      }
                      variant="outline"
                      className="min-w-[168px]"
                    >
                      <CameraOff className="w-5 h-5 mr-2" />
                      Stop Camera
                    </Button>

                    <Button
                      size="lg"
                      onClick={
                        runScan
                      }
                      disabled={
                        scanning ||
                        !selectedEntryPoint
                      }
                      title={
                        !selectedEntryPoint
                          ? "Select an entry point before scanning"
                          : undefined
                      }
                      className="min-w-[168px]"
                    >
                      {scanning ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <Shield className="w-5 h-5 mr-2" />
                      )}

                      {scanning
                        ? "Scanning..."
                        : "Scan for Gear"}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:h-full">
          <Card className={`flex min-h-0 shrink-0 flex-col overflow-hidden border shadow-sm ${scanResult ? "lg:max-h-[42%]" : ""}`}>
            <CardHeader className="shrink-0 pb-2 pt-4">
              <CardTitle className="text-base font-semibold">
                Scan Results
              </CardTitle>
            </CardHeader>

            <CardContent
              className={
                scanResult
                  ? "overflow-y-auto pb-5"
                  : "flex min-h-[7.5rem] flex-col justify-center overflow-hidden"
              }
            >
              {!scanResult ? (
                <div className="flex flex-col items-center justify-center px-2 py-2 text-center">
                  <Shield className="mb-3 h-10 w-10 text-muted-foreground/25" />

                  <p className="text-sm font-medium text-foreground">
                    No scan yet
                  </p>
                  <p className="mt-1 max-w-[220px] text-sm text-muted-foreground">
                    Select an entry
                    point, start the
                    camera, and scan.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const outcome = getScanOutcome(scanResult);
                    const toneClass = {
                      success: "border-emerald-200 bg-emerald-50 text-emerald-800",
                      danger: "border-red-200 bg-red-50 text-red-800",
                      warning: "border-amber-200 bg-amber-50 text-amber-900",
                      neutral: "border-border bg-muted/60 text-foreground",
                    }[outcome.tone];
                    const Icon =
                      outcome.tone === "success"
                        ? CheckCircle
                        : AlertTriangle;

                    return (
                  <div
                    className={`rounded-lg border p-3 ${toneClass}`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Icon className="h-5 w-5 flex-shrink-0" />

                      <span className="text-sm font-semibold">
                        {outcome.title}
                      </span>
                    </div>

                    <p className="text-xs opacity-80">
                      {
                        scanResult.notes
                      }
                    </p>
                  </div>
                    );
                  })()}

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Gear Status
                    </p>

                    <div className="space-y-1.5">
                      {(
                        scanResult.detected_gear ||
                        []
                      ).map(
                        (gear) => (
                          <div
                            key={`detected-${gear}`}
                            className="flex items-center gap-2 text-sm"
                          >
                            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />

                            <span>
                              {normalizeGearDisplay(gear)}
                            </span>
                          </div>
                        )
                      )}

                      {(
                        scanResult.missing_gear ||
                        []
                      ).map(
                        (gear) => (
                          <div
                            key={`missing-${gear}`}
                            className="flex items-center gap-2 text-sm"
                          >
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />

                            <span className="font-medium text-red-600">
                              {normalizeGearDisplay(gear)}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex shrink-0 flex-col border shadow-sm">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base font-semibold">
                Required Gear
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col justify-center pb-4">
              {currentRequiredGearItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {currentRequiredGearItems.map(
                  (item) => {
                    const Icon =
                      item.icon;

                    return (
                      <div
                        key={
                          item.id
                        }
                        className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

                        <span className="truncate">
                          {
                            item.label
                          }
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {selectedEntryPoint
                    ? "This entry point has no required gear configured."
                    : "Select an entry point to see required gear."}
                </p>
              )}
            </CardContent>
          </Card>

          {scanResult ? (
            <WorkerScanPanel scanResult={scanResult} />
          ) : (
            <DetectionGuide />
          )}
        </div>
      </div>
    </div>
  );
}