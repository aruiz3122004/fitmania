// Estado del modal de confirmación del panel admin (lo dibuja la página).
export interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export type SetConfirm = (state: ConfirmState) => void;
