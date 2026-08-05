export default function Field({ label, ...inputProps }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input {...inputProps} />
    </div>
  )
}
