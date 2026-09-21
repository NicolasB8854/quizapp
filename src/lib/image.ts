/**
 * Bild-Helper: Foto-Upload → Downscale → DataURL (Session T).
 *
 * Wir laden Portraits aus dem lokalen Filesystem, skalieren sie auf eine
 * feste Kantenlänge und speichern sie als Base64-DataURL im State/localStorage.
 * So bleibt die Runde offline-fähig — kein Server, kein Blob-Handling nötig.
 *
 * Größe: 256×256 ist ein guter Kompromiss zwischen Schärfe und Speicher.
 * Bei JPEG-Qualität 0.85 liegt eine Foto-DataURL typisch bei ~15–25 KB.
 * Wir zoomen auf das Quadrat via „center-crop" — passt zum runden Avatar-Badge.
 */

/** Kanten-Größe des skalierten Bildes in Pixeln (quadratisch). */
export const AVATAR_PHOTO_SIZE = 256

/** JPEG-Qualität für die Ausgabe (0..1). */
export const AVATAR_PHOTO_QUALITY = 0.85

/**
 * Liest eine File-Referenz, skaliert das Bild auf ein Quadrat und liefert
 * eine JPEG-DataURL zurück. Wirft mit einer sprechenden Nachricht, wenn das
 * File keinen Bildtyp hat oder das Rendering fehlschlägt.
 */
export async function downscaleImageToDataUrl(
  file: File,
  size: number = AVATAR_PHOTO_SIZE,
  quality: number = AVATAR_PHOTO_QUALITY,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Datei ist kein Bild.')
  }
  const bitmap = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D-Kontext nicht verfügbar.')

  // Center-Crop-Berechnung: die kleinere Bild-Kante bestimmt die Quadratgröße,
  // wir zentrieren das Motiv in der Quelle.
  const src = fittedCropRect(bitmap.width, bitmap.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, src.x, src.y, src.size, src.size, 0, 0, size, size)

  return canvas.toDataURL('image/jpeg', quality)
}

/** Berechnet ein zentriertes Quadrat innerhalb eines Rechtecks. */
function fittedCropRect(width: number, height: number): { x: number; y: number; size: number } {
  const s = Math.min(width, height)
  return {
    x: Math.floor((width - s) / 2),
    y: Math.floor((height - s) / 2),
    size: s,
  }
}

/**
 * Lädt eine `File` in ein Bitmap-Objekt für Canvas-Rendering. Nutzt bevorzugt
 * `createImageBitmap`; fällt auf ein `<img>` zurück (ältere Browser).
 */
function loadImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file)
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err instanceof Event ? new Error('Bild konnte nicht geladen werden.') : err)
    }
    img.src = url
  })
}
