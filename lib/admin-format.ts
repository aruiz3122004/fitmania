// Formateadores del panel admin (F3-21: extraídos de app/fitministration/page.tsx).
export const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(val);

export const formatDate = (dateValue: any) => {
  if (!dateValue) return 'N/A';
  if (dateValue?.seconds !== undefined) return new Date(dateValue.seconds * 1000).toLocaleDateString('es-CO');
  if (dateValue?._seconds !== undefined) return new Date(dateValue._seconds * 1000).toLocaleDateString('es-CO');
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return 'Fecha Inválida';
  return d.toLocaleDateString('es-CO');
};

// --- COMPONENTES ---
