// `motion` (npm package, React import path `motion/react`) is the one
// exception to "no dependencies beyond the spec" — it gives us real spring
// physics for free instead of hand-rolling pointer-tracking + rubber-band
// math. AnimatePresence lets a component animate OUT before React actually
// removes it from the tree (plain React unmounts instantly, no chance to
// animate an exit).
import { motion, AnimatePresence } from 'motion/react'

// A bottom sheet you swipe down to dismiss — build-plan §6e: "no modals
// that require a precise close tap." drag="y" + dragConstraints pins it to
// the y-axis; dragElastic makes it resist (rubber-band) past the top edge
// instead of flying off; onDragEnd checks both distance AND velocity so a
// fast short flick dismisses same as a slow long drag — apple-design §6.
export default function Sheet({ open, onClose, children }) {
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
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 500) onClose()
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="sheet-handle" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
