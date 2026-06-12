import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const TeacherDashboard = () => {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Instructor';

  useEffect(() => {
    if (user) {
      fetchCourses();
      fetchAssignments();
      fetchSessions();
    }
  }, [user]);

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false });
    if (data) setCourses(data);
  };

  const fetchAssignments = async () => {
    const { data } = await supabase.from('assignments').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false }).limit(5);
    if (data) setAssignments(data);
  };

  const fetchSessions = async () => {
    const { data } = await supabase.from('scheduled_sessions').select('*').eq('teacher_id', user.id).order('scheduled_at', { ascending: true });
    if (data) setSessions(data);
  };

  // Mock student performance data (will be real when enrollment table is added)
  const studentPerformance = [
    { name: 'Top Performer', value: '94%', trend: '+12%', icon: 'emoji_events', color: 'text-yellow-500' },
    { name: 'Class Average', value: '78%', trend: '+5%', icon: 'trending_up', color: 'text-green-500' },
    { name: 'At Risk', value: '3', trend: 'students', icon: 'warning', color: 'text-orange-500' },
    { name: 'Completion Rate', value: '82%', trend: '+8%', icon: 'check_circle', color: 'text-primary' },
  ];

  const recentStudents = [
    { name: 'Rafi Ahmed', progress: 92, course: 'Python for AI', status: 'active' },
    { name: 'Nadia Islam', progress: 85, course: 'Introduction to Robotics', status: 'active' },
    { name: 'Tanvir Hasan', progress: 68, course: 'Python for AI', status: 'active' },
    { name: 'Priya Das', progress: 45, course: 'Quantum Simulation', status: 'at-risk' },
    { name: 'Omar Faruk', progress: 31, course: 'Introduction to Robotics', status: 'at-risk' },
  ];

  return (
    <div className="max-w-container-max mx-auto px-4 md:px-margin-desktop py-gutter">
      {/* Welcome Header */}
      <section className="mb-gutter flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-on-surface-variant font-label-md text-label-md uppercase tracking-widest mb-1">Instructor Portal</p>
          <h1 className="font-headline-lg text-3xl md:text-headline-lg text-on-surface">Welcome, {displayName}</h1>
          <p className="text-on-surface-variant font-body-md mt-1">Manage your courses, track student progress, and schedule sessions.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/teacher/courses/new" className="ignition-gradient text-on-primary px-5 py-3 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all shadow-lg">
            <span className="material-symbols-outlined">add</span>
            New Course
          </Link>
          <Link to="/teacher/profile" className="bg-surface-variant text-on-surface-variant px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary hover:text-on-primary transition-all">
            <span className="material-symbols-outlined">person</span>
            Profile
          </Link>
        </div>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-gutter">
        {[
          { label: 'My Courses', value: courses.length, icon: 'school', color: 'bg-primary' },
          { label: 'Assignments', value: assignments.length, icon: 'assignment', color: 'bg-secondary' },
          { label: 'Upcoming Sessions', value: sessions.filter(s => s.status === 'upcoming').length, icon: 'videocam', color: 'bg-tertiary' },
          { label: 'Total Students', value: '—', icon: 'group', color: 'bg-primary-container' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-4 rounded-xl border border-glass-border flex items-center gap-4">
            <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center text-white shrink-0`}>
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>{stat.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-on-surface">{stat.value}</p>
              <p className="text-xs text-on-surface-variant">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-gutter">
          
          {/* Student Performance Overview */}
          <div className="glass-card p-4 md:p-gutter rounded-xl border border-glass-border">
            <div className="flex justify-between items-center mb-gutter">
              <h2 className="font-headline-md text-xl text-on-surface">Student Performance</h2>
              <span className="text-xs text-on-surface-variant bg-surface-variant px-3 py-1 rounded-full">This Semester</span>
            </div>
            
            {/* Performance Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-gutter">
              {studentPerformance.map((item, i) => (
                <div key={i} className="bg-surface-container-low p-4 rounded-xl text-center">
                  <span className={`material-symbols-outlined text-3xl ${item.color} mb-2`} style={{fontVariationSettings: "'FILL' 1"}}>{item.icon}</span>
                  <p className="text-2xl font-bold text-on-surface">{item.value}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold mt-1">{item.name}</p>
                  <p className="text-xs text-green-600 font-bold mt-1">{item.trend}</p>
                </div>
              ))}
            </div>

            {/* Student List */}
            <h3 className="font-headline-md text-sm text-on-surface mb-3 uppercase tracking-wider">Recent Students</h3>
            <div className="flex flex-col gap-2">
              {recentStudents.map((student, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/30 hover:border-primary/20 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-on-surface text-sm truncate">{student.name}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {student.status === 'active' ? 'On Track' : 'At Risk'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${student.progress >= 70 ? 'cyan-gradient' : 'bg-orange-400'}`} style={{width: `${student.progress}%`}}></div>
                      </div>
                      <span className="text-xs text-on-surface-variant font-bold shrink-0">{student.progress}%</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-1">{student.course}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* My Courses */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-headline-md text-xl text-on-surface">My Courses</h2>
              <Link to="/teacher/courses/new" className="text-primary font-label-md hover:underline">+ Create New</Link>
            </div>

            {courses.length === 0 ? (
              <div className="glass-card p-8 rounded-xl border border-glass-border text-center">
                <span className="material-symbols-outlined text-5xl text-outline mb-4">library_books</span>
                <h3 className="font-headline-md text-lg text-on-surface mb-2">No courses yet</h3>
                <p className="text-on-surface-variant text-sm mb-4">Create your first course to start teaching.</p>
                <Link to="/teacher/courses/new" className="inline-flex items-center gap-2 ignition-gradient text-white px-6 py-3 rounded-xl font-bold active:scale-95 transition-all">
                  <span className="material-symbols-outlined">add</span>
                  Create Course
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {courses.map(course => (
                  <div key={course.id} className="glass-card p-4 rounded-xl border border-glass-border flex items-center justify-between gap-4 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary">school</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-on-surface truncate">{course.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded-full">{course.level || 'Draft'}</span>
                          <span className="text-xs text-on-surface-variant">{course.modules_count} modules</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${course.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {course.is_published ? 'Published' : 'Draft'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Link to={`/teacher/courses/${course.id}`} className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors shrink-0">
                      <span className="material-symbols-outlined">edit</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Assignments */}
          <div>
            <h2 className="font-headline-md text-xl text-on-surface mb-4">Recent Assignments</h2>
            {assignments.length === 0 ? (
              <p className="text-on-surface-variant text-sm">No assignments created yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {assignments.map(a => (
                  <div key={a.id} className="glass-card p-4 rounded-xl border border-glass-border flex items-center gap-4">
                    <span className="material-symbols-outlined text-secondary">assignment</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-on-surface text-sm truncate">{a.title}</p>
                      <p className="text-xs text-on-surface-variant">Due: {a.due_date ? new Date(a.due_date).toLocaleDateString() : 'No deadline'} • {a.assigned_to === 'all' ? 'All students' : 'Specific student'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Upcoming Sessions + Quick Actions */}
        <div className="flex flex-col gap-gutter">
          <div>
            <h2 className="font-headline-md text-xl text-on-surface mb-4">Upcoming Classes</h2>
            {sessions.length === 0 ? (
              <div className="glass-card p-6 rounded-xl border border-glass-border text-center">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">event</span>
                <p className="text-on-surface-variant text-sm">No upcoming sessions scheduled.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sessions.map(session => {
                  const sessionTime = new Date(session.scheduled_at);
                  const now = new Date();
                  const canStartSoon = (sessionTime - now) < 15 * 60 * 1000; // 15 min before

                  return (
                    <div key={session.id} className="glass-card p-4 rounded-xl border border-glass-border hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${session.status === 'live' ? 'bg-red-100 text-red-600' : canStartSoon ? 'bg-yellow-100 text-yellow-700' : 'bg-primary/10 text-primary'}`}>
                          {session.status === 'live' ? '● LIVE NOW' : canStartSoon ? '⏰ Starting Soon' : 'Upcoming'}
                        </span>
                      </div>
                      <h3 className="font-bold text-on-surface text-sm mb-1">{session.title}</h3>
                      <p className="text-xs text-on-surface-variant mb-3">
                        {sessionTime.toLocaleDateString()} at {sessionTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} • {session.duration_minutes} min
                      </p>
                      
                      {session.status === 'live' ? (
                        <Link to="/live" className="flex items-center justify-center gap-2 bg-red-500 text-white py-2.5 rounded-lg font-bold text-sm active:scale-95 transition-all">
                          <span className="material-symbols-outlined text-[18px]">videocam</span>
                          Go to Live Class
                        </Link>
                      ) : canStartSoon ? (
                        <Link to="/live" className="flex items-center justify-center gap-2 ignition-gradient text-white py-2.5 rounded-lg font-bold text-sm active:scale-95 transition-all shadow-md">
                          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                          Start Class Now
                        </Link>
                      ) : (
                        <div className="bg-surface-container-low p-2 rounded-lg text-center">
                          <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Class starts in</p>
                          <p className="text-sm text-primary font-bold">{Math.ceil((sessionTime - now) / (1000 * 60 * 60))} hours</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-4 rounded-xl border border-glass-border">
            <h3 className="font-headline-md text-sm text-on-surface mb-3">Quick Actions</h3>
            <div className="flex flex-col gap-2">
              <Link to="/lab" className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-variant transition-colors text-on-surface-variant hover:text-on-surface text-sm">
                <span className="material-symbols-outlined">code</span>
                Open Code Lab
              </Link>
              <Link to="/hardware" className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-variant transition-colors text-on-surface-variant hover:text-on-surface text-sm">
                <span className="material-symbols-outlined">view_in_ar</span>
                Open 3D Lab
              </Link>
              <Link to="/live" className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-variant transition-colors text-on-surface-variant hover:text-on-surface text-sm">
                <span className="material-symbols-outlined">screen_share</span>
                Share Lab in Class
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
