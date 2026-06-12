import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TeacherRoute = ({ children }) => {
  const { user, isTeacher, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-surface-variant font-label-md">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isTeacher) return <Navigate to="/dashboard" replace />;

  return children;
};

export default TeacherRoute;
