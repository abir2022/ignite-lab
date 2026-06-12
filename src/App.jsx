import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import TeacherRoute from './components/TeacherRoute';

// Lazy loaded Public Pages
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const CourseDirectory = lazy(() => import('./pages/CourseDirectory'));
const CoursePlayer = lazy(() => import('./pages/CoursePlayer'));
const Profile = lazy(() => import('./pages/Profile'));

// Lazy loaded Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminRequests = lazy(() => import('./pages/admin/AdminRequests'));
const AdminUserManagement = lazy(() => import('./pages/admin/AdminUserManagement'));
const AdminHardwareManagement = lazy(() => import('./pages/admin/AdminHardwareManagement'));

// Lazy loaded Protected Pages (Student + Teacher)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CodingLab = lazy(() => import('./pages/CodingLab'));
const LiveSession = lazy(() => import('./pages/LiveSession'));
const HardwareLab = lazy(() => import('./pages/HardwareLab'));

// Lazy loaded Teacher Pages
const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard'));
const TeacherProfile = lazy(() => import('./pages/teacher/TeacherProfile'));
const CourseEditor = lazy(() => import('./pages/teacher/CourseEditor'));

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow">
            <Suspense fallback={
              <div className="h-[calc(100vh-64px)] bg-[#020617] flex flex-col items-center justify-center text-white">
                <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="font-mono text-[9px] tracking-widest uppercase opacity-40">Loading core telemetry...</p>
              </div>
            }>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/courses" element={<CourseDirectory />} />

                {/* Admin Routes */}
                <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/requests" element={<ProtectedRoute><AdminRequests /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute><AdminUserManagement /></ProtectedRoute>} />
                <Route path="/admin/hardware" element={<ProtectedRoute><AdminHardwareManagement /></ProtectedRoute>} />
                
                {/* Protected Routes (Any logged-in user) */}
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/courses/:courseId/play" element={<ProtectedRoute><CoursePlayer /></ProtectedRoute>} />
                <Route path="/lab" element={<ProtectedRoute><CodingLab /></ProtectedRoute>} />
                <Route path="/live" element={<ProtectedRoute><LiveSession /></ProtectedRoute>} />
                <Route path="/hardware" element={<ProtectedRoute><HardwareLab /></ProtectedRoute>} />

                {/* Teacher-Only Routes */}
                <Route path="/teacher" element={<ProtectedRoute><TeacherRoute><TeacherDashboard /></TeacherRoute></ProtectedRoute>} />
                <Route path="/teacher/profile" element={<ProtectedRoute><TeacherRoute><TeacherProfile /></TeacherRoute></ProtectedRoute>} />
                <Route path="/teacher/courses/new" element={<ProtectedRoute><TeacherRoute><CourseEditor /></TeacherRoute></ProtectedRoute>} />
                <Route path="/teacher/courses/:courseId" element={<ProtectedRoute><TeacherRoute><CourseEditor /></TeacherRoute></ProtectedRoute>} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
