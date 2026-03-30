export const avatarOptions = [
  { id: 'fitman', name: 'Fitman', url: '/Imagenes/Avatares/FitmanNEW.png' },
  { id: 'fitwoman', name: 'Fitwoman', url: '/Imagenes/Avatares/FitwomanNEW.png' },
  { id: 'fitdog', name: 'Fitdog', url: '/Imagenes/Avatares/FitdogNEW.png' },
  { id: 'fitinha', name: 'Fitinha', url: '/Imagenes/Avatares/FitinhaNEW.png' },
  { id: 'fito', name: 'Fito', url: '/Imagenes/Avatares/FitoNEW.png' },
  { id: 'fatu', name: 'Fatu', url: '/Imagenes/Avatares/FatuNEW.png' },
] as const

export function getAvatarUrlById(avatarId: string) {
  return avatarOptions.find((avatar) => avatar.id === avatarId)?.url
}

/** Returns true if the given URL belongs to one of the 6 built-in avatars */
export function isDefaultAvatarUrl(url: string): boolean {
  return avatarOptions.some((avatar) => avatar.url === url)
}


