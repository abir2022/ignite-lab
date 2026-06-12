import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isTeacher, isAdmin, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getNavLinkClass = (path) => {
    const baseClass = "font-medium transition-colors duration-200 font-label-md text-label-md";
    return location.pathname === path || location.pathname.startsWith(path + '/')
      ? `${baseClass} text-primary font-bold border-b-2 border-primary pb-1`
      : `${baseClass} text-on-surface-variant hover:text-primary`;
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url;
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <header className="bg-glass-fill backdrop-blur-md w-full h-16 sticky top-0 z-50 border-b border-glass-border shadow-sm">
      <div className="flex justify-between items-center px-4 md:px-margin-desktop w-full max-w-container-max mx-auto h-full">
        
        <div className="flex items-center gap-4 md:gap-gutter">
          <Link to="/" className="font-headline-md text-headline-md font-bold text-primary">
            DrilLab
          </Link>
          <nav className="hidden md:flex items-center gap-gutter ml-8">
            {/* Admin/Teacher nav */}
            {user && isAdmin && (
              <Link to="/admin" className={getNavLinkClass('/admin')}>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                  Admin
                </span>
              </Link>
            )}
            {user && isTeacher && !isAdmin && (
              <Link to="/teacher" className={getNavLinkClass('/teacher')}>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">school</span>
                  Instructor
                </span>
              </Link>
            )}
            {/* Shared nav */}
            {user && <Link to="/dashboard" className={getNavLinkClass('/dashboard')}>Dashboard</Link>}
            <Link to="/courses" className={getNavLinkClass('/courses')}>Courses</Link>
            {user && <Link to="/lab" className={getNavLinkClass('/lab')}>Simulations</Link>}
            {user && <Link to="/hardware" className={getNavLinkClass('/hardware')}>3D Lab</Link>}
            {user && <Link to="/live" className={getNavLinkClass('/live')}>Live Session</Link>}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-base">
          {user ? (
            <>
              {isAdmin ? (
                <span className="hidden md:inline-flex items-center gap-1 bg-error/10 text-error px-3 py-1 rounded-full text-xs font-bold">
                  <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
                  Admin
                </span>
              ) : isTeacher && (
                <span className="hidden md:inline-flex items-center gap-1 bg-secondary/10 text-secondary px-3 py-1 rounded-full text-xs font-bold">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  Instructor
                </span>
              )}
              <button className="hidden sm:block p-2 text-on-surface-variant hover:text-primary active:scale-95 transition-transform">
                <span className="material-symbols-outlined">notifications</span>
              </button>

              {/* User Menu */}
              <div className="flex items-center gap-3 group relative">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-lg border-2 border-primary-container cursor-pointer overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    avatarLetter
                  )}
                </div>
                
                {/* Dropdown */}
                <div className="absolute top-full right-0 mt-2 w-60 glass-card rounded-xl border border-glass-border shadow-[0_8px_40px_rgba(0,0,0,0.12)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden z-50">
                  <div className="p-4 border-b border-outline-variant">
                    <p className="font-bold text-on-surface text-sm">{displayName}</p>
                    <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
                    {isAdmin ? (
                      <span className="inline-block mt-1 text-[10px] bg-error/10 text-error px-2 py-0.5 rounded-full font-bold">Admin</span>
                    ) : isTeacher && (
                      <span className="inline-block mt-1 text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">Instructor</span>
                    )}
                  </div>
                  <div className="py-1">
                    {isAdmin ? (
                      <>
                        <Link to="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors">
                          <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                          Admin Dashboard
                        </Link>
                        <Link to="/teacher/courses/new" className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors">
                          <span className="material-symbols-outlined text-[18px]">add_circle</span>
                          Create Course
                        </Link>
                        <Link to="/admin/requests" className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors">
                          <span className="material-symbols-outlined text-[18px]">password</span>
                          Password Requests
                        </Link>
                        <Link to="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors">
                          <span className="material-symbols-outlined text-[18px]">person</span>
                          My Profile
                        </Link>
                      </>
                    ) : isTeacher ? (
                      <>
                        <Link to="/teacher" className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors">
                          <span className="material-symbols-outlined text-[18px]">dashboard</span>
                          Instructor Dashboard
                        </Link>
                        <Link to="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors">
                          <span className="material-symbols-outlined text-[18px]">person</span>
                          My Profile
                        </Link>
                        <Link to="/teacher/courses/new" className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors">
                          <span className="material-symbols-outlined text-[18px]">add_circle</span>
                          Create Course
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link to="/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors">
                          <span className="material-symbols-outlined text-[18px]">dashboard</span>
                          Dashboard
                        </Link>
                        <Link to="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors">
                          <span className="material-symbols-outlined text-[18px]">person</span>
                          My Profile
                        </Link>
                      </>
                    )}
                    <Link to="/lab" className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors">
                      <span className="material-symbols-outlined text-[18px]">code</span>
                      Code Lab
                    </Link>
                    <Link to="/hardware" className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors">
                      <span className="material-symbols-outlined text-[18px]">view_in_ar</span>
                      3D Lab
                    </Link>
                  </div>
                  <div className="border-t border-outline-variant py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="px-5 py-2 border border-outline-variant text-on-surface-variant rounded-lg font-label-md text-label-md hover:bg-surface-variant active:scale-95 transition-all">
                Sign In
              </Link>
              <Link to="/signup" className="hidden md:block px-5 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md active:scale-95 transition-transform hover:shadow-lg hover:shadow-primary/20">
                Get Started
              </Link>
            </>
          )}

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-on-surface-variant hover:text-primary transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="material-symbols-outlined text-2xl">
              {isMobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full bg-glass-fill backdrop-blur-xl border-b border-glass-border shadow-lg z-40 px-4 py-6 flex flex-col gap-4">
          {user && isAdmin && (
            <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} className={getNavLinkClass('/admin')}>
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
                Admin
              </span>
            </Link>
          )}
          {user && isTeacher && !isAdmin && (
            <Link to="/teacher" onClick={() => setIsMobileMenuOpen(false)} className={getNavLinkClass('/teacher')}>
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">school</span>
                Instructor
              </span>
            </Link>
          )}
          {user && <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={getNavLinkClass('/dashboard')}>Dashboard</Link>}
          <Link to="/courses" onClick={() => setIsMobileMenuOpen(false)} className={getNavLinkClass('/courses')}>Courses</Link>
          {user && <Link to="/lab" onClick={() => setIsMobileMenuOpen(false)} className={getNavLinkClass('/lab')}>Simulations</Link>}
          {user && <Link to="/hardware" onClick={() => setIsMobileMenuOpen(false)} className={getNavLinkClass('/hardware')}>3D Lab</Link>}
          {user && <Link to="/live" onClick={() => setIsMobileMenuOpen(false)} className={getNavLinkClass('/live')}>Live Session</Link>}
          
          {!user && (
            <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)} className="mt-2 w-full text-center px-5 py-3 bg-primary text-on-primary rounded-lg font-bold">
              Get Started
            </Link>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
