import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const AdminHardwareManagement = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Electronics',
    icon: 'memory'
  });
  const [file, setFile] = useState(null);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    const { data } = await supabase.from('hardware_models').select('*').order('created_at', { ascending: false });
    if (data) setModels(data);
    setLoading(false);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a GLB file");
    setUploading(true);

    try {
      // 1. Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `models/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('hardware-models')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('hardware-models')
        .getPublicUrl(filePath);

      // 3. Save to Database
      const { error: dbError } = await supabase.from('hardware_models').insert({
        ...formData,
        file_url: publicUrl
      });

      if (dbError) throw dbError;

      alert("Model uploaded successfully!");
      setFormData({ name: '', description: '', category: 'Electronics', icon: 'memory' });
      setFile(null);
      fetchModels();
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, fileUrl) => {
    if (!window.confirm("Delete this model?")) return;

    try {
      // Extract path from URL (simple version)
      const path = fileUrl.split('hardware-models/')[1];
      if (path) {
        await supabase.storage.from('hardware-models').remove([path]);
      }
      await supabase.from('hardware_models').delete().eq('id', id);
      fetchModels();
    } catch (err) {
      alert("Delete failed");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-margin-desktop py-gutter">
      <div className="mb-gutter">
        <h1 className="font-headline-lg text-3xl text-on-surface">3D Lab Management</h1>
        <p className="text-on-surface-variant font-body-md mt-1">Upload and manage GLB models for the hardware lab.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Upload Form */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 rounded-xl border border-glass-border">
            <h2 className="font-headline-md text-lg text-on-surface mb-4">Upload New Model</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">Model Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary outline-none h-20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option>Electronics</option>
                    <option>Robotics</option>
                    <option>Aerospace</option>
                    <option>General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">Icon (Material)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({...formData, icon: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">GLB File</label>
                <input
                  type="file"
                  accept=".glb"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full text-xs text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
              </div>
              <button
                type="submit"
                disabled={uploading}
                className="w-full ignition-gradient py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2"
              >
                {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined">cloud_upload</span>}
                {uploading ? 'Uploading...' : 'Upload Model'}
              </button>
            </form>
          </div>
        </div>

        {/* Model List */}
        <div className="lg:col-span-2">
          <div className="glass-card rounded-xl border border-glass-border overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h2 className="font-headline-md text-lg text-on-surface">Existing Models</h2>
              <span className="text-xs text-on-surface-variant">{models.length} assets</span>
            </div>
            <div className="divide-y divide-outline-variant/30">
              {loading ? (
                <div className="p-12 text-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div></div>
              ) : models.length === 0 ? (
                <div className="p-12 text-center text-on-surface-variant">No models uploaded yet.</div>
              ) : (
                models.map(model => (
                  <div key={model.id} className="p-4 flex items-center justify-between hover:bg-surface-container-lowest transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined">{model.icon}</span>
                      </div>
                      <div>
                        <p className="font-bold text-sm text-on-surface">{model.name}</p>
                        <p className="text-xs text-on-surface-variant">{model.category}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(model.id, model.file_url)} className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHardwareManagement;
