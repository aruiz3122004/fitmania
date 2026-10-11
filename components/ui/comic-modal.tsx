'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ComicModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success' | 'default';
}

export function ComicModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  variant = 'default',
}: ComicModalProps) {
  const variantStyles = {
    danger: 'border-red-600 shadow-[8px_8px_0_0_rgba(220,38,38,1)]',
    warning: 'border-yellow-500 shadow-[8px_8px_0_0_rgba(234,179,8,1)]',
    info: 'border-blue-500 shadow-[8px_8px_0_0_rgba(59,130,246,1)]',
    success: 'border-green-500 shadow-[8px_8px_0_0_rgba(34,197,94,1)]',
    default: 'border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)]',
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        showCloseButton={false}
        className={cn(
          "max-w-md bg-white border-4 p-0 overflow-hidden rounded-[2rem] transition-all duration-300 transform scale-100",
          variantStyles[variant],
          className
        )}
      >
        {/* Halftone Header */}
        <div className="relative bg-zinc-900 p-6 border-b-4 border-black halftone">
          <div className="flex justify-between items-center relative z-10">
            <DialogHeader className="text-left space-y-0">
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                  {description}
                </DialogDescription>
              )}
            </DialogHeader>
            <button 
              onClick={onClose}
              className="p-2 bg-white border-2 border-black rounded-lg hover:bg-red-500 hover:text-white transition-all transform hover:rotate-12"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-8">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-6 bg-zinc-50 border-t-4 border-black flex justify-end gap-3">
            {footer}
          </div>
        )}

        <style jsx>{`
          .halftone {
            background-image: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
            background-size: 10px 10px;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

// Helper per confirmazioni veloci
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  variant = 'danger'
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
}) {
  return (
    <ComicModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      variant={variant}
      footer={
        <>
          <button 
            onClick={onClose}
            className="px-6 py-2 border-2 border-black font-black uppercase text-xs hover:bg-zinc-200 transition-all"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className={cn(
              "px-6 py-2 border-2 border-black text-white font-black uppercase text-xs shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all",
              variant === 'danger' ? 'bg-red-600' : 'bg-yellow-500'
            )}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p className="font-bold text-zinc-700 leading-relaxed italic">
        {message}
      </p>
    </ComicModal>
  );
}
