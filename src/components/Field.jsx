export default function Field({ label, ...inputProps }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input {...inputProps} />
    </label>
  )
}
