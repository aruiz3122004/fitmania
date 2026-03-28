const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

export type CloudinaryResult = {
    url: string
    publicId: string
    resourceType: 'image' | 'video' | 'raw'
  }
  
  export async function uploadToCloudinary(
    file: File
  ): Promise<CloudinaryResult> {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      throw new Error('Faltan variables de entorno de Cloudinary')
    }
  
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', UPLOAD_PRESET)
  
    // Detecta automáticamente si es imagen, video u otro archivo
    const isVideo = file.type.startsWith('video/')
    const resourceType = isVideo ? 'video' : 'image'
  
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
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
      publicId: data.public_id,    // Por si necesitas borrarla después
      resourceType,
    }
  }