import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

const Dashboard = () => {
  const { user, profile, isAdmin, isTeacher } = useAuth();
  const [recentCourses, setRecentCourses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState({ courses: 0, sessions: 0, hours: 0 });
  const [loading, setLoading] = useState(true);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Engineer';
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 18 ? 'Good Afternoon' : 'Good Evening';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [coursesRes, attendanceRes, courseCountRes] = await Promise.all([
          supabase.from('courses').select('*').order('created_at', { ascending: false }).limit(4),
          supabase.from('attendance').select('*, course:courses(title)').eq('student_id', user.id).order('joined_at', { ascending: false }).limit(5),
          supabase.from('courses').select('id', { count: 'exact' })
        ]);

        if (coursesRes.data) setRecentCourses(coursesRes.data);
        if (attendanceRes.data) setAttendance(attendanceRes.data);
        setStats({
          courses: courseCountRes.count || coursesRes.data?.length || 0,
          sessions: attendanceRes.data?.length || 0,
          hours: ((attendanceRes.data?.length || 0) * 1.5).toFixed(1)
        });
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      }
      setLoading(false);
    };
    fetchData();
  }, [user.id]);

  const labModules = [
    { title: 'Coding Lab', desc: 'PLC & Industrial Logic', icon: 'terminal', path: '/lab', color: 'bg-primary', textColor: 'text-slate-950' },
    { title: '3D Hardware Lab', desc: 'Exploded View & Annotations', icon: 'view_in_ar', path: '/hardware', color: 'bg-indigo-500', textColor: 'text-white' },
    { title: 'Live Session', desc: 'Real-time Collaboration', icon: 'stream', path: '/live', color: 'bg-emerald-500', textColor: 'text-white' },
    { title: 'Course Library', desc: 'Browse All Modules', icon: 'library_books', path: '/courses', color: 'bg-amber-500', textColor: 'text-slate-950' },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#020617] text-white">
      <div className="max-w-container-max mx-auto px-4 md:px-margin-desktop py-8 md:py-12">
        
        {/* Mission Control Header */}
        <section className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></div>
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-green-400">System Uplink Active</span>
            </div>
            <h1 className="text-3xl md:text-4xl text-white font-black tracking-tight">{greeting}, <span className="text-primary">{displayName}</span></h1>
            <p className="text-white/30 font-mono text-[10px] uppercase mt-2 tracking-widest">
              Session: {now.toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'})} • {now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {isAdmin && (
              <Link to="/admin" className="bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-red-500/20 transition-all text-xs font-bold uppercase tracking-widest">
                <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                Admin Panel
              </Link>
            )}
            <Link to="/lab" className="bg-white/5 border border-white/10 px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-white/10 transition-all text-xs font-bold uppercase tracking-widest">
              <span className="material-symbols-outlined text-primary text-base">terminal</span>
              Open Lab
            </Link>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Active Modules', value: stats.courses, icon: 'school', color: 'text-primary' },
            { label: 'Lab Sessions', value: stats.sessions, icon: 'science', color: 'text-emerald-400' },
            { label: 'Total Hours', value: `${stats.hours}h`, icon: 'schedule', color: 'text-amber-400' },
            { label: 'System Status', value: 'Nominal', icon: 'verified', color: 'text-green-400' }
          ].map((stat, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all">
              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/[0.02] group-hover:bg-white/[0.05] transition-all"></div>
              <span className={`material-symbols-outlined text-xl ${stat.color} mb-3 block`}>{stat.icon}</span>
              <p className="text-2xl font-black font-mono text-white">{stat.value}</p>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1 font-bold">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* Quick Access Lab Launchers */}
        <section className="mb-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-6 flex items-center gap-3">
            <span className="w-8 h-[1px] bg-white/20"></span> Quick Launch
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {labModules.map((lab, i) => (
              <Link to={lab.path} key={i} className={`${lab.color} ${lab.textColor} rounded-2xl p-5 md:p-6 flex flex-col gap-4 hover:scale-[1.02] active:scale-[0.98] transition-transform group`}>
                <span className="material-symbols-outlined text-2xl md:text-3xl opacity-80 group-hover:opacity-100">{lab.icon}</span>
                <div>
                  <h3 className="font-bold text-sm md:text-base">{lab.title}</h3>
                  <p className="text-[10px] opacity-60 uppercase tracking-widest mt-1 font-bold">{lab.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            
            {/* Active Training Modules */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-3">
                  <span className="w-8 h-[1px] bg-white/20"></span> Active Modules
                </h2>
                <Link to="/courses" className="text-primary text-[10px] font-bold uppercase tracking-widest hover:underline">Full Directory</Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {loading ? (
                  <div className="col-span-2 py-20 flex justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
                ) : recentCourses.length === 0 ? (
                  <div className="col-span-2 glass-card border border-white/5 p-12 rounded-[2rem] text-center">
                    <span className="material-symbols-outlined text-4xl text-white/10 mb-4 block">school</span>
                    <p className="text-white/40 italic">No modules active. Start your first mission today.</p>
                    <Link to="/courses" className="mt-4 inline-block text-primary text-xs font-bold uppercase tracking-widest hover:underline">Browse Modules →</Link>
                  </div>
                ) : (
                  recentCourses.map(course => (
                    <Link to={`/courses/${course.id}/play`} key={course.id} className="glass-card group relative p-6 rounded-[2rem] border border-white/5 hover:border-primary/20 transition-all overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all"></div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-primary border border-white/10">
                            <span className="material-symbols-outlined">analytics</span>
                          </div>
                          <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Module</span>
                        </div>
                        <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">{course.title}</h3>
                        <p className="text-white/40 text-xs line-clamp-2 leading-relaxed">{course.description}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Lab Telemetry */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-3 mb-6">
                <span className="w-8 h-[1px] bg-white/20"></span> Lab Telemetry
              </h2>
              <div className="glass-card rounded-[2rem] border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-white/60">Session Logs</span>
                  <span className="text-[10px] font-mono text-green-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    RECORDING
                  </span>
                </div>
                <div className="p-2 md:p-4">
                  <table className="w-full text-left font-mono">
                    <tbody className="divide-y divide-white/5">
                      {attendance.length === 0 ? (
                        <tr><td className="p-8 text-center text-white/20 italic">No telemetry data recorded yet.</td></tr>
                      ) : (
                        attendance.map((log, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-3 md:px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_#22d3ee]"></div>
                                <span className="text-xs text-white/80">{log.session_type}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 md:px-4 text-[10px] text-white/40 uppercase tracking-widest hidden sm:table-cell">
                              {log.course?.title || 'General Lab'}
                            </td>
                            <td className="py-3 px-3 md:px-4 text-right">
                              <span className="text-[10px] text-white/20">{new Date(log.joined_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
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

          {/* Sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-8">
            
            {/* System Diagnostics */}
            <div className="glass-card p-6 md:p-8 rounded-[2rem] border border-white/5 bg-white/[0.02] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <span className="material-symbols-outlined text-primary/20 text-4xl">monitoring</span>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-6">Core Diagnostics</h3>
              <div className="space-y-5">
                {[
                  { label: 'System Uplink', val: '99.2%', pct: 99, color: 'bg-green-500' },
                  { label: '3D Engine', val: 'Ready', pct: 100, color: 'bg-primary' },
                  { label: 'Sim Fidelity', val: 'High', pct: 85, color: 'bg-indigo-500' },
                  { label: 'Data Sync', val: 'Live', pct: 100, color: 'bg-emerald-500' }
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">{stat.label}</span>
                      <span className="text-[10px] text-white font-mono font-bold">{stat.val}</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${stat.color} rounded-full`} style={{width: `${stat.pct}%`}}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-white/5 flex justify-between items-center">
                <span className="text-[9px] text-white/20 font-mono">DRIL-OS v4.2.0</span>
                <span className="text-[9px] text-white/20 font-mono">{now.toLocaleDateString()}</span>
              </div>
            </div>

            {/* Profile Summary */}
            <div className="glass-card p-6 md:p-8 rounded-[2rem] border border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/60 mb-6">Operator Profile</h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary text-slate-950 flex items-center justify-center font-black text-2xl">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-white">{displayName}</p>
                  <p className="text-[10px] text-white/30 font-mono truncate max-w-[180px]">{user?.email}</p>
                  {isAdmin && <span className="inline-block mt-1 text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-bold uppercase">Admin</span>}
                  {isTeacher && !isAdmin && <span className="inline-block mt-1 text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase">Instructor</span>}
                </div>
              </div>
              <Link to="/profile" className="w-full block text-center text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-primary transition-colors border border-white/5 rounded-xl py-3 hover:border-primary/20">
                Edit Profile
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
