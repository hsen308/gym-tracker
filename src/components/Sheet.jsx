// `motion` gives real spring physics instead of hand-rolled pointer tracking
// and rubber-band math. AnimatePresence lets a component animate OUT before
// React removes it from the tree (plain React unmounts instantly, with no
// chance to animate an exit).
import { motion, AnimatePresence } from 'motion/react'
import { useEffect } from 'react'

// A bottom sheet you swipe down to dismiss — build-plan §6e: "no modals that
// require a precise close tap." drag="y" pins it to the vertical axis;
// dragElastic resists (rubber-bands) past the top edge instead of letting it
// fly off; onDragEnd checks distance AND velocity so a fast short flick
// dismisses the same as a slow long drag (apple-design §6, momentum).
export default function Sheet({ open, onClose, children }) {
  // Escape should close it too — the sheet is used on desktop during
  // development, and a keyboard user otherwise has no way out.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 480) onClose()
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            // apple-design §4: drawer/sheet = slight bounce, because the
            // gesture that opens and closes it carries momentum.
            transition={{ type: 'spring', bounce: 0.12, duration: 0.36 }}
          >
            <div className="sheet-handle" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
