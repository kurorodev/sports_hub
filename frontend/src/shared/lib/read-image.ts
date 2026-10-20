export async function readImage(file: File) {
  if (
    !["image/png", "image/jpeg"].includes(file.type) ||
    !file.size ||
    file.size > 2 * 1024 * 1024
  )
    throw new Error("Выберите PNG или JPEG до 2 МБ.");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}
