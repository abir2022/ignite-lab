import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { useAuth } from '../context/AuthContext';

const CoursePlayer = () => {
  const { courseId } = useParams();
  const { user, isTeacher, isAdmin, profile } = useAuth();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [completedModules, setCompletedModules] = useState([]);
  
  // Real modules fetched from the DB
  const [modules, setModules] = useState([]);

  // Live session states
  const [isJoined, setIsJoined] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState('about');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Tab/Live States
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [resources, setResources] = useState([]);
  const [uploadingResource, setUploadingResource] = useState(false);
  
  const messagesEndRef = useRef(null);
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student';

  const [timeStatus, setTimeStatus] = useState({
    canOpen: false,
    isExpired: false,
    timeLeftMinutes: 0,
    startCountdown: 0,
    startTime: null,
    endTime: null,
    closeTime: null,
  });

  // Fetch Course details and Modules
  useEffect(() => {
    const fetchCourseData = async () => {
      // 1. Fetch Course details
      const { data: courseData } = await supabase
        .from('courses')
        .select('*, teacher:profiles(full_name, avatar_url)')
        .eq('id', courseId)
        .single();
      
      if (courseData) {
        setCourse(courseData);
        
        // 2. Fetch Course Modules
        const { data: modulesData } = await supabase
          .from('course_modules')
          .select('*')
          .eq('course_id', courseId)
          .order('module_order', { ascending: true });
        
        if (modulesData && modulesData.length > 0) {
          const processedModules = modulesData.map(mod => ({
            ...mod,
            is_forced_started: mod.is_forced_started || false,
            is_forced_ended: mod.is_forced_ended || false,
            extended_minutes: mod.extended_minutes || 0,
            type: mod.scheduled_date ? 'live' : 'video', // live if scheduled date present
            duration: mod.scheduled_date ? `${mod.scheduled_time.substring(0, 5)}` : '15:00'
          }));
          setModules(processedModules);
        } else {
          // Beautiful fallback mock if no modules exist
          setModules([
            { id: 'default-1', title: 'Orientation & Workspace Setup', type: 'video', duration: '12:45' },
            { id: 'default-2', title: 'Core Drilling Concepts', type: 'video', duration: '24:10' },
            { id: 'default-3', title: 'Pressure Control Simulation', type: 'lab', duration: '45:00' }
          ]);
        }
      }
      setLoading(false);
    };

    fetchCourseData();
  }, [courseId]);

  // Real-time subscription to active module timing/override changes
  useEffect(() => {
    const activeModule = modules[activeModuleIndex];
    if (!activeModule || !activeModule.scheduled_date) return;

    const channel = supabase
      .channel(`player_module_status_${activeModule.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'course_modules',
        filter: `id=eq.${activeModule.id}`
      }, (payload) => {
        if (payload.new) {
          setModules(prev => 
            prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new, type: 'live' } : m)
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeModuleIndex, modules]);

  // Periodic Timing calculations
  useEffect(() => {
    const activeModule = modules[activeModuleIndex];
    if (!activeModule || !activeModule.scheduled_date) return;

    const calculateTimeStatus = () => {
      const now = new Date();
      
      try {
        const [year, month, day] = activeModule.scheduled_date.split('-').map(Number);
        const [hour, minute] = activeModule.scheduled_time.split(':').map(Number);
        const startTime = new Date(year, month - 1, day, hour, minute, 0);

        const startWindowTime = new Date(startTime.getTime() - 10 * 60 * 1000);
        
        const extendedMinutes = activeModule.extended_minutes || 0;
        const endTime = new Date(startTime.getTime() + (60 + extendedMinutes) * 60 * 1000);
        const closeTime = new Date(endTime.getTime() + 30 * 60 * 1000);

        const isForcedStarted = activeModule.is_forced_started === true;
        const isForcedEnded = activeModule.is_forced_ended === true;

        const diffStartMs = startTime - now;
        const startCountdown = Math.ceil(diffStartMs / 1000 / 60);

        const diffEndMs = closeTime - now;
        const timeLeftMinutes = Math.max(0, Math.ceil(diffEndMs / 1000 / 60));

        let canOpen = false;
        let isExpired = false;

        if (isAdmin) {
          canOpen = true;
          isExpired = false;
        } else {
          if (isForcedEnded) {
            canOpen = false;
            isExpired = true;
          } else if (isForcedStarted) {
            canOpen = true;
            isExpired = false;
          } else {
            canOpen = now >= startWindowTime && now <= closeTime;
            isExpired = now > closeTime;
          }
        }

        setTimeStatus({
          canOpen,
          isExpired,
          timeLeftMinutes,
          startCountdown,
          startTime,
          endTime,
          closeTime,
        });

        // Automatically boot user out if session conclued or forced ended
        if (isJoined && !isAdmin) {
          if (isForcedEnded || (now > closeTime && !isForcedStarted)) {
            setIsJoined(false);
            alert("This live session has concluded or has been closed by the administrator.");
          }
        }
      } catch (err) {
        console.error("Time status calculation error:", err);
      }
    };

    calculateTimeStatus();
    const interval = setInterval(calculateTimeStatus, 5000);

    return () => clearInterval(interval);
  }, [activeModuleIndex, isJoined, isAdmin, modules]);

  // Real-time Chat and Resources setups
  useEffect(() => {
    const activeModule = modules[activeModuleIndex];
    if (!activeModule || !activeModule.scheduled_date || !isJoined) return;

    let chatChannel;
    let presenceChannel;

    const setupLiveRoom = async () => {
      // Historical messages
      const { data: chatData } = await supabase
        .from('live_chat_messages')
        .select('*')
        .eq('session_id', activeModule.id)
        .order('created_at', { ascending: true });
      if (chatData) setMessages(chatData);

      // Resources fetch
      const { data: resourceData } = await supabase
        .from('live_session_resources')
        .select('*')
        .eq('module_id', activeModule.id)
        .order('created_at', { ascending: false });
      if (resourceData) setResources(resourceData);

      // Chat & resource listeners
      chatChannel = supabase
        .channel(`room_${activeModule.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'live_chat_messages' 
        }, (payload) => {
          if (payload.new.session_id === activeModule.id) {
            setMessages((prev) => {
              if (prev.find(m => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
        })
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'live_session_resources' 
        }, (payload) => {
          if (payload.new.module_id === activeModule.id) {
            setResources((prev) => {
              if (prev.find(r => r.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          }
        })
        .subscribe();

      // Presence trackers
      presenceChannel = supabase.channel(`presence_${activeModule.id}`, {
        config: { presence: { key: user.id } },
      });

      presenceChannel.on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users = [];
        for (const id in state) {
          users.push(state[id][0]);
        }
        setParticipants(users);
      });

      presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            id: user.id,
            name: displayName,
            role: isTeacher ? 'Instructor' : 'Student',
            joinedAt: new Date().toISOString()
          });
        }
      });
    };

    setupLiveRoom();

    return () => {
      if (chatChannel) supabase.removeChannel(chatChannel);
      if (presenceChannel) supabase.removeChannel(presenceChannel);
    };
  }, [activeModuleIndex, isJoined, isTeacher, user.id, displayName, modules]);

  // Tab scroll control
  useEffect(() => {
    if (activeTab === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const activeModule = modules[activeModuleIndex];
    if (!newMessage.trim() || !activeModule) return;

    const msg = {
      session_id: activeModule.id,
      user_id: user.id,
      user_name: displayName,
      role: isTeacher ? 'teacher' : (isAdmin ? 'admin' : 'student'),
      message: newMessage,
    };

    setNewMessage('');
    const { data, error } = await supabase.from('live_chat_messages').insert(msg).select().single();
    
    if (error) {
      console.error(error);
    } else if (data) {
      setMessages((prev) => {
        if (prev.find(m => m.id === data.id)) return prev;
        return [...prev, data];
      });
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!isAdmin) return;
    await supabase.from('live_chat_messages').delete().eq('id', msgId);
    setMessages(messages.filter(m => m.id !== msgId));
  };

  const handleDeleteResource = async (resId) => {
    if (!isAdmin) return;
    await supabase.from('live_session_resources').delete().eq('id', resId);
    setResources(resources.filter(r => r.id !== resId));
  };

  const handleUploadResource = async (e) => {
    const file = e.target.files[0];
    const activeModule = modules[activeModuleIndex];
    if (!file || !activeModule) return;

    setUploadingResource(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${activeModule.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('resources').upload(filePath, file);

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setUploadingResource(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('resources').getPublicUrl(filePath);

    const resourceDoc = {
      module_id: activeModule.id,
      teacher_id: user.id,
      file_name: file.name,
      file_url: publicUrlData.publicUrl,
      file_type: fileExt,
      file_size: file.size
    };

    const { data, error } = await supabase.from('live_session_resources').insert(resourceDoc).select().single();
    if (error) {
      console.error(error);
    }
    setUploadingResource(false);
  };

  // Admin status override actions
  const handleForceStart = async () => {
    if (!isAdmin) return;
    const activeModule = modules[activeModuleIndex];
    const { data, error } = await supabase
      .from('course_modules')
      .update({ is_forced_started: true, is_forced_ended: false })
      .eq('id', activeModule.id)
      .select()
      .single();
    
    if (error) {
      alert("Failed to start session early: " + error.message);
    } else {
      setModules(prev => prev.map(m => m.id === data.id ? { ...m, ...data, type: 'live' } : m));
    }
  };

  const handleForceEnd = async () => {
    if (!isAdmin) return;
    const activeModule = modules[activeModuleIndex];
    const { data, error } = await supabase
      .from('course_modules')
      .update({ is_forced_ended: true, is_forced_started: false })
      .eq('id', activeModule.id)
      .select()
      .single();
    
    if (error) {
      alert("Failed to end session: " + error.message);
    } else {
      setModules(prev => prev.map(m => m.id === data.id ? { ...m, ...data, type: 'live' } : m));
      setIsJoined(false);
    }
  };

  const handleExtendSession = async (minutes) => {
    if (!isAdmin) return;
    const activeModule = modules[activeModuleIndex];
    const currentExtension = activeModule.extended_minutes || 0;
    const newExtension = currentExtension + minutes;
    const { data, error } = await supabase
      .from('course_modules')
      .update({ extended_minutes: newExtension })
      .eq('id', activeModule.id)
      .select()
      .single();
    
    if (error) {
      alert("Failed to extend session: " + error.message);
    } else {
      setModules(prev => prev.map(m => m.id === data.id ? { ...m, ...data, type: 'live' } : m));
    }
  };

  const handleResetSession = async () => {
    if (!isAdmin) return;
    const activeModule = modules[activeModuleIndex];
    const { data, error } = await supabase
      .from('course_modules')
      .update({ is_forced_started: false, is_forced_ended: false, extended_minutes: 0 })
      .eq('id', activeModule.id)
      .select()
      .single();
    
    if (error) {
      alert("Failed to reset session status: " + error.message);
    } else {
      setModules(prev => prev.map(m => m.id === data.id ? { ...m, ...data, type: 'live' } : m));
    }
  };

  const handleModuleClick = (index) => {
    setActiveModuleIndex(index);
    setIsJoined(false);
    setActiveTab('about');
  };

  const handleCompleteModule = () => {
    if (!completedModules.includes(activeModuleIndex)) {
      setCompletedModules([...completedModules, activeModuleIndex]);
    }
    if (activeModuleIndex < modules.length - 1) {
      handleModuleClick(activeModuleIndex + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-gutter">
        <span className="material-symbols-outlined text-6xl text-outline mb-4">error</span>
        <h2 className="font-headline-md text-2xl text-on-surface mb-2">Course Not Found</h2>
        <p className="text-on-surface-variant mb-6">The course you are looking for does not exist or was removed.</p>
        <Link to="/courses" className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all">
          Browse Courses
        </Link>
      </div>
    );
  }

  const activeModule = modules[activeModuleIndex];
  const progressPercentage = modules.length > 0 ? (completedModules.length / modules.length) * 100 : 0;

  return (
    <div className={`flex-1 flex flex-col lg:flex-row overflow-hidden bg-background ${isFullscreen ? 'fixed inset-0 z-50' : 'h-[calc(100vh-64px)]'}`}>
      
      {/* Main Content Area (Video / Live Call Player) */}
      <main className={`flex-1 flex flex-col min-w-0 ${isFullscreen ? '' : 'overflow-y-auto'}`}>
        
        {/* Workspace Display (Player or Call) */}
        <div className={`bg-black relative w-full group overflow-hidden border-b border-outline-variant/30 flex flex-col flex-shrink-0 ${
          isFullscreen ? 'flex-1' : (isJoined && activeModule?.type === 'live' ? 'h-[80vh] lg:h-[88vh]' : 'h-[50vh] lg:h-[58vh] min-h-[380px] md:min-h-[460px]')
        }`}>
          {activeModule?.type === 'live' ? (
            !isJoined ? (
              <div className="flex-1 flex flex-col items-center justify-center p-gutter bg-slate-950 relative overflow-y-auto">
                {/* Dynamic Accent Glow */}
                <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none transition-all ${
                  activeModule.is_forced_ended ? 'bg-red-500' :
                  activeModule.is_forced_started ? 'bg-green-500' :
                  timeStatus.canOpen ? 'bg-primary' : 'bg-cyan-500'
                }`}></div>

                <div className="max-w-md w-full text-center z-10 my-auto">
                  {/* Status Badge */}
                  <div className="flex justify-center mb-4">
                    {activeModule.is_forced_ended ? (
                      <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 text-red-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase">
                        Concluded
                      </div>
                    ) : activeModule.is_forced_started ? (
                      <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/30 text-green-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase animate-pulse">
                        Live Early
                      </div>
                    ) : timeStatus.isExpired ? (
                      <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 text-red-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase">
                        Concluded
                      </div>
                    ) : timeStatus.canOpen ? (
                      <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/30 text-green-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase animate-pulse">
                        Ready / Open
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase">
                        Upcoming
                      </div>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-white mb-1 tracking-tight">{activeModule.title}</h2>
                  <p className="text-xs text-white/50 mb-4 uppercase font-mono">Live Training Workspace</p>

                  <div className="flex items-center justify-center gap-3 text-white/60 mb-5 bg-white/5 py-2 px-4 rounded-lg w-max mx-auto border border-white/5">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-[16px] text-primary">calendar_today</span>
                      <span className="font-mono">{activeModule.scheduled_date}</span>
                    </div>
                    <div className="w-px h-3 bg-white/10"></div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
                      <span className="font-mono">{activeModule.scheduled_time}</span>
                    </div>
                  </div>

                  {/* Status explanation */}
                  <div className="mb-6">
                    {activeModule.is_forced_ended || timeStatus.isExpired ? (
                      <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 text-center">
                        <p className="text-xs font-bold text-red-400">Class Concluded</p>
                        <p className="text-[10px] text-white/30">The live training session has ended. Download resources below.</p>
                      </div>
                    ) : !timeStatus.canOpen ? (
                      <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-3 text-center">
                        <p className="text-xs font-bold text-cyan-400">Not Yet Open</p>
                        <p className="text-[10px] text-white/40 mb-1.5">Opens 10 minutes prior to scheduled start time.</p>
                        <div className="inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded text-[10px] font-mono text-white/70">
                          Starts in {timeStatus.startCountdown}m
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3 text-center">
                        <p className="text-xs font-bold text-green-400">Class is Active</p>
                        <p className="text-[10px] text-white/40 mb-1.5">Click the join button to open the video call workspace.</p>
                        <div className="inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded text-[10px] font-mono text-white/70">
                          {activeModule.extended_minutes > 0 ? (
                            <span>Closes in {timeStatus.timeLeftMinutes}m ({activeModule.extended_minutes}m extended)</span>
                          ) : (
                            <span>Closes in {timeStatus.timeLeftMinutes}m</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Join buttons */}
                  <div>
                    {activeModule.is_forced_ended || timeStatus.isExpired ? (
                      isAdmin ? (
                        <button 
                          onClick={handleForceStart} 
                          className="w-full bg-primary/20 hover:bg-primary border border-primary/30 text-primary hover:text-slate-950 py-3 rounded-lg font-bold text-sm transition-all"
                        >
                          Reopen & Join Session (Admin)
                        </button>
                      ) : (
                        <button disabled className="w-full bg-white/5 text-white/20 border border-white/5 py-3 rounded-lg font-bold text-sm cursor-not-allowed">
                          Session Closed
                        </button>
                      )
                    ) : !timeStatus.canOpen ? (
                      isAdmin ? (
                        <button 
                          onClick={() => {
                            handleForceStart();
                            setIsJoined(true);
                          }} 
                          className="w-full bg-primary/20 hover:bg-primary border border-primary/30 text-primary hover:text-slate-950 py-3 rounded-lg font-bold text-sm transition-all"
                        >
                          Start Early (Admin Bypass)
                        </button>
                      ) : (
                        <button disabled className="w-full bg-white/5 text-white/20 border border-white/5 py-3 rounded-lg font-bold text-sm cursor-not-allowed">
                          Locked until {new Date(timeStatus.startTime?.getTime() - 10 * 60 * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </button>
                      )
                    ) : (
                      isTeacher || isAdmin ? (
                        <button onClick={() => setIsJoined(true)} className="w-full ignition-gradient py-3 rounded-lg font-bold text-white text-sm hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all">
                          {isAdmin ? 'Join Session (Admin)' : 'Start Broadcast'}
                        </button>
                      ) : (
                        <button onClick={() => setIsJoined(true)} className="w-full bg-primary py-3 rounded-lg font-bold text-slate-950 text-sm hover:bg-primary/95 transition-all">
                          Join Live Call
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col relative" style={{ minHeight: isFullscreen ? '100%' : '350px' }}>
                <JitsiMeeting
                  domain="8x8.vc"
                  roomName={`vpaas-magic-cookie-30d6ddbcbe2b413b8ad2337b01f25fdf/IgniteLab_${activeModule.id}_${activeModule.title?.replace(/\s+/g, '_').substring(0, 20)}`}
                  configOverwrite={{
                    startWithAudioMuted: true,
                    startWithVideoMuted: false,
                    disableModeratorIndicator: false,
                    enableEmailInProfile: false,
                    prejoinPageEnabled: false,
                    disableDeepLinking: true,
                    toolbarButtons: [
                      'microphone', 'camera', 'desktop', 'fullscreen',
                      'hangup', 'chat', 'raisehand', 'tileview',
                      'select-background', 'settings'
                    ],
                  }}
                  interfaceConfigOverwrite={{
                    DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                    SHOW_JITSI_WATERMARK: false,
                    SHOW_WATERMARK_FOR_GUESTS: false,
                    DEFAULT_BACKGROUND: '#020617',
                    TOOLBAR_ALWAYS_VISIBLE: false,
                  }}
                  userInfo={{
                    displayName: displayName,
                    email: user?.email || '',
                  }}
                  onApiReady={(externalApi) => {
                    externalApi.addListener('videoConferenceLeft', () => {
                      setIsJoined(false);
                      setIsStreaming(false);
                    });
                  }}
                  getIFrameRef={(iframeRef) => {
                    iframeRef.style.height = '100%';
                    iframeRef.style.width = '100%';
                    iframeRef.style.border = 'none';
                  }}
                />
                {/* Floating controls inside call player */}
                <div className="absolute top-4 right-4 z-[99999] flex items-center gap-2 pointer-events-auto">
                  {(isAdmin || isTeacher) && (
                    <div className="flex items-center gap-1.5 bg-slate-950/95 backdrop-blur border border-primary/20 px-3.5 py-2 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                      <span className="text-[9px] font-bold text-primary font-mono uppercase tracking-wider">Session:</span>
                      <button 
                        onClick={() => handleExtendSession(15)} 
                        className="bg-primary/10 hover:bg-primary/25 border border-primary/20 text-primary text-[9px] font-bold px-2.5 py-1 rounded-lg transition-all"
                      >
                        +15m
                      </button>
                      <button 
                        onClick={() => handleExtendSession(30)} 
                        className="bg-primary/10 hover:bg-primary/25 border border-primary/20 text-primary text-[9px] font-bold px-2.5 py-1 rounded-lg transition-all"
                      >
                        +30m
                      </button>
                      <button 
                        onClick={handleForceEnd} 
                        className="bg-red-500/10 hover:bg-red-500 border border-red-500/30 text-red-400 hover:text-white text-[9px] font-bold px-2.5 py-1 rounded-lg transition-all"
                      >
                        End Class
                      </button>
                    </div>
                  )}
                  <button 
                    onClick={() => setIsFullscreen(!isFullscreen)} 
                    className="bg-slate-950/95 backdrop-blur hover:bg-white/10 border border-white/10 text-white p-2.5 rounded-xl shadow-lg transition-all"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
                  >
                    <span className="material-symbols-outlined text-[18px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                  </button>
                  <button 
                    onClick={() => { setIsJoined(false); setIsFullscreen(false); }} 
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">call_end</span>
                    Leave
                  </button>
                </div>
              </div>
            )
          ) : activeModule?.type === 'video' ? (
            <div className="w-full h-full relative">
              <img 
                src={course.thumbnail_url || 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=1600&q=80'} 
                alt="Course Video Placeholder"
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                <div className="w-full h-1 bg-white/30 rounded-full mb-3 cursor-pointer">
                  <div className="h-full bg-primary rounded-full w-1/3 relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined cursor-pointer hover:text-primary">play_arrow</span>
                    <span className="material-symbols-outlined cursor-pointer hover:text-primary">volume_up</span>
                    <span className="text-sm font-mono">04:15 / {activeModule.duration}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined cursor-pointer hover:text-primary">closed_caption</span>
                    <span className="material-symbols-outlined cursor-pointer hover:text-primary">settings</span>
                    <span className="material-symbols-outlined cursor-pointer hover:text-primary">fullscreen</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-center p-8">
              <span className="material-symbols-outlined text-5xl text-primary mb-3">
                {activeModule?.type === 'lab' ? 'science' : 'quiz'}
              </span>
              <h2 className="text-lg font-bold text-white mb-1">{activeModule?.title}</h2>
              <p className="text-xs text-white/50 mb-4">Interactive training simulator lab module.</p>
              <Link to={activeModule?.type === 'lab' ? '/lab' : '#'} className="ignition-gradient text-white px-5 py-2.5 rounded-lg font-bold text-xs flex items-center gap-1.5">
                Launch {activeModule?.type === 'lab' ? 'Simulation Lab' : 'Assessment'}
                <span className="material-symbols-outlined text-sm">launch</span>
              </Link>
            </div>
          )}
        </div>

        {/* Tab & details Area */}
        <div className="p-4 md:p-gutter max-w-4xl">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-headline-lg text-2xl md:text-3xl text-on-surface leading-tight">{activeModule?.title}</h1>
            <button 
              onClick={handleCompleteModule}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all ${completedModules.includes(activeModuleIndex) ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-primary text-slate-950 hover:shadow-lg'}`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {completedModules.includes(activeModuleIndex) ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              {completedModules.includes(activeModuleIndex) ? 'Completed' : 'Mark Complete'}
            </button>
          </div>

          {/* Instructor Host Row */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden text-primary font-bold">
              {course.teacher?.avatar_url ? (
                <img src={course.teacher.avatar_url} alt="Instructor" className="w-full h-full object-cover" />
              ) : (
                course.teacher?.full_name?.charAt(0) || 'I'
              )}
            </div>
            <div>
              <p className="font-bold text-on-surface text-sm leading-tight">{course.teacher?.full_name || 'Instructor'}</p>
              <p className="text-xs text-on-surface-variant">Course Creator</p>
            </div>
          </div>

          {/* Dynamic Tab Bar */}
          {activeModule?.type === 'live' ? (
            <div className="flex border-b border-outline-variant/30 mb-6 gap-2">
              <button 
                onClick={() => setActiveTab('about')} 
                className={`py-2 px-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'about' ? 'text-primary border-primary' : 'text-on-surface-variant hover:text-white border-transparent'}`}
              >
                About Session
              </button>
              <button 
                onClick={() => setActiveTab('chat')} 
                className={`py-2 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${activeTab === 'chat' ? 'text-primary border-primary' : 'text-on-surface-variant hover:text-white border-transparent'}`}
              >
                Live Chat
                {messages.length > 0 && <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">{messages.length}</span>}
              </button>
              <button 
                onClick={() => setActiveTab('resources')} 
                className={`py-2 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${activeTab === 'resources' ? 'text-primary border-primary' : 'text-on-surface-variant hover:text-white border-transparent'}`}
              >
                Files & Resources
                {resources.length > 0 && <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">{resources.length}</span>}
              </button>
            </div>
          ) : null}

          {/* Tabs Container */}
          {activeModule?.type === 'live' && activeTab === 'chat' ? (
            <div className="glass-card bg-surface-container-low/10 border border-white/5 rounded-xl p-4 flex flex-col h-[350px]">
              {!isJoined ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-white/40 p-4">
                  <span className="material-symbols-outlined text-4xl mb-2">lock</span>
                  <p className="text-xs font-bold">Chat Stream Locked</p>
                  <p className="text-[10px] max-w-xs mt-1">Please launch the live call session to access real-time workspace discussions.</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2">
                    {messages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-white/30 font-mono">No messages yet. Send a message to start!</div>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className="flex flex-col bg-white/5 p-2.5 rounded-lg border border-white/5 relative group">
                          {isAdmin && (
                            <button 
                              onClick={() => handleDeleteMessage(msg.id)} 
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          )}
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-bold text-white">{msg.user_name}</span>
                            <span className={`text-[9px] px-1.5 rounded font-mono font-bold uppercase ${
                              msg.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                              msg.role === 'teacher' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/10 text-white/50'
                            }`}>{msg.role}</span>
                          </div>
                          <p className="text-xs text-white/80 whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input 
                      type="text" 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..." 
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50"
                    />
                    <button type="submit" className="bg-primary hover:bg-primary/90 text-slate-950 px-4 rounded-lg font-bold text-xs flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">send</span>
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : activeModule?.type === 'live' && activeTab === 'resources' ? (
            <div className="glass-card bg-surface-container-low/10 border border-white/5 rounded-xl p-4 min-h-[250px] flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Shared Class Resources</h4>
                  {isTeacher || isAdmin ? (
                    <label className="bg-primary hover:bg-primary/95 text-slate-950 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 shadow-md">
                      <span className="material-symbols-outlined text-xs">upload</span>
                      Upload File
                      <input type="file" onChange={handleUploadResource} className="hidden" disabled={uploadingResource} />
                    </label>
                  ) : null}
                </div>

                {uploadingResource && (
                  <div className="text-xs text-primary font-mono animate-pulse mb-3">Uploading file to resources bucket...</div>
                )}

                <div className="space-y-2">
                  {resources.length === 0 ? (
                    <div className="text-xs text-white/30 text-center font-mono py-8">No class files uploaded yet for this module.</div>
                  ) : (
                    resources.map((res) => (
                      <div key={res.id} className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5 group hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-sm">description</span>
                          <span className="text-xs text-white font-mono truncate max-w-xs">{res.file_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <a 
                            href={res.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="bg-white/5 hover:bg-primary hover:text-slate-950 border border-white/10 p-1.5 rounded text-white transition-colors"
                          >
                            <span className="material-symbols-outlined text-xs">download</span>
                          </a>
                          {isAdmin && (
                            <button 
                              onClick={() => handleDeleteResource(res.id)} 
                              className="bg-red-500/10 hover:bg-red-500 border border-red-500/20 p-1.5 rounded text-red-400 hover:text-white transition-colors"
                            >
                              <span className="material-symbols-outlined text-xs">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-6 rounded-xl border border-glass-border">
              <h3 className="font-headline-md text-lg text-on-surface mb-2">About this module</h3>
              <p className="text-on-surface-variant font-body-md whitespace-pre-wrap leading-relaxed">
                {activeModule?.description || "In this module, we will explore the core fundamentals related to the topic. Make sure to follow along with the provided code snippets in your local development environment or use the integrated Simulation Lab."}
              </p>
            </div>
          )}

          {/* Inline Admin Control Panel inside Player Details */}
          {(isAdmin || isTeacher) && activeModule?.type === 'live' && (
            <div className="glass-card bg-red-500/5 p-5 rounded-xl border border-red-500/15 shadow-xl mt-6 relative overflow-hidden">
              <h4 className="text-red-400 font-mono text-[9px] uppercase font-bold tracking-widest mb-3.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                Instructor & Admin Operations
              </h4>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button 
                  onClick={handleForceStart} 
                  className="flex items-center justify-center gap-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 rounded-lg py-2.5 font-bold text-[10px] uppercase transition-all"
                >
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                  Bypass Start
                </button>
                <button 
                  onClick={handleForceEnd} 
                  className="flex items-center justify-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg py-2.5 font-bold text-[10px] uppercase transition-all"
                >
                  <span className="material-symbols-outlined text-sm">stop</span>
                  Terminate Call
                </button>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-3 border-t border-white/5 text-[9px] font-mono text-white/30 gap-3">
                <div className="flex gap-4">
                  <span>Early Active: <span className={activeModule.is_forced_started ? 'text-green-400 font-bold' : ''}>{activeModule.is_forced_started ? 'TRUE' : 'FALSE'}</span></span>
                  <span>Forced Ended: <span className={activeModule.is_forced_ended ? 'text-red-400 font-bold' : ''}>{activeModule.is_forced_ended ? 'TRUE' : 'FALSE'}</span></span>
                  <span>Extension: <span className={activeModule.extended_minutes > 0 ? 'text-amber-400 font-bold' : ''}>{activeModule.extended_minutes || 0}m</span></span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => handleExtendSession(15)} 
                    className="bg-white/5 hover:bg-white/10 border border-white/5 py-1 px-2.5 rounded text-[8px] uppercase tracking-wider font-bold"
                  >
                    +15m
                  </button>
                  <button 
                    onClick={() => handleExtendSession(30)} 
                    className="bg-white/5 hover:bg-white/10 border border-white/5 py-1 px-2.5 rounded text-[8px] uppercase tracking-wider font-bold"
                  >
                    +30m
                  </button>
                  <button 
                    onClick={handleResetSession} 
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white py-1 px-2.5 rounded text-[8px] uppercase tracking-wider font-bold"
                  >
                    Reset Status
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Sidebar (Module List) */}
      <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-outline-variant bg-surface-container-lowest flex flex-col shrink-0 h-[40vh] lg:h-full">
        <div className="p-4 border-b border-outline-variant shrink-0 bg-surface">
          <Link to="/courses" className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary mb-3 transition-colors">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Courses
          </Link>
          <h2 className="font-bold text-on-surface line-clamp-1">{course.title}</h2>
          
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-on-surface-variant font-bold">Your Progress</span>
              <span className="text-primary font-bold">{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-on-surface-variant text-right">{completedModules.length} of {modules.length} modules completed</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {modules.map((mod, idx) => {
            const isActive = activeModuleIndex === idx;
            const isCompleted = completedModules.includes(idx);
            
            return (
              <button 
                key={mod.id}
                onClick={() => handleModuleClick(idx)}
                className={`w-full text-left p-4 border-b border-outline-variant/30 flex gap-4 transition-colors hover:bg-surface-variant/50 ${isActive ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
              >
                <div className="shrink-0 mt-0.5">
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-green-500 text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                  ) : isActive ? (
                    <span className="material-symbols-outlined text-primary text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>play_circle</span>
                  ) : (
                    <span className="material-symbols-outlined text-outline text-[20px]">radio_button_unchecked</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm mb-1 truncate ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                    {idx + 1}. {mod.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px]">
                      {mod.type === 'live' ? 'videocam' : mod.type === 'video' ? 'videocam' : mod.type === 'lab' ? 'science' : 'quiz'}
                    </span>
                    {mod.type === 'live' ? 'Live Call' : mod.duration}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

    </div>
  );
};

export default CoursePlayer;
