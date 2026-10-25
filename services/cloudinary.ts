import { auth } from '@/lib/firebase'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

// F1-24: límites validados antes de subir (Cloudinary los aplica también si el
// preset firmado se configura con `max_file_size`).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_VIDEO_BYTES = 20 * 1024 * 1024 // 20 MB
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

export type CloudinaryResult = {
  url: string
  publicId: string
  resourceType: 'image' | 'video' | 'raw'
}

export type UploadPurpose = 'forum' | 'avatar'

function validateFile(file: File, purpose: UploadPurpose): 'image' | 'video' {
  const isVideo = VIDEO_TYPES.includes(file.type)
  const isImage = IMAGE_TYPES.includes(file.type)
  if (!isImage && !(isVideo && purpose === 'forum')) {
    throw new Error(
      purpose === 'avatar'
        ? 'Formato no permitido. Usa JPG, PNG o WEBP.'
        : 'Formato no permitido. Usa JPG, PNG, WEBP o video MP4/WEBM/MOV.'
    )
  }
  const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > max) {
    throw new Error(`El archivo supera el máximo de ${Math.round(max / 1024 / 1024)} MB.`)
  }
  return isVideo ? 'video' : 'image'
}

/** Pide al servidor una firma de subida. Devuelve null si las firmas no están configuradas. */
async function getSignedParams(resourceType: 'image' | 'video', purpose: UploadPurpose) {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('Debes iniciar sesión para subir archivos.')

  const res = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ resourceType, purpose }),
  })
  if (res.status === 501) return null
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'No se pudo autorizar la subida.')
  }
  return res.json() as Promise<{
    cloudName: string
    apiKey: string
    signature: string
    timestamp: number
    folder: string
    allowed_formats: string
  }>
}

export async function uploadToCloudinary(
  file: File,
  purpose: UploadPurpose = 'forum'
): Promise<CloudinaryResult> {
  const resourceType = validateFile(file, purpose)

  const formData = new FormData()
  formData.append('file', file)

  const signed = await getSignedParams(resourceType, purpose)
  let cloudName = CLOUD_NAME
  if (signed) {
    cloudName = signed.cloudName
    formData.append('api_key', signed.apiKey)
    formData.append('timestamp', String(signed.timestamp))
    formData.append('signature', signed.signature)
    formData.append('folder', signed.folder)
    formData.append('allowed_formats', signed.allowed_formats)
  } else {
    // Compatibilidad mientras no existan CLOUDINARY_API_KEY/_SECRET en el servidor.
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      throw new Error('Faltan variables de entorno de Cloudinary')
    }
    formData.append('upload_preset', UPLOAD_PRESET)
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  if (!response.ok) {
    throw new Error('Error al subir archivo a Cloudinary')
  }

  const data = await response.json()

  return {
    url: data.secure_url,        // URL pública que guardas en Firestore
    publicId: data.public_id,    // Para borrarla cuando se elimine el contenido
    resourceType,
  }
}
