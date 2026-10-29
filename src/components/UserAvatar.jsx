import { useState } from 'react';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');

function getInitials(user) {
  const name = user?.fullName || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'User';
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function getProfilePictureUrl(profilePicture) {
  if (!profilePicture) return null;
  return profilePicture.startsWith('http') ? profilePicture : `${API_ORIGIN}${profilePicture}`;
}

export default function UserAvatar({ user, className = 'h-10 w-10', previewUrl = null }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = previewUrl || getProfilePictureUrl(user?.profile_picture);

  if (imageUrl && !imageFailed) {
    return <img src={imageUrl} alt="" onError={() => setImageFailed(true)} className={`${className} rounded-full object-cover`} />;
  }

  return (
    <div className={`flex ${className} items-center justify-center rounded-full bg-[#dff3e5] text-sm font-bold text-[#0c6d4d]`}>
      {getInitials(user)}
    </div>
  );
}
