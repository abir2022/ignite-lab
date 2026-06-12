import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const AdminUserManagement = () => {
  const [profiles, setProfiles] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: pData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { data: wData } = await supabase.from('teacher_whitelist').select('*').order('created_at', { ascending: false });
    
    if (pData) setProfiles(pData);
    if (wData) setWhitelist(wData);
    setLoading(false);
  };

  const handleToggleRole = async (profileId, currentRole) => {
    const newRole = currentRole === 'teacher' ? 'student' : 'teacher';
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profileId);
    if (!error) fetchData();
  };

  const handleAddTeacherToWhitelist = async (e) => {
    e.preventDefault();
    if (!newTeacherEmail) return;
    setAdding(true);
    
    // We'll create the profile in the whitelist first
    const { error } = await supabase.from('teacher_whitelist').insert({ email: newTeacherEmail.toLowerCase() });
    if (error) {
      alert("Error: " + error.message);
    } else {
      setNewTeacherEmail('');
      fetchData();
    }
    setAdding(false);
  };

  const [newTeacherPassword, setNewTeacherPassword] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');

  const handleCreateTeacherAccount = async (e) => {
    e.preventDefault();
    setAdding(true);

    try {
      // 1. Add to whitelist FIRST so the trigger sees them as a teacher during signup
      const { error: whitelistError } = await supabase.from('teacher_whitelist').insert({ email: newTeacherEmail.toLowerCase() });
      if (whitelistError && whitelistError.code !== '23505') { // Ignore if already whitelisted
        throw whitelistError;
      }

      // 2. We need a secondary supabase client that doesn't log the Admin out
      const { createClient } = await import('@supabase/supabase-js');
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false } }
      );

      // 3. Create the Auth account
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: newTeacherEmail,
        password: newTeacherPassword,
        options: { data: { full_name: newTeacherName } }
      });

      if (authError) throw authError;

      alert(`Teacher account created for ${newTeacherEmail}! They can now log in with the password you set.`);
      setNewTeacherEmail('');
      setNewTeacherPassword('');
      setNewTeacherName('');
      fetchData();
    } catch (err) {
      alert("Creation failed: " + err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveFromWhitelist = async (email) => {
    await supabase.from('teacher_whitelist').delete().eq('email', email);
    fetchData();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-margin-desktop py-gutter">
      <div className="mb-gutter">
        <h1 className="font-headline-lg text-3xl text-on-surface">User Management</h1>
        <p className="text-on-surface-variant font-body-md mt-1">Authorize teachers and manage user roles across the platform.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        
        {/* Left Column: Teacher Creation */}
        <div className="lg:col-span-1 space-y-gutter">
          <div className="glass-card p-6 rounded-xl border border-glass-border bg-secondary/5">
            <h2 className="font-headline-md text-lg text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">person_add</span>
              Create Teacher Account
            </h2>
            <p className="text-xs text-on-surface-variant mb-6">Create a full profile and password for a new teacher. They can log in immediately.</p>
            
            <form onSubmit={handleCreateTeacherAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">Teacher Name</label>
                <input
                  type="text"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  placeholder="Abir Hasan"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-secondary outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={newTeacherEmail}
                  onChange={(e) => setNewTeacherEmail(e.target.value)}
                  placeholder="teacher@drillab.org"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-secondary outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">Set Password</label>
                <input
                  type="password"
                  value={newTeacherPassword}
                  onChange={(e) => setNewTeacherPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-secondary outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={adding}
                className="w-full ignition-gradient py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2"
              >
                {adding ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[18px]">rocket_launch</span>}
                Create & Authorize
              </button>
            </form>
          </div>

          <div className="glass-card p-6 rounded-xl border border-glass-border">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase mb-4 tracking-widest">Authorized Emails</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {whitelist.length === 0 ? (
                <p className="text-sm text-center py-4 text-on-surface-variant italic">No pending authorizations.</p>
              ) : (
                whitelist.map(item => (
                  <div key={item.email} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 group">
                    <span className="text-sm font-bold text-on-surface truncate pr-2">{item.email}</span>
                    <button onClick={() => handleRemoveFromWhitelist(item.email)} className="text-error opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: User List */}
        <div className="lg:col-span-2">
          <div className="glass-card rounded-xl border border-glass-border overflow-hidden">
            <div className="p-6 border-b border-outline-variant/30 bg-surface-container-low flex items-center justify-between">
              <h2 className="font-headline-md text-lg text-on-surface">Registered Users</h2>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">{profiles.length} Total</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">User</th>
                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Joined</th>
                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {loading ? (
                    <tr><td colSpan="4" className="py-12 text-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                  ) : profiles.length === 0 ? (
                    <tr><td colSpan="4" className="py-12 text-center text-on-surface-variant">No users registered yet.</td></tr>
                  ) : (
                    profiles.map(user => (
                      <tr key={user.id} className="hover:bg-surface-container-lowest transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${user.role === 'teacher' ? 'bg-secondary' : user.role === 'admin' ? 'bg-error' : 'bg-primary'}`}>
                              {user.full_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-on-surface">{user.full_name}</p>
                              <p className="text-[10px] text-on-surface-variant">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                            user.role === 'teacher' ? 'bg-secondary/10 text-secondary' : 
                            user.role === 'admin' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-on-surface-variant">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {user.role !== 'admin' && (
                            <button 
                              onClick={() => handleToggleRole(user.id, user.role)}
                              className="text-xs font-bold text-primary hover:underline"
                            >
                              {user.role === 'teacher' ? 'Make Student' : 'Make Teacher'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserManagement;
