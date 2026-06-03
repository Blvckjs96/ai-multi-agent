import Modal from './Modal'

/**
 * Confirmation dialog built on top of Modal.
 * @param {{ open: boolean, title: string, message: string,
 *           confirmLabel?: string, cancelLabel?: string,
 *           danger?: boolean,
 *           onConfirm: () => void, onCancel: () => void }} props
 */
export default function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger = false,
  onConfirm, onCancel,
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="px-5 py-4">
        <p className="text-sm text-argo-secondary leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium text-argo-muted border border-argo-border hover:text-argo-secondary hover:bg-argo-elevated transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors
              ${danger
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-argo-cyan text-[#001218] hover:opacity-90'
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
