'use client';

// F3-21: estilos globales del panel admin (cómic) extraídos de app/fitministration/page.tsx.
export function AdminGlobalStyles() {
  return (
    <style jsx global>{`
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes comicShake {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-1deg); }
        75% { transform: rotate(1deg); }
      }
      .animate-shake {
        animation: comicShake 0.2s ease-in-out infinite;
      }
      main {
         background-image: 
          radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px),
          linear-gradient(to right, rgba(0,0,0,0.02) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0,0,0,0.02) 1px, transparent 1px);
         background-size: 20px 20px, 40px 40px, 40px 40px;
      }
      /* Custom scrollbar comic style */
      ::-webkit-scrollbar { width: 12px; }
      ::-webkit-scrollbar-track { background: #f1f1f1; border-left: 3px solid black; }
      ::-webkit-scrollbar-thumb { background: black; border: 2px solid #f1f1f1; }
      ::-webkit-scrollbar-thumb:hover { background: #333; }
    `}</style>
  );
}
