interface SectionHeaderProps {
  label: string
  title: string
  titleAccent: string
  dark?: boolean
}

export function SectionHeader({ label, title, titleAccent, dark = false }: SectionHeaderProps) {
  return (
    <div className="text-center mb-14">
      <span className={`inline-block font-label font-bold text-[0.85rem] tracking-[3px] uppercase mb-2 ${
        dark ? 'text-accent' : 'text-primary'
      }`}>
        {label}
      </span>
      <h2 className={`font-display text-[clamp(2.2rem,5vw,3.5rem)] tracking-[3px] ${
        dark 
          ? 'text-white [text-shadow:2px_2px_0_var(--navy)]' 
          : 'text-secondary [text-shadow:2px_2px_0_var(--gray-200)]'
      }`}>
        {title} <span className={`${
          dark 
            ? 'text-primary [text-shadow:2px_2px_0_rgba(220,38,38,0.4)]' 
            : 'text-primary [text-shadow:2px_2px_0_rgba(220,38,38,0.2)]'
        }`}>{titleAccent}</span>
      </h2>
      <div className="flex items-center justify-center mt-4 gap-4">
        <div className={`w-20 h-1 ${dark ? 'bg-primary' : 'bg-primary'}`} />
        <span className="text-accent text-2xl [text-shadow:1px_1px_0_var(--navy)]">&#9733;</span>
        <div className={`w-20 h-1 ${dark ? 'bg-primary' : 'bg-primary'}`} />
      </div>
    </div>
  )
}
