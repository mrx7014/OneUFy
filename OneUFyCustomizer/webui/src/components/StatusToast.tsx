import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, RotateCw } from 'lucide-react';

interface StatusToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const StatusToast: React.FC<StatusToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-shelf">
      {toasts.map((toast) => {
        const renderIcon = () => {
          switch (toast.type) {
            case 'success':
              return <CheckCircle2 size={18} color="var(--md-sys-color-primary)" />;
            case 'warning':
              return <AlertTriangle size={18} color="var(--md-sys-color-warning)" />;
            case 'error':
              return <AlertCircle size={18} color="var(--md-sys-color-error)" />;
            default:
              return <Info size={18} color="var(--md-sys-color-primary)" />;
          }
        };

        return (
          <div key={toast.id} className="toast-item">
            <div className="toast-icon-wrap">{renderIcon()}</div>
            <div className="toast-body">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-desc">{toast.message}</div>
              {toast.actionLabel && toast.onAction && (
                <div className="toast-action-row">
                  <button
                    className="toast-action-btn"
                    onClick={() => {
                      toast.onAction?.();
                      onDismiss(toast.id);
                    }}
                  >
                    <RotateCw size={13} />
                    <span>{toast.actionLabel}</span>
                  </button>
                </div>
              )}
            </div>
            <button
              className="toast-dismiss-btn"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
