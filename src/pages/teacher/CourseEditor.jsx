import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const CourseEditor = () => {
  const { user, isAdmin, isTeacher } = useAuth();
  const navigate = useNavigate();
  const { courseId } = useParams();
  const isEditing = courseId && courseId !== 'new';

  // Course State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Software');
  const [level, setLevel] = useState('Beginner');
  const [duration, setDuration] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  
  // Modules State
  const [modules, setModules] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    // If not Admin or Teacher, boot them
    if (!isAdmin && !isTeacher) {
      navigate('/dashboard');
      return;
    }

    if (isEditing) {
      fetchCourse();
      fetchModules();
    }
  }, [courseId]);

  const fetchCourse = async () => {
    const { data } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (data) {
      setTitle(data.title);
      setDescription(data.description || '');
      setCategory(data.category || 'Software');
      setLevel(data.level || 'Beginner');
      setDuration(data.duration || '');
      setThumbnailUrl(data.thumbnail_url || '');
      setIsPublished(data.is_published);
    }
  };

  const fetchModules = async () => {
    const { data } = await supabase
      .from('course_modules')
      .select('*')
      .eq('course_id', courseId)
      .order('module_order', { ascending: true });
    
    if (data) setModules(data);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;

    const { error } = await supabase.storage.from('course-thumbnails').upload(fileName, file);

    if (error) {
      alert('Error uploading image: ' + error.message);
    } else {
      const { data } = supabase.storage.from('course-thumbnails').getPublicUrl(fileName);
      setThumbnailUrl(data.publicUrl);
    }
    setUploadingImage(false);
  };

  const addModule = () => {
    setModules([...modules, { 
      id: `temp-${Date.now()}`, 
      title: '', 
      description: '', 
      scheduled_date: '', 
      scheduled_time: '',
      module_order: modules.length + 1
    }]);
  };

  const updateModule = (index, field, value) => {
    const newModules = [...modules];
    newModules[index][field] = value;
    setModules(newModules);
  };

  const removeModule = async (index, moduleId) => {
    if (!moduleId.toString().startsWith('temp-')) {
      // It's a real DB module, delete it
      await supabase.from('course_modules').delete().eq('id', moduleId);
    }
    const newModules = [...modules];
    newModules.splice(index, 1);
    setModules(newModules);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdmin && !isEditing) {
      alert("Only Admins can create new courses.");
      return;
    }
    
    setSaving(true);

    const courseData = {
      title,
      description,
      category,
      level,
      duration,
      thumbnail_url: thumbnailUrl,
      is_published: isPublished,
      modules_count: modules.length,
      updated_at: new Date().toISOString(),
      // Force admin/teacher ID
      teacher_id: user.id 
    };

    let result;
    let savedCourseId = courseId;

    if (isEditing) {
      result = await supabase.from('courses').update(courseData).eq('id', courseId).select().single();
    } else {
      result = await supabase.from('courses').insert(courseData).select().single();
      if (result.data) savedCourseId = result.data.id;
    }

    if (result.error) {
      console.error('Error saving course:', result.error);
      alert('Failed to save course: ' + result.error.message);
      setSaving(false);
      return;
    }

    // Save Modules
    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      const modData = {
        course_id: savedCourseId,
        title: mod.title,
        description: mod.description,
        scheduled_date: mod.scheduled_date || null,
        scheduled_time: mod.scheduled_time || null,
        module_order: i + 1
      };

      if (mod.id && !mod.id.toString().startsWith('temp-')) {
        await supabase.from('course_modules').update(modData).eq('id', mod.id);
      } else {
        await supabase.from('course_modules').insert(modData);
      }
    }

    setSaving(false);
    navigate(isAdmin ? '/admin' : '/teacher');
  };

  const handleDeleteCourse = async () => {
    if (!window.confirm("Are you sure you want to delete this course completely?")) return;
    
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) {
      alert("Failed to delete: " + error.message);
    } else {
      navigate('/admin');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-margin-desktop py-gutter">
      <div className="flex justify-between items-center mb-gutter">
        <div>
          <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-primary flex items-center gap-1 text-sm mb-4 transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back
          </button>
          <h1 className="font-headline-lg text-3xl text-on-surface">{isEditing ? 'Edit Course' : 'Create New Course'}</h1>
        </div>
        
        {isAdmin && isEditing && (
          <button onClick={handleDeleteCourse} className="text-error bg-error/10 hover:bg-error hover:text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Delete Course
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-gutter">
        
        {/* Course Core Details */}
        <div className="glass-card p-6 rounded-xl border border-glass-border">
          <h2 className="font-headline-md text-lg text-on-surface mb-4">Course Identity</h2>
          
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="w-full md:w-1/3 shrink-0">
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Course Thumbnail</label>
              <div className="w-full aspect-video rounded-xl bg-surface-container-low border-2 border-dashed border-outline-variant overflow-hidden relative flex flex-col items-center justify-center group">
                {thumbnailUrl ? (
                  <>
                    <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white font-bold">Change Image</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <span className="material-symbols-outlined text-4xl text-outline mb-2">add_photo_alternate</span>
                    <p className="text-sm text-on-surface-variant">Upload Image</p>
                  </div>
                )}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-surface/80 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4">
              <div>
                <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Course Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Introduction to Robotics"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
                />
              </div>
              <div>
                <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will students learn in this course?"
                  rows={3}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all resize-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary outline-none text-on-surface transition-all">
                <option>Software</option>
                <option>Hardware</option>
                <option>Robotics</option>
                <option>Quantum</option>
                <option>AI & ML</option>
              </select>
            </div>
            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Difficulty Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary outline-none text-on-surface transition-all">
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Total Duration</label>
              <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g., 4 Weeks" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary outline-none text-on-surface transition-all" />
            </div>
          </div>
        </div>

        {/* Modules & Scheduling */}
        <div className="glass-card p-6 rounded-xl border border-glass-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-headline-md text-lg text-on-surface">Course Modules & Scheduling</h2>
            <button type="button" onClick={addModule} className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
              <span className="material-symbols-outlined text-[18px]">add_circle</span> Add Module
            </button>
          </div>
          
          {modules.length === 0 ? (
            <div className="text-center py-8 bg-surface-container-low rounded-xl border border-dashed border-outline-variant">
              <p className="text-on-surface-variant text-sm mb-2">No modules created yet.</p>
              <button type="button" onClick={addModule} className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary/20 transition-colors">
                Add First Module
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {modules.map((mod, index) => (
                <div key={mod.id} className="bg-surface-container-low p-4 rounded-xl border border-outline-variant relative">
                  <button type="button" onClick={() => removeModule(index, mod.id)} className="absolute top-4 right-4 text-outline hover:text-error transition-colors">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                  
                  <h3 className="font-bold text-sm text-on-surface-variant mb-3 uppercase tracking-wider">Module {index + 1}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-on-surface-variant text-xs font-bold mb-1">Module Title *</label>
                      <input 
                        type="text" 
                        required
                        value={mod.title} 
                        onChange={(e) => updateModule(index, 'title', e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg py-2 px-3 focus:ring-2 focus:ring-primary outline-none text-on-surface text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-on-surface-variant text-xs font-bold mb-1">Short Description</label>
                      <input 
                        type="text" 
                        value={mod.description} 
                        onChange={(e) => updateModule(index, 'description', e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg py-2 px-3 focus:ring-2 focus:ring-primary outline-none text-on-surface text-sm"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex items-center gap-2 text-primary shrink-0">
                      <span className="material-symbols-outlined text-[20px]">event</span>
                      <span className="font-bold text-sm">Schedule Live Session:</span>
                    </div>
                    <div className="flex-1 flex gap-2 w-full">
                      <input 
                        type="date" 
                        value={mod.scheduled_date}
                        onChange={(e) => updateModule(index, 'scheduled_date', e.target.value)}
                        className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg py-1.5 px-3 focus:ring-2 focus:ring-primary outline-none text-on-surface text-sm"
                      />
                      <input 
                        type="time" 
                        value={mod.scheduled_time}
                        onChange={(e) => updateModule(index, 'scheduled_time', e.target.value)}
                        className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg py-1.5 px-3 focus:ring-2 focus:ring-primary outline-none text-on-surface text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Publish Toggle */}
        <div className="glass-card p-6 rounded-xl border border-glass-border flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-lg text-on-surface">Publish Course</h2>
            <p className="text-on-surface-variant text-sm">When published, students can discover and enroll in this course.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsPublished(!isPublished)}
            className={`w-14 h-8 rounded-full transition-colors relative ${isPublished ? 'bg-primary' : 'bg-outline-variant'}`}
          >
            <div className={`w-6 h-6 rounded-full bg-white shadow-md absolute top-1 transition-transform ${isPublished ? 'translate-x-7' : 'translate-x-1'}`}></div>
          </button>
        </div>

        {/* Save */}
        <button
          type="submit"
          disabled={saving}
          className={`w-full py-4 rounded-xl font-bold text-on-primary transition-all flex items-center justify-center gap-2 ${saving ? 'bg-primary/50 cursor-not-allowed' : 'ignition-gradient hover:shadow-lg active:scale-[0.98]'}`}
        >
          {saving ? (
            <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Saving...</>
          ) : (
            <><span className="material-symbols-outlined">save</span> {isEditing ? 'Save Changes' : 'Create Course'}</>
          )}
        </button>
      </form>
    </div>
  );
};

export default CourseEditor;
