import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const AdminRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('password_requests')
      .select(`
        *,
        profiles!inner (
          secret_question,
          secret_answer
        )
      `)
      .order('created_at', { ascending: false });
    
    if (data) setRequests(data);
    setLoading(false);
  };

  const handleAction = async (requestId, userEmail, newStatus) => {
    const { error } = await supabase
      .from('password_requests')
      .update({ status: newStatus })
      .eq('id', requestId);

    if (!error) {
      if (newStatus === 'approved') {
        alert(`Approved! You should now manually send a password reset email to ${userEmail} or coordinate with them.`);
        // In a full production app, this would trigger supabase.auth.admin.generateLink or similar
      }
      fetchRequests();
    } else {
      alert("Error: " + error.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-margin-desktop py-gutter">
      <div className="mb-gutter">
        <h1 className="font-headline-lg text-3xl text-on-surface">Password Change Requests</h1>
        <p className="text-on-surface-variant font-body-md mt-1">Review and approve password change requests from platform users.</p>
      </div>

      <div className="glass-card rounded-xl border border-glass-border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-20">verified_user</span>
            <p>No pending password requests.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">User Details</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Verification</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Requested PW</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-sm text-on-surface">{req.user_email}</p>
                      <p className="text-[10px] text-on-surface-variant">
                        {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-bold text-primary uppercase">Q: {req.profiles?.secret_question}</p>
                      <div className="flex gap-2 mt-1">
                        <div className="flex-1">
                          <p className="text-[10px] text-on-surface-variant uppercase">Submitted</p>
                          <p className={`text-xs font-bold ${req.submitted_answer?.toLowerCase() === req.profiles?.secret_answer?.toLowerCase() ? 'text-green-600' : 'text-error'}`}>
                            {req.submitted_answer || 'None'}
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-on-surface-variant uppercase">Stored</p>
                          <p className="text-xs font-bold text-on-surface">
                            {req.profiles?.secret_answer}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs bg-surface-container px-2 py-1 rounded text-primary">{req.requested_password}</code>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        req.status === 'pending' ? 'bg-orange-100 text-orange-700' : 
                        req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleAction(req.id, req.user_email, 'approved')}
                            className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleAction(req.id, req.user_email, 'rejected')}
                            className="bg-surface-variant text-on-surface-variant px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-error hover:text-white transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRequests;
