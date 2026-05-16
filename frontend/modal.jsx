/* global React */
const { useState, useEffect } = React;

// Base Modal Component
function Modal({ isOpen, onClose, title, children, size = 'md', showClose = true }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'modal-sm',
    md: 'modal-md',
    lg: 'modal-lg'
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className={`modal-content ${sizeClasses[size]}`} 
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            <h2 className="modal-title">{title}</h2>
            {showClose && (
              <button className="modal-close" onClick={onClose}>
                <IconX size={16} />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

// Confirm Dialog
function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmStyle = "primary" // primary, danger
}) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div style={{ marginBottom: 20, color: "var(--text-dim)", lineHeight: 1.5 }}>
        {message}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost" onClick={onClose}>
          {cancelText}
        </button>
        <button 
          className={`btn ${confirmStyle === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          onClick={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

// Form Modal
function FormModal({ isOpen, onClose, onSubmit, title, children, submitText = "Save", isSubmitting = false }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit}>
        {children}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--hairline)" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : submitText}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Alert Modal
function AlertModal({ isOpen, onClose, title, message, type = "info" }) {
  const icons = {
    success: <IconCheck size={24} />,
    error: <IconX size={24} />,
    warning: <IconBell size={24} />,
    info: <IconBell size={24} />
  };

  const colors = {
    success: "var(--pass)",
    error: "var(--fail)",
    warning: "var(--warn)",
    info: "var(--text)"
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        <div style={{ color: colors[type], flexShrink: 0 }}>
          {icons[type]}
        </div>
        <div style={{ color: "var(--text-dim)", lineHeight: 1.5 }}>
          {message}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={onClose}>
          OK
        </button>
      </div>
    </Modal>
  );
}

// Export to window
Object.assign(window, { Modal, ConfirmDialog, FormModal, AlertModal });

// Made with Bob
