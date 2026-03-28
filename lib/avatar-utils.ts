export const avatarOptions = [
  { id: 'fitman', name: 'Fitman', url: '/Imagenes/Avatares/Fitman.jpeg' },
  { id: 'fitwoman', name: 'Fitwoman', url: '/Imagenes/Avatares/Fitwoman.jpeg' },
  { id: 'fitdog', name: 'Fitdog', url: '/Imagenes/Avatares/Fitdog.jpeg' },
  { id: 'fitinha', name: 'Fitinha', url: '/Imagenes/Avatares/Fitinha.jpeg' },
  { id: 'fito', name: 'Fito', url: '/Imagenes/Avatares/Fito.jpeg' },
  { id: 'fatu', name: 'Fatu', url: '/Imagenes/Avatares/Fatu.jpeg' },
] as const

export function getAvatarUrlById(avatarId: string) {
  return avatarOptions.find((avatar) => avatar.id === avatarId)?.url
}
