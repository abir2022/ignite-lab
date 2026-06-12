import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const CourseDirectory = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*, teacher:profiles(full_name)');
      
      if (data) setCourses(data);
      setLoading(false);
    };
    fetchCourses();
  }, []);
  return (
    <div className="flex flex-col md:flex-row max-w-container-max mx-auto px-4 md:px-margin-desktop py-gutter gap-gutter">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-64 shrink-0 flex flex-col gap-gutter">
        <div className="glass-card p-4 md:p-gutter rounded-xl shadow-[0_4px_20px_rgba(34,211,238,0.15)]">
          <h3 className="font-headline-md text-xl md:text-headline-md text-primary mb-gutter">Filters</h3>
          
          <div className="flex flex-col gap-gutter">
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant mb-base">CATEGORY</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-body-md text-on-surface cursor-pointer group">
                  <input className="rounded border-outline text-primary focus:ring-primary" type="checkbox" />
                  <span className="group-hover:text-primary transition-colors">Software</span>
                </label>
                <label className="flex items-center gap-2 text-body-md text-on-surface cursor-pointer group">
                  <input defaultChecked className="rounded border-outline text-primary focus:ring-primary" type="checkbox" />
                  <span className="group-hover:text-primary transition-colors font-semibold">Hardware</span>
                </label>
                <label className="flex items-center gap-2 text-body-md text-on-surface cursor-pointer group">
                  <input className="rounded border-outline text-primary focus:ring-primary" type="checkbox" />
                  <span className="group-hover:text-primary transition-colors">Robotics</span>
                </label>
                <label className="flex items-center gap-2 text-body-md text-on-surface cursor-pointer group">
                  <input className="rounded border-outline text-primary focus:ring-primary" type="checkbox" />
                  <span className="group-hover:text-primary transition-colors">Quantum</span>
                </label>
              </div>
            </div>
            
            <div className="border-t border-outline-variant pt-gutter">
              <p className="font-label-md text-label-md text-on-surface-variant mb-base">DIFFICULTY</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-primary-container font-label-sm">Beginner</span>
                <span className="px-3 py-1 rounded-full bg-primary text-on-primary font-label-sm">Intermediate</span>
                <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-primary-container font-label-sm">Advanced</span>
              </div>
            </div>
            
            <div className="border-t border-outline-variant pt-gutter">
              <p className="font-label-md text-label-md text-on-surface-variant mb-base">ENROLLMENT STATUS</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-body-md text-on-surface cursor-pointer group">
                  <input className="text-primary focus:ring-primary" name="status" type="radio" />
                  <span className="group-hover:text-primary">Not Started</span>
                </label>
                <label className="flex items-center gap-2 text-body-md text-on-surface cursor-pointer group">
                  <input className="text-primary focus:ring-primary" name="status" type="radio" />
                  <span className="group-hover:text-primary">In Progress</span>
                </label>
                <label className="flex items-center gap-2 text-body-md text-on-surface cursor-pointer group">
                  <input className="text-primary focus:ring-primary" name="status" type="radio" />
                  <span className="group-hover:text-primary">Completed</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        
        {/* Promotion Card */}
        <div className="ignition-gradient p-gutter rounded-xl text-on-primary shadow-lg hidden md:block">
          <span className="material-symbols-outlined text-4xl mb-base">workspace_premium</span>
          <h4 className="font-headline-md text-headline-md mb-2">Get Lab Pass</h4>
          <p className="text-body-md mb-gutter opacity-90">Unlock unlimited simulation time and expert hardware tutorials.</p>
          <button className="w-full bg-surface-container-lowest text-secondary py-3 rounded-lg font-bold hover:bg-opacity-90 active:scale-95 transition-all">Explore Pro</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        <header className="mb-gutter flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="font-display-lg text-4xl md:text-display-lg text-on-background mb-base">Course Directory</h1>
            <p className="text-body-lg text-on-surface-variant max-w-2xl">Master modern engineering through immersive virtual simulations and hands-on lab projects.</p>
          </div>
          
          {/* Search Bar - Moved to right side on desktop, full width on mobile */}
          <div className="w-full md:w-auto flex flex-col md:flex-row items-center gap-4">
            <div className="relative w-full md:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
              <input className="w-full bg-surface-container-low border-none rounded-lg py-2 pl-10 pr-4 focus:ring-2 focus:ring-primary text-body-md" placeholder="Search lab modules..." type="text" />
            </div>
            <div className="hidden md:flex gap-2 bg-surface-container-low p-1 rounded-lg">
              <button className="p-2 bg-white rounded shadow-sm text-primary">
                <span className="material-symbols-outlined">grid_view</span>
              </button>
              <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">view_list</span>
              </button>
            </div>
          </div>
        </header>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-gutter">
          
          {loading ? (
            <div className="col-span-full py-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : courses.length === 0 ? (
            <div className="col-span-full py-12 text-center text-on-surface-variant">
              No courses available yet.
            </div>
          ) : (
            courses.map(course => (
              <div key={course.id} className="glass-card rounded-xl overflow-hidden flex flex-col group shadow-[0_4px_20px_rgba(34,211,238,0.15)] border border-glass-border">
                <div className="h-48 relative overflow-hidden">
                  <img 
                    alt={course.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    src={course.thumbnail_url || 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&q=80'}
                  />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="px-3 py-1 rounded-full bg-glass-fill backdrop-blur-md border border-glass-border text-on-background font-label-sm">
                      {course.difficulty || 'All Levels'}
                    </span>
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-headline-md text-xl md:text-headline-md text-on-surface line-clamp-1">{course.title}</h3>
                    <span className="material-symbols-outlined text-outline hover:text-primary cursor-pointer">bookmark</span>
                  </div>
                  <p className="text-body-md text-on-surface-variant mb-gutter line-clamp-2">{course.description}</p>
                  
                  <div className="mt-auto">
                    <div className="flex items-center gap-base mb-gutter">
                      <span className="material-symbols-outlined text-tertiary">star</span>
                      <span className="text-label-sm text-on-surface-variant font-bold">New Course</span>
                    </div>
                    <div className="flex items-center justify-between gap-gutter">
                      <div className="flex flex-col">
                        <span className="text-label-sm text-on-surface-variant">Instructor</span>
                        <span className="font-bold text-on-surface text-sm line-clamp-1">{course.teacher?.full_name || 'DrilLab Instructor'}</span>
                      </div>
                      <Link to={`/courses/${course.id}/play`} className="ignition-gradient text-on-primary px-4 md:px-gutter py-3 rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all text-center whitespace-nowrap">
                        Start Learning
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          
        </div>

        {/* Pagination */}
        <div className="mt-gutter flex justify-center items-center gap-2 md:gap-base">
          <button className="p-2 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button className="w-10 h-10 rounded-lg bg-primary text-on-primary font-bold">1</button>
          <button className="hidden sm:block w-10 h-10 rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">2</button>
          <button className="hidden sm:block w-10 h-10 rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">3</button>
          <span className="px-2 text-outline">...</span>
          <button className="hidden sm:block w-10 h-10 rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">12</button>
          <button className="p-2 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default CourseDirectory;
