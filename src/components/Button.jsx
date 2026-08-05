// The simplest possible component: a function that returns JSX (the HTML-
// looking syntax below — it's not a string or a template, it compiles to
// plain JS calls that build a UI tree). `children` and `variant` are
// "props" — the values a parent passes in, like HTML attributes but for
// components you wrote yourself.
export default function Button({ children, variant = 'primary', className = '', ...rest }) {
  return (
    <button className={`btn btn-${variant} pressable ${className}`} {...rest}>
      {children}
    </button>
  )
}
