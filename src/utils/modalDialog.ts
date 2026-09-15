import React from 'react';

export type ModalVariant = 'primary' | 'danger' | 'warning' | 'info';

export interface ConfirmDialogOptions {
  title?: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ModalVariant;
}

export interface AlertDialogOptions {
  title?: string;
  message: string | React.ReactNode;
  confirmText?: string;
  type?: 'error' | 'warning' | 'info' | 'success';
}

export interface ModalDialogState {
  id: string;
  mode: 'confirm' | 'alert';
  title: string;
  message: React.ReactNode;
  confirmText: string;
  cancelText: string;
  variant: ModalVariant;
  resolve: (value: boolean) => void;
}

type DialogListener = (dialog: ModalDialogState | null) => void;

let activeDialog: ModalDialogState | null = null;
const listeners = new Set<DialogListener>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener(activeDialog);
    } catch (e) {
      console.error('Modal listener error:', e);
    }
  });
}

export const modal = {
  subscribe(listener: DialogListener) {
    listeners.add(listener);
    listener(activeDialog);
    return () => {
      listeners.delete(listener);
    };
  },

  confirm(options: ConfirmDialogOptions | string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : options;
      activeDialog = {
        id: Math.random().toString(36).slice(2),
        mode: 'confirm',
        title: opts.title || '请确认操作',
        message: opts.message,
        confirmText: opts.confirmText || '确定',
        cancelText: opts.cancelText || '取消',
        variant: opts.variant || 'primary',
        resolve: (val: boolean) => {
          activeDialog = null;
          notify();
          resolve(val);
        },
      };
      notify();
    });
  },

  alert(options: AlertDialogOptions | string): Promise<void> {
    return new Promise<void>((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : options;
      const typeToVariant: Record<string, ModalVariant> = {
        error: 'danger',
        warning: 'warning',
        info: 'info',
        success: 'primary',
      };
      const variant = typeToVariant[opts.type || 'info'] || 'info';
      const defaultTitle = opts.type === 'error' ? '提示' : opts.type === 'warning' ? '警告' : '提示';

      activeDialog = {
        id: Math.random().toString(36).slice(2),
        mode: 'alert',
        title: opts.title || defaultTitle,
        message: opts.message,
        confirmText: opts.confirmText || '我知道了',
        cancelText: '',
        variant,
        resolve: () => {
          activeDialog = null;
          notify();
          resolve();
        },
      };
      notify();
    });
  },

  closeCurrent() {
    if (activeDialog) {
      activeDialog.resolve(false);
    }
  },
};
