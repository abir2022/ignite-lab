import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import AdminAnalyticsDashboard from './AdminAnalyticsDashboard';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('*, teacher:profiles(full_name)')
      .order('created_at', { ascending: false });
    if (data) setCourses(data);
    setLoading(false);
  };

  const handleDelete = async (courseId, courseTitle) => {
    if (!window.confirm(`Are you sure you want to completely delete "${courseTitle}"?`)) return;
    
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) {
      alert("Error deleting course: " + error.message);
    } else {
      fetchCourses();
    }
  };
  return (
    <div className="max-w-container-max mx-auto px-4 md:px-margin-desktop py-gutter">
      <div className="mb-gutter">
        <h1 className="font-headline-lg text-3xl text-on-surface">Admin Dashboard</h1>
        <p className="text-on-surface-variant font-body-md mt-1">Manage platform content, courses, users, and 3D assets.</p>
      </div>

      <AdminAnalyticsDashboard />

      <div className="mt-gutter">
        <h2 className="font-headline-md text-xl text-on-surface mb-6">Management Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <Link to="/teacher/courses/new" className="glass-card p-6 rounded-xl border border-glass-border hover:shadow-lg hover:border-primary transition-all group">
          <span className="material-symbols-outlined text-4xl text-primary mb-4" style={{fontVariationSettings: "'FILL' 1"}}>post_add</span>
          <h2 className="font-headline-md text-xl text-on-surface mb-2 group-hover:text-primary transition-colors">Create New Course</h2>
          <p className="text-on-surface-variant">Build a new course, schedule modules, and configure Live Sessions for teachers.</p>
        </Link>

        <Link to="/admin/requests" className="glass-card p-6 rounded-xl border border-glass-border hover:shadow-lg hover:border-error transition-all group">
          <span className="material-symbols-outlined text-4xl text-error mb-4" style={{fontVariationSettings: "'FILL' 1"}}>password</span>
          <h2 className="font-headline-md text-xl text-on-surface mb-2 group-hover:text-error transition-colors">Password Requests</h2>
          <p className="text-on-surface-variant">Review and approve password change requests from students and teachers.</p>
        </Link>

        <Link to="/admin/users" className="glass-card p-6 rounded-xl border border-glass-border hover:shadow-lg hover:border-secondary transition-all group">
          <span className="material-symbols-outlined text-4xl text-secondary mb-4" style={{fontVariationSettings: "'FILL' 1"}}>group</span>
          <h2 className="font-headline-md text-xl text-on-surface mb-2 group-hover:text-secondary transition-colors">User Management</h2>
          <p className="text-on-surface-variant">Promote students to teachers and manage platform access for all users.</p>
        </Link>

        <Link to="/admin/hardware" className="glass-card p-6 rounded-xl border border-glass-border hover:shadow-lg hover:border-primary transition-all group">
          <span className="material-symbols-outlined text-4xl text-primary mb-4" style={{fontVariationSettings: "'FILL' 1"}}>view_in_ar</span>
          <h2 className="font-headline-md text-xl text-on-surface mb-2 group-hover:text-primary transition-colors">3D Lab Assets</h2>
          <p className="text-on-surface-variant">Upload and manage GLB models for the interactive 3D Hardware Lab.</p>
        </Link>
      </div>
    </div>

    <div className="mt-gutter">
      <h2 className="font-headline-md text-2xl text-on-surface mb-6">Manage Courses</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : courses.length === 0 ? (
          <div className="glass-card p-8 rounded-xl text-center text-on-surface-variant">
            No courses found. Create your first course above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (
              <div key={course.id} className="glass-card rounded-xl border border-glass-border overflow-hidden flex flex-col group">
                <div className="h-32 bg-surface-container-low relative">
                  <img src={course.thumbnail_url || 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&q=80'} alt={course.title} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${course.is_published ? 'bg-green-500/80 text-white' : 'bg-orange-500/80 text-white'}`}>
                      {course.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-on-surface line-clamp-1 mb-1">{course.title}</h3>
                  <p className="text-xs text-on-surface-variant line-clamp-2 mb-4">{course.description}</p>
                  
                  <div className="mt-auto grid grid-cols-2 gap-2 border-t border-outline-variant/30 pt-4">
                    <button onClick={() => navigate(`/teacher/courses/${course.id}`)} className="flex items-center justify-center gap-1 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors text-sm font-bold">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(course.id, course.title)} className="flex items-center justify-center gap-1 py-2 rounded-lg bg-error/10 text-error hover:bg-error hover:text-white transition-colors text-sm font-bold">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
