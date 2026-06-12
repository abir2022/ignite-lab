import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { JitsiMeeting } from '@jitsi/react-sdk';

const LiveSession = () => {
  const { user, isTeacher, isAdmin, profile } = useAuth();
  
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Live State
  const [isJoined, setIsJoined] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false); 
  const [activeTab, setActiveTab] = useState('chat');
  
  // Tab States
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [resources, setResources] = useState([]);
  const [uploadingResource, setUploadingResource] = useState(false);
  
  const messagesEndRef = useRef(null);
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student';

  // 1. Fetch Scheduled Sessions
  const [timeStatus, setTimeStatus] = useState({
    canOpen: false,
    isExpired: false,
    timeLeftMinutes: 0,
    startCountdown: 0,
    startTime: null,
    endTime: null,
    closeTime: null,
  });

  useEffect(() => {
    const fetchScheduledModules = async () => {
      const { data, error } = await supabase
        .from('course_modules')
        .select(`
          id, title, description, scheduled_date, scheduled_time, module_order,
          is_forced_started, is_forced_ended, extended_minutes,
          course:courses (
            title, level,
            teacher:profiles(full_name, avatar_url)
          )
        `)
        .not('scheduled_date', 'is', null)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });

      if (data && data.length > 0) {
        // Fallback checks for DB fields that might not be upgraded yet to prevent crashes
        const processedData = data.map(item => ({
          ...item,
          is_forced_started: item.is_forced_started || false,
          is_forced_ended: item.is_forced_ended || false,
          extended_minutes: item.extended_minutes || 0
        }));
        setSessions(processedData);
        setActiveSession(processedData[0]);
      }
      setLoading(false);
    };

    fetchScheduledModules();
  }, []);

  // Real-time subscription to activeSession status updates
  useEffect(() => {
    if (!activeSession) return;

    const channel = supabase
      .channel(`active_session_status_${activeSession.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'course_modules',
        filter: `id=eq.${activeSession.id}`
      }, (payload) => {
        if (payload.new) {
          setActiveSession(prev => {
            if (prev && prev.id === payload.new.id) {
              return { ...prev, ...payload.new };
            }
            return prev;
          });
          setSessions(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id]);

  // Periodic Timing calculation hook
  useEffect(() => {
    if (!activeSession) return;

    const calculateTimeStatus = () => {
      const now = new Date();
      
      try {
        const [year, month, day] = activeSession.scheduled_date.split('-').map(Number);
        const [hour, minute] = activeSession.scheduled_time.split(':').map(Number);
        const startTime = new Date(year, month - 1, day, hour, minute, 0);

        const startWindowTime = new Date(startTime.getTime() - 10 * 60 * 1000);
        
        const extendedMinutes = activeSession.extended_minutes || 0;
        const endTime = new Date(startTime.getTime() + (60 + extendedMinutes) * 60 * 1000);
        const closeTime = new Date(endTime.getTime() + 30 * 60 * 1000);

        const isForcedStarted = activeSession.is_forced_started === true;
        const isForcedEnded = activeSession.is_forced_ended === true;

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
  }, [activeSession, isJoined, isAdmin]);

  // Admin control actions
  const handleForceStart = async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from('course_modules')
      .update({ is_forced_started: true, is_forced_ended: false })
      .eq('id', activeSession.id)
      .select()
      .single();
    
    if (error) {
      alert("Failed to start session early: " + error.message);
    } else {
      setActiveSession(prev => ({ ...prev, ...data }));
      setSessions(prev => prev.map(s => s.id === data.id ? { ...s, ...data } : s));
    }
  };

  const handleForceEnd = async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from('course_modules')
      .update({ is_forced_ended: true, is_forced_started: false })
      .eq('id', activeSession.id)
      .select()
      .single();
    
    if (error) {
      alert("Failed to end session: " + error.message);
    } else {
      setActiveSession(prev => ({ ...prev, ...data }));
      setSessions(prev => prev.map(s => s.id === data.id ? { ...s, ...data } : s));
      setIsJoined(false);
    }
  };

  const handleExtendSession = async (minutes) => {
    if (!isAdmin) return;
    const currentExtension = activeSession.extended_minutes || 0;
    const newExtension = currentExtension + minutes;
    const { data, error } = await supabase
      .from('course_modules')
      .update({ extended_minutes: newExtension })
      .eq('id', activeSession.id)
      .select()
      .single();
    
    if (error) {
      alert("Failed to extend session: " + error.message);
    } else {
      setActiveSession(prev => ({ ...prev, ...data }));
      setSessions(prev => prev.map(s => s.id === data.id ? { ...s, ...data } : s));
    }
  };

  const handleResetSession = async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from('course_modules')
      .update({ is_forced_started: false, is_forced_ended: false, extended_minutes: 0 })
      .eq('id', activeSession.id)
      .select()
      .single();
    
    if (error) {
      alert("Failed to reset session status: " + error.message);
    } else {
      setActiveSession(prev => ({ ...prev, ...data }));
      setSessions(prev => prev.map(s => s.id === data.id ? { ...s, ...data } : s));
    }
  };

  // 2. Setup Chat & Presence when Session Changes
  useEffect(() => {
    if (!activeSession || !isJoined) return;

    let chatChannel;
    let presenceChannel;

    const setupLiveRoom = async () => {
      // Chat historical fetch
      const { data: chatData } = await supabase
        .from('live_chat_messages')
        .select('*')
        .eq('session_id', activeSession.id)
        .order('created_at', { ascending: true });
      if (chatData) setMessages(chatData);

      // Resources fetch
      const { data: resourceData } = await supabase
        .from('live_session_resources')
        .select('*')
        .eq('module_id', activeSession.id)
        .order('created_at', { ascending: false });
      if (resourceData) setResources(resourceData);

      // Setup Chat & Resources Channels
      chatChannel = supabase
        .channel(`room_${activeSession.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'live_chat_messages' 
        }, (payload) => {
          if (payload.new.session_id === activeSession.id) {
            setMessages((prev) => {
              // Prevent duplicates if manual update already happened
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
          if (payload.new.module_id === activeSession.id) {
            setResources((prev) => {
              if (prev.find(r => r.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          }
        })
        .subscribe();

      // Setup Presence Channel
      presenceChannel = supabase.channel(`presence_${activeSession.id}`, {
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
  }, [activeSession, isJoined, isTeacher, user.id, displayName]);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeSession) return;

    // Use a string representation of the UUID for the integer field if they haven't upgraded yet,
    // though the DB will likely reject it. We must force the DB upgrade.
    const msg = {
      session_id: activeSession.id,
      user_id: user.id,
      user_name: displayName,
      role: isTeacher ? 'teacher' : (isAdmin ? 'admin' : 'student'),
      message: newMessage,
    };

    setNewMessage('');
    const { data, error } = await supabase.from('live_chat_messages').insert(msg).select().single();
    
    if (error) {
      console.error("Chat insert error:", error);
      alert("Database error: " + error.message);
    } else if (data) {
      // Manually add to state immediately for the sender to prevent "disappearing" feeling
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
    if (!file || !activeSession) return;

    setUploadingResource(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${activeSession.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('resources').upload(filePath, file);

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setUploadingResource(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('resources').getPublicUrl(filePath);

    const resourceDoc = {
      module_id: activeSession.id,
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
    // Realtime channel handles state update now
    setUploadingResource(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-gutter text-center h-[calc(100vh-64px)]">
        <span className="material-symbols-outlined text-6xl text-outline mb-4">event_busy</span>
        <h2 className="text-2xl font-bold text-on-surface mb-2">No Scheduled Sessions</h2>
        <p className="text-on-surface-variant">There are currently no live sessions scheduled by the instructors.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden bg-background">
      
      {/* LEFT: Video Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-black relative">
        {!isJoined ? (
          <div className="flex-1 flex flex-col items-center justify-center p-gutter overflow-y-auto max-w-full">
            <div className="glass-card bg-surface-container-low/10 p-8 rounded-2xl max-w-lg w-full text-center border border-outline-variant/20 shadow-2xl relative overflow-hidden">
              {/* Dynamic Accent Glow */}
              <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none transition-all ${
                activeSession.is_forced_ended ? 'bg-red-500' :
                activeSession.is_forced_started ? 'bg-green-500' :
                timeStatus.canOpen ? 'bg-primary' : 'bg-cyan-500'
              }`}></div>

              {/* Status Badge */}
              <div className="flex justify-center mb-6">
                {activeSession.is_forced_ended ? (
                  <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    Concluded
                  </div>
                ) : activeSession.is_forced_started ? (
                  <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase animate-pulse">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full shadow-[0_0_8px_#4ade80]"></span>
                    Opened Early by Admin
                  </div>
                ) : timeStatus.isExpired ? (
                  <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    Concluded
                  </div>
                ) : timeStatus.canOpen ? (
                  <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase animate-pulse">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full shadow-[0_0_8px_#4ade80]"></span>
                    Ready / Open
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase">
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                    Upcoming
                  </div>
                )}
              </div>

              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-all ${
                activeSession.is_forced_ended || timeStatus.isExpired ? 'bg-red-500/10 text-red-400' :
                timeStatus.canOpen ? 'bg-primary/20 text-primary animate-pulse' : 'bg-cyan-500/10 text-cyan-400'
              }`}>
                <span className="material-symbols-outlined text-4xl" style={{fontVariationSettings: "'FILL' 1"}}>
                  {activeSession.is_forced_ended || timeStatus.isExpired ? 'block' : 'videocam'}
                </span>
              </div>

              <h1 className="font-headline-lg text-3xl text-white mb-2 tracking-tight">{activeSession.title}</h1>
              <p className="text-surface-variant font-body-md mb-6">{activeSession.course?.title} - Module {activeSession.module_order}</p>
              
              <div className="flex items-center justify-center gap-4 text-surface-variant mb-8 bg-white/5 py-3 rounded-lg border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">calendar_today</span>
                  <span className="font-bold font-mono text-sm">{activeSession.scheduled_date}</span>
                </div>
                <div className="w-px h-4 bg-outline-variant/30"></div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">schedule</span>
                  <span className="font-bold font-mono text-sm">{activeSession.scheduled_time}</span>
                </div>
              </div>

              {/* Status Specific Explanations & Countdown Timer */}
              <div className="mb-8">
                {activeSession.is_forced_ended || timeStatus.isExpired ? (
                  <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-center">
                    <p className="text-sm font-bold text-red-400 mb-1">Session Has Concluded</p>
                    <p className="text-xs text-white/40">This live session ended and is closed. Please check the course library for recordings or resources.</p>
                  </div>
                ) : !timeStatus.canOpen ? (
                  <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-xl p-4 text-center">
                    <p className="text-sm font-bold text-cyan-400 mb-1">Session Not Yet Open</p>
                    <p className="text-xs text-white/50 mb-2">The session will open for students 10 minutes prior to the start time.</p>
                    <div className="flex items-center justify-center gap-2 text-white/80 font-mono text-xs font-bold uppercase tracking-wider bg-black/40 py-1.5 px-3 rounded-lg w-max mx-auto">
                      <span className="material-symbols-outlined text-sm text-cyan-400">alarm</span>
                      Starts in {timeStatus.startCountdown} minutes
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 text-center">
                    <p className="text-sm font-bold text-green-400 mb-1">Session is Currently Active</p>
                    <p className="text-xs text-white/50 mb-3">You can join the meeting space now. Enjoy your interactive training!</p>
                    <div className="flex items-center justify-center gap-2 text-white/80 font-mono text-xs font-bold uppercase tracking-wider bg-black/40 py-1.5 px-3 rounded-lg w-max mx-auto">
                      <span className="material-symbols-outlined text-sm text-green-400">timer</span>
                      {activeSession.extended_minutes > 0 ? (
                        <span>Closes in {timeStatus.timeLeftMinutes} mins ({activeSession.extended_minutes}m extended)</span>
                      ) : (
                        <span>Closes in {timeStatus.timeLeftMinutes} mins</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Host information */}
              <div className="flex items-center justify-between gap-4 mb-8 text-left bg-black/40 p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold overflow-hidden">
                    {activeSession.course?.teacher?.avatar_url ? (
                      <img src={activeSession.course.teacher.avatar_url} alt="Instructor" className="w-full h-full object-cover" />
                    ) : (
                      activeSession.course?.teacher?.full_name?.charAt(0) || 'I'
                    )}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{activeSession.course?.teacher?.full_name || 'Instructor'}</p>
                    <p className="text-surface-variant text-xs">Session Host</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {activeSession.is_forced_ended || timeStatus.isExpired ? (
                  isAdmin ? (
                    <button 
                      onClick={handleForceStart} 
                      className="w-full bg-primary/20 hover:bg-primary border border-primary/30 text-primary hover:text-slate-950 py-4 rounded-xl font-bold text-lg transition-all"
                    >
                      Reopen & Join Session (Admin)
                    </button>
                  ) : (
                    <button disabled className="w-full bg-white/5 text-white/30 border border-white/5 py-4 rounded-xl font-bold text-lg cursor-not-allowed">
                      Session Concluded
                    </button>
                  )
                ) : !timeStatus.canOpen ? (
                  isAdmin ? (
                    <button 
                      onClick={() => {
                        handleForceStart();
                        setIsJoined(true);
                      }} 
                      className="w-full bg-primary/20 hover:bg-primary border border-primary/30 text-primary hover:text-slate-950 py-4 rounded-xl font-bold text-lg transition-all"
                    >
                      Bypass & Start Broadcast (Admin)
                    </button>
                  ) : (
                    <button disabled className="w-full bg-white/5 text-white/30 border border-white/5 py-4 rounded-xl font-bold text-lg cursor-not-allowed">
                      Locked until {new Date(timeStatus.startTime?.getTime() - 10 * 60 * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </button>
                  )
                ) : (
                  isTeacher ? (
                    <button onClick={() => setIsJoined(true)} className="w-full ignition-gradient py-4 rounded-xl font-bold text-on-primary text-lg hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all">
                      Start Broadcast
                    </button>
                  ) : (
                    <button onClick={() => setIsJoined(true)} className="w-full bg-primary py-4 rounded-xl font-bold text-slate-950 text-lg hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all">
                      Join Session
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Admin Control Panel Card */}
            {isAdmin && (
              <div className="glass-card bg-red-500/5 p-6 rounded-2xl max-w-lg w-full border border-red-500/20 shadow-xl mt-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3">
                  <span className="material-symbols-outlined text-red-500/20 text-3xl font-bold">admin_panel_settings</span>
                </div>
                <h3 className="text-red-400 font-mono text-[10px] uppercase font-bold tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  Admin Control Panel
                </h3>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button 
                    onClick={handleForceStart} 
                    className="flex items-center justify-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 rounded-xl py-3 font-bold text-xs uppercase transition-all"
                  >
                    <span className="material-symbols-outlined text-base">play_arrow</span>
                    Force Start Early
                  </button>
                  <button 
                    onClick={handleForceEnd} 
                    className="flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl py-3 font-bold text-xs uppercase transition-all"
                  >
                    <span className="material-symbols-outlined text-base">stop</span>
                    Force End Now
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-[10px] text-white/40 uppercase font-mono tracking-wider font-bold mb-2">Extend Session Duration</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleExtendSession(15)} 
                      className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg py-2 font-mono text-[10px] font-bold transition-all"
                    >
                      +15 Mins
                    </button>
                    <button 
                      onClick={() => handleExtendSession(30)} 
                      className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg py-2 font-mono text-[10px] font-bold transition-all"
                    >
                      +30 Mins
                    </button>
                    <button 
                      onClick={() => handleExtendSession(60)} 
                      className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg py-2 font-mono text-[10px] font-bold transition-all"
                    >
                      +60 Mins
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-white/5 text-[9px] font-mono text-white/30">
                  <div className="flex flex-col gap-0.5">
                    <span>Override Early: <span className={activeSession.is_forced_started ? 'text-green-400' : 'text-white/40'}>{activeSession.is_forced_started ? 'TRUE' : 'FALSE'}</span></span>
                    <span>Forced Conclude: <span className={activeSession.is_forced_ended ? 'text-red-400' : 'text-white/40'}>{activeSession.is_forced_ended ? 'TRUE' : 'FALSE'}</span></span>
                    <span>Current Extension: <span className={activeSession.extended_minutes > 0 ? 'text-amber-400 font-bold' : 'text-white/40'}>{activeSession.extended_minutes || 0}m</span></span>
                  </div>
                  <button 
                    onClick={handleResetSession} 
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white py-1.5 px-3 rounded-lg transition-all uppercase tracking-wider font-bold"
                  >
                    Reset Status
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col relative" style={{minHeight: '400px'}}>
            <JitsiMeeting
              domain="8x8.vc"
              roomName={`vpaas-magic-cookie-30d6ddbcbe2b413b8ad2337b01f25fdf/IgniteLab_${activeSession.id}_${activeSession.title?.replace(/\s+/g, '_').substring(0, 20)}`}
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
                // Listen for hangup event to update our state
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
            {/* Floating Admin & Leave Controls Overlay */}
            <div className="absolute bottom-6 right-6 z-20 flex items-center gap-3">
              {isAdmin && (
                <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-white/10 px-4 py-2 rounded-full shadow-lg">
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest font-mono mr-1">Class Timer:</span>
                  <button 
                    onClick={() => handleExtendSession(15)} 
                    className="bg-white/5 hover:bg-white/10 border border-white/5 text-[9px] font-bold text-white px-2.5 py-1 rounded"
                  >
                    +15m
                  </button>
                  <button 
                    onClick={() => handleExtendSession(30)} 
                    className="bg-white/5 hover:bg-white/10 border border-white/5 text-[9px] font-bold text-white px-2.5 py-1 rounded"
                  >
                    +30m
                  </button>
                  <button 
                    onClick={handleForceEnd} 
                    className="bg-red-500/20 hover:bg-red-500 border border-red-500/30 hover:text-white text-[9px] font-bold text-red-400 px-2.5 py-1 rounded transition-colors"
                  >
                    End Class
                  </button>
                </div>
              )}
              <button 
                onClick={() => setIsJoined(false)} 
                className="bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-full font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all"
              >
                <span className="material-symbols-outlined text-base">call_end</span>
                Leave
              </button>
            </div>
          </div>
        )}
      </main>

      {/* RIGHT: Engagement Sidebar */}
      <aside className="w-full lg:w-80 shrink-0 bg-surface flex flex-col border-t lg:border-t-0 lg:border-l border-outline-variant h-[50vh] lg:h-full z-10 relative">
        {/* Session Selector (Only show if not joined or if multiple sessions exist) */}
        {!isJoined && sessions.length > 1 && (
          <div className="p-4 border-b border-outline-variant bg-surface-container-lowest shrink-0">
            <p className="text-xs font-bold text-on-surface-variant mb-2">Select Upcoming Session</p>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => setActiveSession(session)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${activeSession.id === session.id ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-outline-variant text-on-surface-variant'}`}
                >
                  {session.scheduled_time}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab Header */}
        <div className="flex border-b border-outline-variant shrink-0">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            <span className="material-symbols-outlined text-[18px]">forum</span> Chat
          </button>
          <button 
            onClick={() => setActiveTab('participants')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'participants' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            <span className="material-symbols-outlined text-[18px]">group</span> Users
          </button>
          <button 
            onClick={() => setActiveTab('resources')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'resources' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            <span className="material-symbols-outlined text-[18px]">folder</span> Files
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col bg-surface-container-lowest">
          
          {/* CHAT TAB */}
          {activeTab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-60">
                    <span className="material-symbols-outlined text-4xl mb-2">forum</span>
                    <p className="text-sm">No messages yet.</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.user_id === user?.id;
                    const isInstructor = msg.role === 'teacher' || msg.role === 'admin';
                    return (
                      <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} relative group`}>
                        <div className="flex items-baseline gap-2 mb-1 px-1">
                          {!isMe && (
                            <>
                              <span className={`text-[10px] font-bold ${isInstructor ? 'text-secondary' : 'text-primary'}`}>{msg.user_name}</span>
                              {isInstructor && <span className="material-symbols-outlined text-[10px] text-secondary" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isAdmin && !isMe && (
                            <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1 text-error hover:bg-error/10 rounded transition-all">
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          )}
                          <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${isMe ? 'bg-primary text-on-primary rounded-tr-sm' : isInstructor ? 'bg-secondary/10 text-on-surface border border-secondary/20 rounded-tl-sm' : 'bg-surface-container text-on-surface rounded-tl-sm'}`}>
                            {msg.message || msg.text}
                          </div>
                          {isAdmin && isMe && (
                            <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1 text-error hover:bg-error/10 rounded transition-all">
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <form onSubmit={handleSendMessage} className="p-3 bg-surface border-t border-outline-variant shrink-0">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    disabled={!isJoined}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={isJoined ? "Send a message..." : "Join session to chat"}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-full py-2.5 pl-4 pr-12 focus:ring-2 focus:ring-primary outline-none text-sm text-on-surface disabled:opacity-50"
                  />
                  <button 
                    type="submit" 
                    disabled={!newMessage.trim() || !isJoined}
                    className="absolute right-1 w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center disabled:opacity-50 disabled:bg-surface-variant disabled:text-on-surface-variant transition-colors hover:shadow-md"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                  </button>
                </div>
              </form>
            </>
          )}

          {/* PARTICIPANTS TAB */}
          {activeTab === 'participants' && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              <p className="text-xs font-bold text-on-surface-variant mb-2">In Room ({participants.length})</p>
              {participants.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center mt-4">Join to appear here.</p>
              ) : (
                participants.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-surface-container-low border border-outline-variant/30">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${p.role === 'Instructor' ? 'bg-secondary' : 'bg-primary'}`}>
                      {p.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-on-surface truncate">{p.name}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">{p.role}</p>
                    </div>
                    {p.role === 'Instructor' && (
                      <span className="material-symbols-outlined text-secondary text-[16px]" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* RESOURCES TAB */}
          {activeTab === 'resources' && (
            <div className="flex-1 overflow-y-auto flex flex-col">
              {isTeacher && isJoined && (
                <div className="p-4 border-b border-outline-variant bg-surface-container-low shrink-0 relative">
                  <input type="file" onChange={handleUploadResource} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="flex flex-col items-center justify-center py-4 border-2 border-dashed border-primary/50 rounded-xl bg-primary/5">
                    {uploadingResource ? (
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-primary mb-1">upload_file</span>
                        <p className="text-sm font-bold text-primary">Upload Class Resource</p>
                        <p className="text-xs text-on-surface-variant">PDF, PPTX, or ZIP files</p>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
                {resources.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-60 mt-8">
                    <span className="material-symbols-outlined text-4xl mb-2">folder_off</span>
                    <p className="text-sm">No resources shared yet.</p>
                  </div>
                ) : (
                  resources.map((res) => (
                    <div key={res.id} className="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline-variant hover:border-primary transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-[20px]">
                            {res.file_type === 'pdf' ? 'picture_as_pdf' : res.file_type === 'zip' ? 'folder_zip' : 'insert_drive_file'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-on-surface truncate pr-2">{res.file_name}</p>
                          <p className="text-xs text-on-surface-variant uppercase">{res.file_type} • {(res.file_size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <a href={res.file_url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors shrink-0">
                        <span className="material-symbols-outlined text-[16px]">download</span>
                      </a>
                      {isAdmin && (
                        <button onClick={() => handleDeleteResource(res.id)} className="w-8 h-8 rounded-full bg-error/10 text-error flex items-center justify-center hover:bg-error hover:text-white transition-colors shrink-0 ml-2 opacity-0 group-hover:opacity-100">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </aside>

    </div>
  );
};

export default LiveSession;
