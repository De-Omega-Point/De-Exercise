import { isSupabaseConfigured, supabase } from "./supabase";
import type { EquipmentRecognition } from "./types";

export async function recogniseEquipment(file: File): Promise<EquipmentRecognition> {
  const imageDataUrl = await fileToDataUrl(file);

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

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Recognition service returned no result.");

  return data;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
