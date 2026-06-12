import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const AdminAnalyticsDashboard = () => {
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    courses: 0,
    enrollments: 0,
    activeToday: 0,
    pendingRequests: 0
  });
  const [recentEnrollments, setRecentEnrollments] = useState([]);
  const [topCourses, setTopCourses] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [topTeachers, setTopTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    
    // 1. Fetch Counts
    const [
      { count: studentCount },
      { count: teacherCount },
      { count: courseCount },
      { count: enrollmentCount },
      { count: requestCount },
      { data: activeData },
      { data: scheduleData }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('enrollments').select('*', { count: 'exact', head: true }),
      supabase.from('password_requests').select('*', { count: 'exact', head: true }),
      supabase.from('attendance').select('*').gte('joined_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('course_modules').select('*, course:courses(title)').not('scheduled_date', 'is', null).order('scheduled_date', { ascending: true }).limit(5)
    ]);

    setStats({
      students: studentCount || 0,
      teachers: teacherCount || 0,
      courses: courseCount || 0,
      enrollments: enrollmentCount || 0,
      activeToday: activeData?.length || 0,
      pendingRequests: requestCount || 0
    });

    if (scheduleData) setSchedules(scheduleData);

    // 2. Fetch Recent Enrollments
    const { data: recent } = await supabase
      .from('enrollments')
      .select('*, student:profiles(full_name, email), course:courses(title)')
      .order('enrolled_at', { ascending: false })
      .limit(5);
    if (recent) setRecentEnrollments(recent);

    // 3. Fetch Top Courses (Simple aggregation)
    const { data: top } = await supabase
      .from('enrollments')
      .select('course_id, course:courses(title)')
      .limit(100);
    
    if (top) {
      const counts = top.reduce((acc, curr) => {
        const title = curr.course.title;
        acc[title] = (acc[title] || 0) + 1;
        return acc;
      }, {});
      const sortedTop = Object.entries(counts)
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopCourses(sortedTop);
    }

    setLoading(false);
  };

  return (
    <div className="space-y-gutter">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Students', value: stats.students, icon: 'school', color: 'text-primary' },
          { label: 'Active Teachers', value: stats.teachers, icon: 'local_library', color: 'text-secondary' },
          { label: 'Total Courses', value: stats.courses, icon: 'menu_book', color: 'text-accent' },
          { label: 'Enrollments', value: stats.enrollments, icon: 'auto_stories', color: 'text-green-500' },
          { label: '24h Activity', value: stats.activeToday, icon: 'bolt', color: 'text-orange-500' },
        ].map((item, idx) => (
          <div key={idx} className="glass-card p-4 rounded-2xl border border-glass-border bg-surface-container-low shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className={`material-symbols-outlined ${item.color}`}>{item.icon}</span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{item.label}</span>
            </div>
            <div className="text-2xl font-headline-lg text-on-surface">{item.value}</div>
          </div>
        ))}
      </div>

      {stats.pendingRequests > 0 && (
        <div className="bg-error/10 border border-error/20 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3 text-error">
            <span className="material-symbols-outlined animate-bounce">priority_high</span>
            <p className="text-sm font-bold">You have {stats.pendingRequests} pending password reset requests that need attention.</p>
          </div>
          <button onClick={() => window.location.href='/admin/requests'} className="bg-error text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-error/90 transition-all shadow-lg shadow-error/20">
            Handle Now
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Top Courses */}
        <div className="lg:col-span-1 glass-card rounded-2xl border border-glass-border overflow-hidden flex flex-col">
          <div className="p-4 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
            <h3 className="font-headline-md text-sm text-on-surface font-bold uppercase tracking-wider">Top Performing Courses</h3>
            <span className="material-symbols-outlined text-primary text-sm">trending_up</span>
          </div>
          <div className="p-4 space-y-4 flex-1">
            {topCourses.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic text-center py-8">No enrollment data yet.</p>
            ) : (
              topCourses.map((course, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">{course.title}</p>
                    <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-1">
                      <div 
                        className="bg-primary h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${Math.min((course.count / stats.enrollments) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-on-surface-variant">{course.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Schedules */}
        <div className="lg:col-span-1 glass-card rounded-2xl border border-glass-border overflow-hidden flex flex-col">
          <div className="p-4 border-b border-outline-variant bg-surface-container-low">
            <h3 className="font-headline-md text-sm text-on-surface font-bold uppercase tracking-wider">Upcoming Schedule</h3>
          </div>
          <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[300px]">
            {schedules.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic text-center py-8">No upcoming live sessions.</p>
            ) : (
              schedules.map((session, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center gap-3">
                  <div className="flex flex-col items-center justify-center bg-primary/10 text-primary w-12 h-12 rounded-lg shrink-0">
                    <span className="text-[10px] font-bold uppercase">{new Date(session.scheduled_date).toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-lg font-bold">{new Date(session.scheduled_date).getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">{session.title}</p>
                    <p className="text-[10px] text-on-surface-variant truncate">{session.course.title}</p>
                    <p className="text-[10px] text-primary font-bold mt-1">{session.scheduled_time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Enrollments */}
        <div className="lg:col-span-1 glass-card rounded-2xl border border-glass-border overflow-hidden flex flex-col">
          <div className="p-4 border-b border-outline-variant bg-surface-container-low">
            <h3 className="font-headline-md text-sm text-on-surface font-bold uppercase tracking-wider">Recent Activity</h3>
          </div>
          <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[300px]">
            {recentEnrollments.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic text-center py-8">No recent enrollments.</p>
            ) : (
              recentEnrollments.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-low transition-colors">
                  <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-[10px]">
                    {entry.student.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-on-surface"><span className="text-primary">{entry.student.full_name}</span> joined <span className="text-secondary">{entry.course.title}</span></p>
                    <p className="text-[9px] text-on-surface-variant">{new Date(entry.enrolled_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsDashboard;
