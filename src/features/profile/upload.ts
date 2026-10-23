export const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3MB

export async function readImageFileAsDataUrl(file: File): Promise<string> {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Selected file must be an image");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Avatar image size must be under 3MB");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to encode image as data URL"));
      }
    };
    reader.onerror = () => {
      reject(reader.error || new Error("Failed to read image file"));
    };
    reader.readAsDataURL(file);
  });
}
