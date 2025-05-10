import React, { useEffect, useState } from 'react';

interface ProfilePicModalProps {
  onSelect: (pic: string) => void;
  onClose: () => void;
}

const ProfilePicModal: React.FC<ProfilePicModalProps> = ({ onSelect, onClose }) => {
  const [pics, setPics] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/profile-pictures').then(r => r.json()).then(setPics);
  }, []);
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000a', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#23234a', color: '#fff', borderRadius: 16, padding: 32, minWidth: 320, maxWidth: 400, textAlign: 'center' }}>
        <h2>Choose Profile Picture</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', margin: '16px 0' }}>
          {pics.map(pic => (
            <img key={pic} src={`/profile-pictures/${pic}`} alt={pic} style={{ width: 56, height: 56, borderRadius: 12, border: '2px solid #fff', cursor: 'pointer' }} onClick={() => onSelect(pic)} />
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: 16, padding: '8px 24px' }}>Cancel</button>
      </div>
    </div>
  );
};

export default ProfilePicModal;
