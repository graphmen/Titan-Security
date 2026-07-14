import { Camera } from 'lucide-react';

export default function ProfilePhoto({
  photoUrl,
  initials,
  name = '',
  size = 'md',
  editable = false,
  onEdit,
  busy = false,
  onDuty = false,
}) {
  const sizeClass = size === 'lg' ? 'mob-avatar-lg' : size === 'sm' ? 'mob-avatar-sm' : '';
  const dutyClass = onDuty ? 'on-duty' : '';

  const avatar = photoUrl ? (
    <img src={photoUrl} alt={name} className={`mob-avatar-img ${sizeClass} ${dutyClass}`} />
  ) : (
    <div className={`mob-avatar ${sizeClass} ${dutyClass}`}>{initials}</div>
  );

  if (!editable) {
    return <div className={`mob-avatar-wrap ${sizeClass}`}>{avatar}</div>;
  }

  return (
    <button
      type="button"
      className={`mob-avatar-wrap editable ${sizeClass}`}
      onClick={onEdit}
      disabled={busy}
      aria-label="Change profile photo"
    >
      {avatar}
      <span className="mob-avatar-camera">
        <Camera size={size === 'sm' ? 10 : 14} />
      </span>
    </button>
  );
}
