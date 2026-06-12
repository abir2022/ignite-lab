import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const TeacherProfile = () => {
  const { user, profile, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [department, setDepartment] = useState(profile?.department || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwordRequested, setPasswordRequested] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await updateProfile({
      full_name: fullName,
      bio,
      department,
      phone,
      avatar_url: avatarUrl,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });
    
    if (!error) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setAvatarUrl(urlData.publicUrl);
    }
  };

  const handlePasswordChangeRequest = () => {
    setPasswordRequested(true);
    // In production, this would send a notification to admin
    setTimeout(() => setPasswordRequested(false), 5000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-margin-desktop py-gutter">
      <div className="mb-gutter">
        <p className="text-on-surface-variant font-label-md text-label-md uppercase tracking-widest mb-1">Instructor Portal</p>
        <h1 className="font-headline-lg text-3xl text-on-surface">My Profile</h1>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-gutter">
        {/* Avatar Section */}
        <div className="glass-card p-6 rounded-xl border border-glass-border">
          <h2 className="font-headline-md text-lg text-on-surface mb-4">Profile Picture</h2>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-4xl font-bold text-primary border-4 border-primary/20 overflow-hidden shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                fullName.charAt(0).toUpperCase() || 'T'
              )}
            </div>
            <div>
              <label className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-bold cursor-pointer hover:shadow-lg transition-all active:scale-95">
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Upload Photo
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
              <p className="text-xs text-on-surface-variant mt-2">JPG, PNG, or GIF. Max 2MB.</p>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="glass-card p-6 rounded-xl border border-glass-border">
          <h2 className="font-headline-md text-lg text-on-surface mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
              />
            </div>
            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full bg-surface-container border border-outline-variant rounded-xl py-3 px-4 text-on-surface-variant cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g., Computer Science"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
              />
            </div>
            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 XXXX XXXXXX"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell students about your expertise and teaching philosophy..."
              rows={4}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all resize-none"
            />
          </div>
        </div>

        {/* Security */}
        <div className="glass-card p-6 rounded-xl border border-glass-border">
          <h2 className="font-headline-md text-lg text-on-surface mb-4">Security</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-on-surface font-bold text-sm">Password</p>
              <p className="text-on-surface-variant text-xs">Request a password change from the administrator.</p>
            </div>
            <button
              type="button"
              onClick={handlePasswordChangeRequest}
              disabled={passwordRequested}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${passwordRequested ? 'bg-green-100 text-green-700' : 'border border-outline-variant text-on-surface-variant hover:bg-surface-variant active:scale-95'}`}
            >
              {passwordRequested ? '✓ Request Sent' : 'Request Change'}
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className={`px-8 py-3 rounded-xl font-bold text-on-primary transition-all flex items-center gap-2 ${saving ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:shadow-lg hover:shadow-primary/20 active:scale-95'}`}
          >
            {saving ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Saving...</>
            ) : (
              <><span className="material-symbols-outlined text-[18px]">save</span> Save Changes</>
            )}
          </button>
          {saved && <span className="text-green-600 font-bold text-sm flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">check_circle</span> Profile updated!</span>}
        </div>
      </form>
    </div>
  );
};

export default TeacherProfile;
