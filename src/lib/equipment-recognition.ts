import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { EquipmentRecognition } from "./types";

export async function recogniseEquipment(file: File): Promise<EquipmentRecognition> {
  const imageDataUrl = await optimiseImageForRecognition(file);

  if (!isSupabaseConfigured || !supabase) {
    return {
      equipment_type: "Plate-loaded chest press",
      manufacturer: null,
      model: null,
      likely_exercises: ["Chest press"],
      primary_muscles: ["Chest", "Triceps", "Front deltoids"],
      confidence: 0.82,
      distinguishing_features: [
        "Independent press arms",
        "Plate-loaded resistance",
        "Seated back support",
      ],
      notes: "Demo result because Supabase is not configured in this browser.",
      candidate_matches: [],
    };
  }

  const { data, error } = await supabase.functions.invoke<EquipmentRecognition>(
    "recognise-equipment",
    { body: { image_data_url: imageDataUrl } },
  );

  if (error instanceof FunctionsHttpError) {
    let payload: { error?: string; code?: string } | null = null;

    try {
      payload = await error.context.json();
    } catch {
      // Preserve a useful fallback if an intermediary returns non-JSON.
    }

    if (
      payload?.code === "DE_AI_VISION_URL_MISSING"
      || payload?.code === "DE_AI_VISION_TOKEN_MISSING"
    ) {
      throw new Error("De-AI Vision is not configured for machine recognition yet.");
    }

    if (payload?.code === "DE_AI_RATE_LIMITED") {
      throw new Error("De-AI Vision is busy. Try the scan again shortly.");
    }

    if (payload?.code === "DE_AI_AUTH_FAILED") {
      throw new Error("De-AI Vision authentication needs attention.");
    }

    if (payload?.code === "DE_AI_TIMEOUT") {
      throw new Error("De-AI took too long to identify the machine. Try another photo.");
    }

    if (payload?.code === "DE_AI_UNAVAILABLE") {
      throw new Error("De-AI Vision is temporarily unavailable.");
    }

    throw new Error(payload?.error || "De-AI machine recognition failed.");
  }

  if (error instanceof FunctionsRelayError) {
    throw new Error("Supabase could not relay the request to De-AI.");
  }

  if (error instanceof FunctionsFetchError) {
    throw new Error("Could not reach the De-AI recognition service.");
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("De-AI returned no recognition result.");
  }

  return data;
}

async function optimiseImageForRecognition(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  }

  try {
    const image = await loadImage(file);
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return fileToDataUrl(file);

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.84);
    });

    if (!blob) return fileToDataUrl(file);
    return blobToDataUrl(blob);
  } catch {
    return fileToDataUrl(file);
  }
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode the selected image."));
    };

    image.src = url;
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not prepare the image for recognition."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function fileToDataUrl(file: File) {
  return blobToDataUrl(file);
}
