import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// --- ARCADE GAMES ---

const SnakeGame = () => {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let snake = [{x: 10, y: 10}];
    let food = {x: 5, y: 5};
    let dx = 1; let dy = 0;
    let nextDx = 1; let nextDy = 0;

    const draw = () => {
      if (gameOver) return;
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, 400, 400);
      
      // Wireframe Grid
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.05)';
      for(let i=0; i<400; i+=20) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 400); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(400, i); ctx.stroke();
      }

      dx = nextDx; dy = nextDy;
      const head = {x: (snake[0].x + dx + 20) % 20, y: (snake[0].y + dy + 20) % 20};
      
      if (snake.some(s => s.x === head.x && s.y === head.y)) {
        setGameOver(true);
        return;
      }

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        setScore(s => s + 10);
        food = {x: Math.floor(Math.random()*20), y: Math.floor(Math.random()*20)};
      } else {
        snake.pop();
      }

      ctx.fillStyle = '#06b6d4';
      snake.forEach(s => ctx.fillRect(s.x*20+2, s.y*20+2, 16, 16));
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(food.x*20+4, food.y*20+4, 12, 12);
    };

    const handleKey = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowUp' && dy === 0) { nextDx = 0; nextDy = -1; }
      else if (e.key === 'ArrowDown' && dy === 0) { nextDx = 0; nextDy = 1; }
      else if (e.key === 'ArrowLeft' && dx === 0) { nextDx = -1; nextDy = 0; }
      else if (e.key === 'ArrowRight' && dx === 0) { nextDx = 1; nextDy = 0; }
    };

    const handleTouch = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touchX = e.touches[0].clientX - rect.left;
      const touchY = e.touches[0].clientY - rect.top;
      const midX = rect.width / 2;
      const midY = rect.height / 2;
      
      if (Math.abs(touchX - midX) > Math.abs(touchY - midY)) {
        if (touchX > midX && dx === 0) { nextDx = 1; nextDy = 0; }
        else if (touchX < midX && dx === 0) { nextDx = -1; nextDy = 0; }
      } else {
        if (touchY > midY && dy === 0) { nextDx = 0; nextDy = 1; }
        else if (touchY < midY && dy === 0) { nextDx = 0; nextDy = -1; }
      }
    };

    window.addEventListener('keydown', handleKey);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouch(e); }, { passive: false });
    const interval = setInterval(draw, 100);
    return () => { 
      clearInterval(interval); 
      window.removeEventListener('keydown', handleKey);
    };
  }, [gameOver]);

  return (
    <div className="flex flex-col items-center w-full">
      <canvas ref={canvasRef} width="400" height="400" className="border border-white/10 rounded-xl bg-black shadow-2xl max-w-full aspect-square touch-none" />
      <div className="mt-4 flex flex-wrap justify-center gap-4 md:gap-8 font-mono text-[10px] uppercase">
        <span className="text-primary">Score: {score}</span>
        {gameOver && <button onClick={() => setGameOver(false)} className="text-red-500 underline">System Failure // Restart</button>}
        <span className="text-slate-500 hidden sm:block">Use Arrows or Swipe</span>
      </div>
    </div>
  );
};

const FlappyGame = () => {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let birdY = 200; let velocity = 0;
    let pipes = [{x: 400, y: 150}];
    
    const draw = () => {
      if (gameOver) return;
      ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, 400, 400);
      
      velocity += 0.4; birdY += velocity;
      if (birdY > 380 || birdY < 0) setGameOver(true);

      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(50, birdY, 20, 20);

      pipes.forEach((p, i) => {
        p.x -= 3;
        ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.fillRect(p.x, 0, 40, p.y);
        ctx.fillRect(p.x, p.y + 100, 40, 400);
        
        if (p.x === 50) setScore(s => s + 1);
        if (50 < p.x + 40 && 70 > p.x && (birdY < p.y || birdY + 20 > p.y + 100)) setGameOver(true);
      });

      if (pipes[0].x < -40) pipes.shift();
      if (pipes[pipes.length-1].x < 200) pipes.push({x: 400, y: Math.random() * 200 + 50});
    };

    const jump = (e) => {
      if (e && e.key && !['ArrowUp', ' '].includes(e.key)) return;
      if (e) e.preventDefault();
      velocity = -6;
    };

    window.addEventListener('keydown', jump);
    canvas.addEventListener('touchstart', jump, { passive: false });
    const interval = setInterval(draw, 1000/60);
    return () => { 
      clearInterval(interval); 
      window.removeEventListener('keydown', jump);
    };
  }, [gameOver]);

  return (
    <div className="flex flex-col items-center w-full">
      <canvas ref={canvasRef} width="400" height="400" className="border border-white/10 rounded-xl bg-black max-w-full aspect-square touch-none" />
      <div className="mt-4 font-mono text-[10px] text-primary uppercase text-center">
        Uplink Altitude: {score}m {gameOver && <button onClick={() => setGameOver(false)} className="ml-4 text-red-500">Reset</button>}
        <div className="text-slate-500 mt-1">Tap or Space to Jump</div>
      </div>
    </div>
  );
};

const DinoGame = () => {
  const canvasRef = useRef(null);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let dinoY = 350; let velocity = 0; let jumping = false;
    let obstacles = [{x: 400}]; let speed = 5;

    const draw = () => {
      if (gameOver) return;
      ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, 400, 400);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.moveTo(0,370); ctx.lineTo(400,370); ctx.stroke();

      if (jumping) { velocity += 0.6; dinoY += velocity; if (dinoY >= 350) { dinoY = 350; jumping = false; } }

      ctx.fillStyle = '#06b6d4'; ctx.fillRect(40, dinoY, 20, 20);

      obstacles.forEach(o => {
        o.x -= speed; ctx.fillStyle = '#f59e0b'; ctx.fillRect(o.x, 350, 15, 20);
        if (40 < o.x + 15 && 60 > o.x && dinoY > 330) setGameOver(true);
      });

      if (obstacles[0].x < -20) obstacles.shift();
      if (obstacles[obstacles.length-1].x < 200) obstacles.push({x: 400 + Math.random()*200});
    };

    const jump = (e) => { 
      if (e && e.key && !['ArrowUp', ' '].includes(e.key)) return;
      if (e) e.preventDefault();
      if (!jumping) { velocity = -10; jumping = true; } 
    };

    window.addEventListener('keydown', jump);
    canvas.addEventListener('touchstart', jump, { passive: false });
    const interval = setInterval(draw, 1000/60);
    return () => { 
      clearInterval(interval); 
      window.removeEventListener('keydown', jump);
    };
  }, [gameOver]);

  return (
    <div className="flex flex-col items-center w-full">
      <canvas ref={canvasRef} width="400" height="400" className="border border-white/10 rounded-xl bg-black max-w-full aspect-square touch-none" />
      <div className="mt-4 font-mono text-[10px] text-primary uppercase text-center">
        Surface Scan Active {gameOver && <button onClick={() => setGameOver(false)} className="ml-4 text-red-500">Restart</button>}
        <div className="text-slate-500 mt-1">Tap or Space to Jump</div>
      </div>
    </div>
  );
};

const JumpGame = () => {
  const canvasRef = useRef(null);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let player = {x: 200, y: 300, v: 0};
    let platforms = Array.from({length: 6}, (_, i) => ({x: Math.random()*350, y: i*70}));

    const draw = () => {
      if (gameOver) return;
      ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, 400, 400);

      player.v += 0.3; player.y += player.v;
      if (player.y > 400) setGameOver(true);

      platforms.forEach(p => {
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(p.x, p.y, 50, 5);
        if (player.v > 0 && player.x + 20 > p.x && player.x < p.x + 50 && player.y + 20 > p.y && player.y + 20 < p.y + 10) player.v = -10;
        if (player.y < 150) { p.y += 5; if (p.y > 400) { p.y = 0; p.x = Math.random()*350; } }
      });

      ctx.fillStyle = '#06b6d4'; ctx.fillRect(player.x, player.y, 20, 20);
    };

    const move = (e) => { 
      if (e && e.key && !['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) return;
      if (e) e.preventDefault();
      if (e.key === 'ArrowLeft') player.x -= 20; 
      if (e.key === 'ArrowRight') player.x += 20; 
    };

    const handleTouch = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touchX = e.touches[0].clientX - rect.left;
      if (touchX < rect.width / 2) player.x -= 20;
      else player.x += 20;
    };

    window.addEventListener('keydown', move);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouch(e); }, { passive: false });
    const interval = setInterval(draw, 1000/60);
    return () => { 
      clearInterval(interval); 
      window.removeEventListener('keydown', move);
    };
  }, [gameOver]);

  return (
    <div className="flex flex-col items-center w-full">
      <canvas ref={canvasRef} width="400" height="400" className="border border-white/10 rounded-xl bg-black max-w-full aspect-square touch-none" />
      <div className="mt-4 font-mono text-[10px] text-primary uppercase text-center">
        Vertical Propulsion {gameOver && <button onClick={() => setGameOver(false)} className="ml-4 text-red-500">Retry</button>}
        <div className="text-slate-500 mt-1">Tap Left/Right to Move</div>
      </div>
    </div>
  );
};

// --- PREVIOUS GAMES ---
const SignalGame = () => {
  const [sequence, setSequence] = useState([]);
  const [playerInput, setPlayerInput] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('Initialize Uplink');

  const startLevel = () => {
    const newSeq = Array.from({ length: 4 }, () => Math.floor(Math.random() * 4));
    setSequence(newSeq); setPlayerInput([]); setIsPlaying(true); setStatus('Observing Signal...');
    setTimeout(() => setStatus('Repeat Sequence'), 2000);
  };

  const handleInput = (id) => {
    if (!isPlaying) return;
    const newInput = [...playerInput, id]; setPlayerInput(newInput);
    if (newInput[newInput.length - 1] !== sequence[newInput.length - 1]) { setStatus('Signal Lost // Retry'); setIsPlaying(false); }
    else if (newInput.length === sequence.length) { setStatus('Uplink Secured!'); setIsPlaying(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center h-[400px]">
      <div className="font-mono text-[9px] text-cyan-500 uppercase tracking-widest mb-4">{status}</div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[0, 1, 2, 3].map((id) => (
          <button key={id} onClick={() => handleInput(id)} className={`w-16 h-16 rounded-xl transition-all ${playerInput.includes(id) ? 'bg-cyan-500 shadow-[0_0_15px_#06b6d4]' : 'bg-white/5 hover:bg-white/10'}`} />
        ))}
      </div>
      <button onClick={startLevel} className="text-[10px] font-bold text-white uppercase tracking-widest bg-white/5 px-4 py-2 rounded-lg hover:bg-white/10">Start Scan</button>
    </div>
  );
};

const PressureGame = () => {
  const [pressure, setPressure] = useState(50);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval;
    if (isActive) {
      interval = setInterval(() => { setPressure(p => { const next = p + 5; if (next >= 100) setIsActive(false); return next; }); }, 100);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const stabilize = () => { if (!isActive) { setIsActive(true); setPressure(50); } setPressure(p => Math.max(0, p - 15)); };

  return (
    <div className="flex flex-col items-center justify-center h-[400px]">
      <div className="font-mono text-[9px] text-primary uppercase tracking-widest mb-4">Pressure Monitor</div>
      <div className="w-48 h-48 bg-white/5 rounded-xl mb-6 relative overflow-hidden flex items-end">
        <div className={`w-full transition-all duration-100 ${pressure > 80 ? 'bg-red-500 shadow-[0_0_20px_red]' : 'bg-primary'}`} style={{ height: `${pressure}%` }} />
        <div className="absolute inset-0 flex items-center justify-center font-mono text-3xl font-bold text-white/20">{pressure}%</div>
      </div>
      <button onClick={stabilize} className="tech-button ignition-gradient"> {isActive ? 'Stabilize' : 'Start Pump'} </button>
    </div>
  );
};

const Home = () => {
  const [activeTab, setActiveTab] = useState('snake');
  const { user } = useAuth();
  const navigate = useNavigate();

  const goToLab = (path) => {
    navigate(user ? path : '/login');
  };

  return (
    <div className="bg-[#020617]">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img alt="Hero background lab" className="w-full h-full object-cover opacity-20 scale-110 animate-pulse" src="/drillab_hero_lab.png" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#020617]/40 to-[#020617]"></div>
          <div className="absolute inset-0 bg-grid-white opacity-20"></div>
        </div>
        <div className="relative z-10 w-full max-w-container-max px-4 md:px-margin-desktop text-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-8 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-cyan-400 font-bold">System Status: Operational</span>
          </div>
          <h1 className="text-5xl md:text-8xl text-white mb-8 max-w-5xl mx-auto leading-[0.9] font-black tracking-tighter"> THE DIGITAL CORE OF <br /> <span className="text-primary text-glow italic">INDUSTRIAL FUTURE</span> </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed font-medium"> Bridge the gap between theory and high-stakes execution. Ignite Lab provides high-fidelity simulations for robotics, coding, and drilling operations. </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to={user ? '/dashboard' : '/login'} className="tech-button ignition-gradient text-white shadow-[0_0_40px_rgba(6,182,212,0.3)]">{user ? 'Mission Control' : 'Initialize Command'}</Link>
            <Link to="/courses" className="tech-button bg-white/5 border border-white/10 text-white"> Browse Modules </Link>
          </div>
        </div>
      </section>

      {/* Industrial Arcade Lab */}
      <section className="py-32 bg-[#020617] border-y border-white/5 relative overflow-hidden">
        <div className="max-w-container-max mx-auto px-4 md:px-margin-desktop relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl text-white mb-4 uppercase font-black italic">Industrial <span className="text-primary">Arcade</span></h2>
            <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.5em]">Module Simulation Sandbox // v4.2.0</p>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Game Selector */}
            <div className="lg:w-1/3 flex flex-col gap-4">
              {[
                {id: 'snake', title: 'Grid Crawler', icon: 'grid_view'},
                {id: 'flappy', title: 'Altitude Link', icon: 'flight'},
                {id: 'dino', title: 'Surface Scan', icon: 'directions_run'},
                {id: 'jump', title: 'Vertical Ops', icon: 'vertical_align_top'},
                {id: 'signal', title: 'Signal Sync', icon: 'leak_add'},
                {id: 'pressure', title: 'Pressure Unit', icon: 'compress'}
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-4 p-6 rounded-2xl transition-all border ${activeTab === tab.id ? 'bg-primary text-slate-950 border-primary' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}
                >
                  <span className="material-symbols-outlined">{tab.icon}</span>
                  <span className="font-bold uppercase tracking-widest text-xs">{tab.title}</span>
                  {activeTab === tab.id && <span className="material-symbols-outlined ml-auto">play_arrow</span>}
                </button>
              ))}
            </div>

            {/* Game Display */}
            <div className="lg:w-2/3 glass-card rounded-[3rem] p-8 md:p-12 border-white/10 relative overflow-hidden flex items-center justify-center min-h-[500px]">
              <div className="absolute inset-0 bg-grid-white opacity-5"></div>
              <div className="relative z-10 w-full">
                {activeTab === 'snake' && <SnakeGame />}
                {activeTab === 'flappy' && <FlappyGame />}
                {activeTab === 'dino' && <DinoGame />}
                {activeTab === 'jump' && <JumpGame />}
                {activeTab === 'signal' && <SignalGame />}
                {activeTab === 'pressure' && <PressureGame />}
              </div>
            </div>
          </div>

          <div className="mt-16 bg-primary/10 border border-primary/20 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 group">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] group-hover:rotate-12 transition-transform shrink-0">
              <span className="material-symbols-outlined text-3xl">code_blocks</span>
            </div>
            <div>
              <h4 className="text-primary font-black text-xl uppercase italic mb-2 tracking-tighter">Everything you see is buildable.</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                These simulations were created using the <strong className="text-white">Ignite Lab Industrial SDK</strong>. Our tools empower you to build complex logic, haptic interactions, and gamified training modules with minimal effort.
              </p>
            </div>
            <button onClick={() => goToLab('/lab')} className="md:ml-auto tech-button bg-primary text-slate-950 whitespace-nowrap shrink-0">
              <span className="flex items-center gap-2"><span className="material-symbols-outlined text-lg">science</span> Enter Simulation Lab</span>
            </button>
          </div>
        </div>
      </section>

      {/* Bento Grid */}
      <section className="py-32 relative">
        <div className="max-w-container-max mx-auto px-4 md:px-margin-desktop">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl text-white mb-4 uppercase font-black italic">Engineering <span className="text-primary">Ecosystem</span></h2>
            <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.5em]">Integrated Simulation Environments // Mission-Critical Training</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:min-h-[700px]">
            {/* ROV & Subsea Robotics */}
            <div className="md:col-span-7 glass-card rounded-[2.5rem] p-8 md:p-12 flex flex-col relative overflow-hidden group">
              <div className="absolute inset-0 z-0">
                <img alt="Subsea ROV" className="w-full h-full object-cover opacity-20 transition-transform duration-1000" src="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&q=80" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent"></div>
              </div>
              <div className="relative z-10 mt-auto">
                <div className="font-mono text-[10px] text-primary uppercase tracking-[0.3em] font-bold mb-4">Module_01 // ROBOTICS</div>
                <h3 className="text-3xl md:text-4xl text-white mb-4 leading-none">ROV & SUBSEA <br />HARDWARE</h3>
                <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-8"> Master the operation of heavy-duty subsea ROVs through precision haptic simulations. </p>
                <button onClick={() => goToLab('/hardware')} className="tech-button ignition-gradient text-white text-xs">
                  <span className="flex items-center gap-2"><span className="material-symbols-outlined text-base">precision_manufacturing</span> Enter ROV Lab</span>
                </button>
              </div>
            </div>
            {/* PLC & Industrial Coding */}
            <div className="md:col-span-5 glass-card rounded-[2.5rem] p-8 md:p-12 flex flex-col bg-primary text-slate-950 border-none">
              <div className="w-16 h-16 rounded-2xl bg-slate-950 flex items-center justify-center mb-8 shadow-2xl"> <span className="material-symbols-outlined text-primary text-3xl">terminal</span> </div>
              <h3 className="text-4xl mb-4 font-black italic uppercase leading-[0.85]">PLC & <br />INDUSTRIAL <br />CODING</h3>
              <p className="text-slate-950/70 text-sm leading-relaxed mb-8 font-bold"> Develop real-time industrial control systems using our proprietary SDK. </p>
              <button onClick={() => goToLab('/lab')} className="mt-auto tech-button bg-slate-950 text-primary text-xs hover:bg-slate-900 transition-colors w-fit">
                <span className="flex items-center gap-2"><span className="material-symbols-outlined text-base">code</span> Launch PLC Lab</span>
              </button>
            </div>
            {/* 3D Hardware Lab */}
            <div className="md:col-span-12 glass-card rounded-[2.5rem] p-8 md:p-12 flex flex-col lg:flex-row gap-12 overflow-hidden relative group">
              <div className="lg:w-1/2 flex flex-col justify-center relative z-10">
                <div className="font-mono text-[10px] text-indigo-400 uppercase tracking-[0.3em] font-bold mb-4">Module_02 // SIMULATIONS</div>
                <h3 className="text-4xl md:text-5xl text-white mb-6 leading-[0.95] uppercase">Interactive <br />3D Hardware Lab</h3>
                <p className="text-slate-400 text-md leading-relaxed mb-10"> Deconstruct complex drilling assemblies using our exclusive <strong className="text-white">Exploded View</strong> technology. </p>
                <button onClick={() => goToLab('/hardware')} className="tech-button ignition-gradient text-white text-xs w-fit">
                  <span className="flex items-center gap-2"><span className="material-symbols-outlined text-base">view_in_ar</span> Open 3D Lab</span>
                </button>
              </div>
              <div className="lg:w-1/2 rounded-3xl overflow-hidden border border-white/5 relative h-64 lg:h-[400px]">
                <img alt="3D Hardware Detail" className="w-full h-full object-cover" src="/virtual_workspace_cockpit.png" />
                <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#020617]/60"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Virtual Cockpit */}
      <section className="py-32 bg-[#020617] relative overflow-hidden">
        <div className="max-w-container-max mx-auto px-4 md:px-margin-desktop relative z-10">
          <div className="text-center mb-24">
            <span className="font-mono text-[10px] text-primary uppercase tracking-[0.5em] font-bold mb-4 block">Interface_Preview</span>
            <h2 className="text-5xl md:text-7xl text-white mb-6 tracking-tighter uppercase font-black italic">The Virtual <span className="text-primary">Cockpit</span></h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">Engineered for maximum cognitive throughput.</p>
          </div>
          <div className="relative group p-1 bg-gradient-to-br from-white/10 to-transparent rounded-[4rem]">
            <div className="relative bg-[#020617] rounded-[3.9rem] p-6 shadow-2xl overflow-hidden">
              <div className="flex flex-col xl:flex-row h-auto xl:h-[700px] gap-8">
                <div className="flex-1 rounded-[3rem] overflow-hidden relative border border-white/5 shadow-2xl">
                  <img src="/virtual_workspace_cockpit.png" alt="Virtual Cockpit" className="w-full h-full object-cover scale-100 group-hover:scale-105 transition-transform duration-[2s]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40"></div>
                  <div className="absolute inset-0 p-12 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-3 mb-2"> <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></div> <span className="font-mono text-xs text-white uppercase tracking-widest font-bold">Encrypted Uplink</span> </div>
                        <p className="font-mono text-[9px] text-white/30">SA_NODE_NYC_7721 // ACTIVE</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-full xl:w-[400px] flex flex-col gap-8">
                  <div className="flex-1 glass-card rounded-[3rem] p-10 border-white/5 relative overflow-hidden">
                    <h4 className="text-white font-bold text-xl mb-8 flex items-center gap-3"> <span className="w-2 h-2 bg-primary rounded-full"></span> CORE INTEGRATION </h4>
                    <ul className="space-y-8">
                      {['Unified Data Bus', 'Haptic Feedback', 'Adaptive AI Tutor'].map((title, i) => (
                        <li key={i} className="group/item">
                          <p className="text-white font-bold text-sm mb-2 group-hover/item:text-primary transition-colors uppercase tracking-wide">{title}</p>
                          <p className="text-slate-500 text-xs leading-relaxed">Integrated simulation precision and contextual debugging.</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
