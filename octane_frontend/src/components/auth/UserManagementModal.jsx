import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Lock,
  UserPlus,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Key,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import ConfirmDialog from '../ui/ConfirmDialog';

export const UserManagementModal = ({ isOpen, onClose }) => {
  const { user, setUser, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'users'
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
  });

  // User Management List State (Admin)
  const [usersList, setUsersList] = useState([]);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'CASHIER',
  });

  useEffect(() => {
    if (isOpen && user) {
      setProfileForm({
        username: user.username || '',
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        password: '',
      });
      setSuccessMsg('');
      setErrorMsg('');

      if (isAdmin) {
        fetchUsers();
      }
    }
  }, [isOpen, user, isAdmin]);

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsersList(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        username: profileForm.username,
        email: profileForm.email,
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
      };

      if (profileForm.password.trim()) {
        payload.password = profileForm.password;
      }

      const updatedUser = await api.updateProfile(payload);
      setUser(updatedUser);
      setSuccessMsg('Profile and credentials updated successfully!');
      setProfileForm((prev) => ({ ...prev, password: '' }));
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.createUser(newUserForm);
      setSuccessMsg(`User '${newUserForm.username}' created successfully as ${newUserForm.role}!`);
      setNewUserForm({
        username: '',
        password: '',
        email: '',
        first_name: '',
        last_name: '',
        role: 'CASHIER',
      });
      setShowAddUserForm(false);
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create user.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (targetUser) => {
    if (targetUser.id === user.id) {
      setErrorMsg('You cannot delete your own logged-in account.');
      return;
    }
    setUserToDelete(targetUser);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setLoading(true);
    try {
      await api.deleteUser(userToDelete.id);
      setSuccessMsg(`User '${userToDelete.username}' deleted successfully.`);
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete user.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] my-auto relative">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <UserCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Account & User Control</h2>
              <p className="text-[11px] text-slate-300 font-mono">
                {user?.username} ({user?.role || 'USER'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-extrabold transition-all border-t border-x ${
              activeTab === 'profile'
                ? 'bg-white text-orange-600 border-slate-200 border-b-white -mb-px shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <User size={15} />
            <span>My Credentials & Profile</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-extrabold transition-all border-t border-x ${
                activeTab === 'users'
                  ? 'bg-white text-orange-600 border-slate-200 border-b-white -mb-px shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              <ShieldCheck size={15} />
              <span>User Directory & RBAC</span>
              <span className="px-1.5 py-0.5 text-[9px] bg-orange-100 text-orange-800 rounded-md font-mono">
                ADMIN
              </span>
            </button>
          )}
        </div>

        {/* Feedback Alerts */}
        <div className="px-6 pt-4">
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'profile' ? (
            /* TAB 1: Edit Profile & Change Password */
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Username</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">First Name</label>
                  <input
                    type="text"
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Last Name</label>
                  <input
                    type="text"
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Password Change Box */}
              <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200 space-y-2 mt-4">
                <div className="flex items-center gap-2 text-xs font-extrabold text-orange-900">
                  <Key size={16} className="text-orange-600" />
                  <span>Change Account Password</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Leave empty if you do not wish to alter your current password.
                </p>
                <div className="relative pt-1">
                  <Lock size={16} className="absolute left-3 top-4 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Enter new secure password"
                    value={profileForm.password}
                    onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                >
                  {loading ? 'Saving Changes...' : 'Save Profile & Password'}
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: Admin User Management & Role Creation */
            <div className="space-y-5">
              {/* Header Action */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">System Users</h3>
                  <p className="text-[11px] text-slate-500">
                    Add cashiers or administrative accounts to OCTANE ERP.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddUserForm(!showAddUserForm)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <UserPlus size={15} />
                  <span>{showAddUserForm ? 'Cancel Add' : '+ Add New User'}</span>
                </button>
              </div>

              {/* Add User Form Drawer */}
              {showAddUserForm && (
                <form
                  onSubmit={handleCreateUser}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in"
                >
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    New Account Registration
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">Username *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. cashier_lokesh"
                        value={newUserForm.username}
                        onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">Password *</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">First Name</label>
                      <input
                        type="text"
                        placeholder="First Name"
                        value={newUserForm.first_name}
                        onChange={(e) => setNewUserForm({ ...newUserForm, first_name: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">Role Permission *</label>
                      <select
                        value={newUserForm.role}
                        onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="CASHIER">CASHIER (Billing & Inventory Catalog only)</option>
                        <option value="ADMIN">ADMINISTRATOR (Full Managerial Access)</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs"
                    >
                      {loading ? 'Creating...' : 'Create Account'}
                    </button>
                  </div>
                </form>
              )}

              {/* Users Directory Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-4">User</th>
                      <th className="py-2.5 px-4">Role</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {usersList.map((u) => {
                      const userIsAdmin = u.role === 'ADMIN' || u.is_staff || u.is_superuser;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span>{u.username}</span>
                              {u.id === user?.id && (
                                <span className="px-1.5 py-0.5 text-[9px] bg-emerald-100 text-emerald-800 rounded font-mono font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'No name'}
                            </div>
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-mono font-extrabold rounded-md border ${
                                userIsAdmin
                                  ? 'bg-orange-100 text-orange-800 border-orange-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {userIsAdmin ? 'ADMIN' : 'CASHIER'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {u.id !== user?.id && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete user"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete User Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDeleteUser}
        loading={loading}
        title="Delete User Account?"
        message={`Are you sure you want to delete user account "${userToDelete?.username}"? They will lose access to the system immediately.`}
        confirmLabel="Delete User"
        variant="danger"
      />
    </div>
  );
};

export default UserManagementModal;
