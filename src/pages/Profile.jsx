import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

const Profile = () => {
  const { user, profile, isTeacher, isAdmin, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [department, setDepartment] = useState(profile?.department || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [secretQuestion, setSecretQuestion] = useState(profile?.secret_question || 'What is your pet dog?');
  const [secretAnswer, setSecretAnswer] = useState(profile?.secret_answer || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwordRequestStatus, setPasswordRequestStatus] = useState(null); // null, 'pending', 'sent'
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestAnswer, setRequestAnswer] = useState('');
  const [requestNewPassword, setRequestNewPassword] = useState('');

  useEffect(() => {
    if (user) {
      checkExistingRequest();
    }
  }, [user]);

  const checkExistingRequest = async () => {
    const { data } = await supabase
      .from('password_requests')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single();
    
    if (data) setPasswordRequestStatus('pending');
  };

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
      secret_question: secretQuestion,
      secret_answer: secretAnswer,
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
    
    const { error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });
    
    if (!error) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setAvatarUrl(urlData.publicUrl);
    }
  };

  const handlePasswordChangeRequest = async (e) => {
    e.preventDefault();
    if (passwordRequestStatus === 'pending') return;

    const { error } = await supabase.from('password_requests').insert({
      user_email: user.email,
      submitted_answer: requestAnswer,
      requested_password: requestNewPassword,
      status: 'pending'
    });

    if (!error) {
      setPasswordRequestStatus('pending');
      setShowRequestForm(false);
    } else {
      alert("Error sending request: " + error.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-margin-desktop py-gutter">
      <div className="mb-gutter">
        <p className="text-on-surface-variant font-label-md text-label-md uppercase tracking-widest mb-1">
          {isAdmin ? 'Admin Settings' : isTeacher ? 'Instructor Portal' : 'Student Portal'}
        </p>
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
                fullName.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'
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
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Department / Field</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
              />
            </div>
            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all resize-none"
            />
          </div>
        </div>

        {/* Security Questions */}
        <div className="glass-card p-6 rounded-xl border border-glass-border">
          <h2 className="font-headline-md text-lg text-on-surface mb-4">Identity Verification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Secret Question (For Password Recovery)</label>
              <input
                type="text"
                value={secretQuestion}
                onChange={(e) => setSecretQuestion(e.target.value)}
                placeholder="What is your pet dog?"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
              />
            </div>
            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Secret Answer</label>
              <input
                type="text"
                value={secretAnswer}
                onChange={(e) => setSecretAnswer(e.target.value)}
                placeholder="tommy"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
              />
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mt-3 italic">Note: The Admin will use this answer to verify your identity when you request a password change.</p>
        </div>

        {/* Security */}
        <div className="glass-card p-6 rounded-xl border border-glass-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-headline-md text-lg text-on-surface">Security</h2>
              <p className="text-on-surface-variant text-xs">Request a password change from the administrator.</p>
            </div>
            {passwordRequestStatus === 'pending' ? (
              <span className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg font-bold text-sm">✓ Pending Approval</span>
            ) : !showRequestForm ? (
              <button
                type="button"
                onClick={() => setShowRequestForm(true)}
                className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-lg font-bold text-sm hover:bg-surface-variant active:scale-95 transition-all"
              >
                Request Password Change
              </button>
            ) : null}
          </div>

          {showRequestForm && (
            <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant mt-4 animate-in fade-in slide-in-from-top-2">
              <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">security</span>
                Password Change Request
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Verify: {secretQuestion}</label>
                  <input
                    type="text"
                    value={requestAnswer}
                    onChange={(e) => setRequestAnswer(e.target.value)}
                    placeholder="Type your answer"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">New Requested Password</label>
                  <input
                    type="password"
                    value={requestNewPassword}
                    onChange={(e) => setRequestNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePasswordChangeRequest}
                  className="bg-primary text-on-primary px-4 py-2 rounded-lg font-bold text-xs hover:shadow-lg transition-all"
                >
                  Submit Request
                </button>
                <button
                  type="button"
                  onClick={() => setShowRequestForm(false)}
                  className="bg-surface-variant text-on-surface-variant px-4 py-2 rounded-lg font-bold text-xs hover:bg-outline-variant transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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

export default Profile;
