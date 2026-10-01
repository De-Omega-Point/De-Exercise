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
      // The function should return JSON, but preserve a useful fallback.
    }

    if (payload?.code === "OPENAI_API_KEY_MISSING") {
      throw new Error(
        "AI machine recognition needs the OPENAI_API_KEY secret in Supabase Edge Function Secrets.",
      );
    }

    if (payload?.code === "OPENAI_RATE_LIMITED") {
      throw new Error("AI recognition is temporarily rate-limited. Try the scan again shortly.");
    }

    if (payload?.code === "OPENAI_AUTH_FAILED") {
      throw new Error("The OpenAI API key configured for machine recognition is invalid or expired.");
    }

    throw new Error(payload?.error || "AI machine recognition failed.");
  }

  if (error instanceof FunctionsRelayError) {
    throw new Error("Supabase could not relay the machine-recognition request.");
  }

  if (error instanceof FunctionsFetchError) {
    throw new Error("Could not reach the machine-recognition service.");
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Recognition service returned no result.");
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
