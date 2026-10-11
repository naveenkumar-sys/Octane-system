import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Users,
  KeyRound,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  UserPlus,
  Lock,
  Mail,
  Phone,
  MapPin,
  Landmark,
  FileText,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { useBusinessProfile } from '../../context/BusinessProfileContext';
import { api } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { LoadingState } from '../../components/ui/StateViews';

export const SystemSettings = ({ initialTab = 'SHOP' }) => {
  const { user, isAdmin, setUser } = useAuth();
  const { updateBusinessProfile } = useBusinessProfile();

  const getInitialActiveTab = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        const upper = tabParam.toUpperCase();
        if (upper === 'USERS' || upper === 'USER') return isAdmin ? 'USERS' : 'ACCOUNT';
        if (upper === 'ACCOUNT' || upper === 'CREDENTIALS' || upper === 'PASSWORD') return 'ACCOUNT';
        if (upper === 'SHOP' || upper === 'STORE' || upper === 'BRANDING') return isAdmin ? 'SHOP' : 'ACCOUNT';
      }
    } catch (e) {}
    return isAdmin ? initialTab : 'ACCOUNT';
  };

  const [activeTab, setActiveTab] = useState(getInitialActiveTab);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab.toLowerCase());
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  };

  useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        const upper = tabParam.toUpperCase();
        if (upper === 'USERS' || upper === 'USER') {
          if (isAdmin) setActiveTab('USERS');
        } else if (upper === 'ACCOUNT' || upper === 'CREDENTIALS' || upper === 'PASSWORD') {
          setActiveTab('ACCOUNT');
        } else if (upper === 'SHOP' || upper === 'STORE' || upper === 'BRANDING') {
          if (isAdmin) setActiveTab('SHOP');
        }
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [isAdmin]);

  // Loading States
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);

  // Business Profile Form State
  const [profileData, setProfileData] = useState({
    company_name: '',
    logo_url: '',
    phone: '',
    email: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state_name: 'Karnataka',
    state_code: '29',
    pincode: '',
    gstin: '',
    bank_name: '',
    account_number: '',
    branch_name: '',
    ifsc_code: '',
    invoice_prefix: 'INV-',
    next_invoice_number: 1001,
    non_gst_prefix: 'EST-',
    next_non_gst_number: 1001,
    declaration: '',
    terms_of_delivery: '',
    jurisdiction_text: '',
  });

  // User Management State
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);

  // Add User Modal State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'CASHIER',
  });
  const [addUserError, setAddUserError] = useState(null);

  // Change Password State
  const [passForm, setPassForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState(null);

  // Fetch Business Profile
  useEffect(() => {
    fetchProfile();
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchProfile = async () => {
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const data = await api.getBusinessProfile();
      if (data) {
        setProfileData({
          company_name: data.company_name || '',
          logo_url: data.logo_url || '',
          phone: data.phone || '',
          email: data.email || '',
          address_line1: data.address_line1 || '',
          address_line2: data.address_line2 || '',
          city: data.city || '',
          state_name: data.state_name || 'Karnataka',
          state_code: data.state_code || '29',
          pincode: data.pincode || '',
          gstin: data.gstin || '',
          bank_name: data.bank_name || '',
          account_number: data.account_number || '',
          branch_name: data.branch_name || '',
          ifsc_code: data.ifsc_code || '',
          invoice_prefix: data.invoice_prefix || 'INV-',
          next_invoice_number: data.next_invoice_number || 1001,
          non_gst_prefix: data.non_gst_prefix || 'EST-',
          next_non_gst_number: data.next_non_gst_number || 1001,
          declaration: data.declaration || '',
          terms_of_delivery: data.terms_of_delivery || '',
          jurisdiction_text: data.jurisdiction_text || '',
        });
      }
    } catch (err) {
      console.error('Failed to load business profile:', err);
      setProfileError('Failed to load business profile details.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.getUsers();
      const list = Array.isArray(res) ? res : res.results || [];
      setUsersList(list);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Logo File Upload (reads as Base64 Data URL)
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image file size must be less than 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setProfileData((prev) => ({
        ...prev,
        logo_url: uploadEvent.target.result,
      }));
      toast.success('Logo uploaded! Click "Save Store Settings" to commit.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setProfileData((prev) => ({ ...prev, logo_url: '' }));
    toast.info('Logo cleared. Click "Save Store Settings" to commit.');
  };

  // Save Business Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    try {
      const updated = await updateBusinessProfile(profileData);
      if (updated) {
        setProfileData((prev) => ({ ...prev, ...updated }));
      }
      toast.success('Store branding updated! Sidebar logo and name reflected immediately.');
    } catch (err) {
      console.error('Error saving business profile:', err);
      const msg = err.message || 'Failed to update business profile.';
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Add New User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setAddUserError(null);

    if (!addUserForm.username.trim() || !addUserForm.password.trim()) {
      setAddUserError('Username and password are required.');
      return;
    }

    setAddingUser(true);
    try {
      await api.createUser({
        username: addUserForm.username.trim(),
        email: addUserForm.email.trim(),
        password: addUserForm.password.trim(),
        role: addUserForm.role,
      });
      toast.success(`User account "${addUserForm.username}" created successfully!`);
      setAddUserForm({ username: '', email: '', password: '', role: 'CASHIER' });
      setIsAddUserOpen(false);
      fetchUsers();
    } catch (err) {
      console.error('Failed to create user:', err);
      const msg = err.message || 'Failed to create user account.';
      setAddUserError(msg);
      toast.error(msg);
    } finally {
      setAddingUser(false);
    }
  };

  // Handle Delete User
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleteUserLoading(true);
    try {
      await api.deleteUser(userToDelete.id);
      toast.success(`User "${userToDelete.username}" deleted successfully.`);
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error(err.message || 'Failed to delete user.');
    } finally {
      setDeleteUserLoading(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError(null);

    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassError('New password and confirm password do not match.');
      return;
    }

    if (passForm.newPassword.length < 6) {
      setPassError('New password must be at least 6 characters long.');
      return;
    }

    setPassLoading(true);
    try {
      if (typeof api.changePassword === 'function') {
        await api.changePassword({
          old_password: passForm.oldPassword,
          new_password: passForm.newPassword,
        });
      } else {
        await api.updateProfile({
          password: passForm.newPassword,
        });
      }
      toast.success('Your password has been changed successfully!');
      setPassForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error('Failed to change password:', err);
      const msg = err.message || 'Failed to change password. Please check your current password.';
      setPassError(msg);
      toast.error(msg);
    } finally {
      setPassLoading(false);
    }
  };

  if (loadingProfile) {
    return <LoadingState message="Loading system settings and store configuration..." />;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>System & Store Settings</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage shop identity, branding, user access control, and account security.
            </p>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleTabChange('SHOP')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'SHOP'
                  ? 'bg-white text-orange-600 shadow-2xs font-extrabold ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 size={14} />
              <span>Store &amp; Branding</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => handleTabChange('USERS')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'USERS'
                  ? 'bg-white text-orange-600 shadow-2xs font-extrabold ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={14} />
              <span>Users &amp; RBAC</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-200 text-slate-700 font-mono">
                {usersList.length}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleTabChange('ACCOUNT')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ACCOUNT'
                ? 'bg-white text-orange-600 shadow-2xs font-extrabold ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound size={14} />
            <span>My Credentials</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STORE & BRANDING SETTINGS                                           */}
      {/* ========================================================================= */}
      {activeTab === 'SHOP' && isAdmin && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {profileError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          {/* Shop Logo & Visual Branding Section */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Upload size={16} className="text-orange-600" />
                  <span>Shop Logo &amp; Print Header Branding</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This logo and business name appears on A4 Tax Invoices, Non-GST Estimates, and Reports.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              {/* Logo Preview Card */}
              <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-2 relative group overflow-hidden shrink-0 shadow-2xs">
                {profileData.logo_url ? (
                  <>
                    <img
                      src={profileData.logo_url}
                      alt="Shop Logo"
                      className="w-full h-full object-contain rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute inset-0 bg-slate-900/70 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl cursor-pointer"
                      title="Remove Logo"
                    >
                      <Trash2 size={20} className="text-rose-400 mb-1" />
                      <span className="text-[10px] font-bold">Remove</span>
                    </button>
                  </>
                ) : (
                  <div className="text-center p-3 text-slate-400">
                    <Building2 size={32} className="mx-auto text-slate-300 mb-1" />
                    <span className="text-[10px] font-bold block">No Logo Uploaded</span>
                    <span className="text-[9px] text-slate-400">Default header used</span>
                  </div>
                )}
              </div>

              {/* Upload Controls & Guidelines */}
              <div className="space-y-3 flex-1">
                <div>
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-extrabold text-xs rounded-xl border border-orange-200 transition-colors cursor-pointer shadow-2xs">
                    <Upload size={14} />
                    <span>Upload New Logo Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {profileData.logo_url && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="ml-2.5 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 space-y-1">
                  <p>• Recommended format: Transparent PNG or SVG (max 2 MB).</p>
                  <p>• High-resolution horizontal or square logos render crispest on printed invoices.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Business Core Info */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Building2 size={16} className="text-orange-600" />
              <span>Shop Identity &amp; Contact Information</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">Shop / Company Name *</label>
                <input
                  type="text"
                  required
                  value={profileData.company_name}
                  onChange={(e) => setProfileData({ ...profileData, company_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="e.g. OCTANE SYSTEMS"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">GSTIN / Tax ID *</label>
                <input
                  type="text"
                  value={profileData.gstin}
                  onChange={(e) => setProfileData({ ...profileData, gstin: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 uppercase"
                  placeholder="29XXXXXXXXXXXXX"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="e.g. 7338515910"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Official Email</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="contact@octanesystems.in"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">City *</label>
                <input
                  type="text"
                  required
                  value={profileData.city}
                  onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="Bengaluru"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">Address Line 1 *</label>
                <input
                  type="text"
                  required
                  value={profileData.address_line1}
                  onChange={(e) => setProfileData({ ...profileData, address_line1: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="Shop / Building No., Street, Floor"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Address Line 2</label>
                <input
                  type="text"
                  value={profileData.address_line2}
                  onChange={(e) => setProfileData({ ...profileData, address_line2: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="Area, Landmark"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">State *</label>
                <input
                  type="text"
                  required
                  value={profileData.state_name}
                  onChange={(e) => setProfileData({ ...profileData, state_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="Karnataka"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">State Code (GST)</label>
                <input
                  type="text"
                  value={profileData.state_code}
                  onChange={(e) => setProfileData({ ...profileData, state_code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="29"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Pincode</label>
                <input
                  type="text"
                  value={profileData.pincode}
                  onChange={(e) => setProfileData({ ...profileData, pincode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="560068"
                />
              </div>
            </div>
          </div>

          {/* Continuous Numbering & Prefixes Configuration */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
              <FileText size={16} className="text-orange-600" />
              <span>Independent Continuous Invoice Serial Counters</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">GST Invoice Prefix</label>
                <input
                  type="text"
                  value={profileData.invoice_prefix}
                  onChange={(e) => setProfileData({ ...profileData, invoice_prefix: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="INV-"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Next GST Serial Number</label>
                <input
                  type="number"
                  min="1"
                  value={profileData.next_invoice_number}
                  onChange={(e) => setProfileData({ ...profileData, next_invoice_number: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Non-GST Bill Prefix</label>
                <input
                  type="text"
                  value={profileData.non_gst_prefix}
                  onChange={(e) => setProfileData({ ...profileData, non_gst_prefix: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="EST-"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Next Non-GST Serial Number</label>
                <input
                  type="number"
                  min="1"
                  value={profileData.next_non_gst_number}
                  onChange={(e) => setProfileData({ ...profileData, next_non_gst_number: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>
          </div>

          {/* Bank Account Details for Invoices */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Landmark size={16} className="text-orange-600" />
              <span>Official Bank Account (Printed on Customer Invoices)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Bank Name</label>
                <input
                  type="text"
                  value={profileData.bank_name}
                  onChange={(e) => setProfileData({ ...profileData, bank_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="e.g. KOTAK BANK"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">Account Number</label>
                <input
                  type="text"
                  value={profileData.account_number}
                  onChange={(e) => setProfileData({ ...profileData, account_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="e.g. 3149366297"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">IFSC Code</label>
                <input
                  type="text"
                  value={profileData.ifsc_code}
                  onChange={(e) => setProfileData({ ...profileData, ifsc_code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="KKBK0008055"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={fetchProfile}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Reset Changes
            </button>
            <button
              type="submit"
              disabled={savingProfile}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-md shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingProfile ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Store Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: USER MANAGEMENT & RBAC                                             */}
      {/* ========================================================================= */}
      {activeTab === 'USERS' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-orange-600" />
                  <span>System User Accounts &amp; Role-Based Access Control</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure cashier terminals and administrator credentials for Octane POS.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddUserOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer"
              >
                <UserPlus size={15} />
                <span>+ Add New User</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold">
                    <th className="py-3 px-4">User Details</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role / Permissions</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map((u) => {
                    const isSelf = u.id === user?.id;
                    const isSuper = u.role === 'ADMIN' || u.is_superuser;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 font-mono text-xs">
                              {u.username.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                <span>{u.username}</span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                    You
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {u.email || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                              isSuper
                                ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <ShieldCheck size={11} />
                            {isSuper ? 'ADMINISTRATOR' : 'CASHIER'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete user"
                            >
                              <Trash2 size={15} />
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MY CREDENTIALS & PASSWORD                                          */}
      {/* ========================================================================= */}
      {activeTab === 'ACCOUNT' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Overview Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 lg:col-span-1">
            <h3 className="text-sm font-extrabold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Users size={16} className="text-orange-600" />
              <span>Current Account Profile</span>
            </h3>

            <div className="text-center py-4 space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-600 text-white flex items-center justify-center font-extrabold text-xl mx-auto shadow-lg shadow-orange-500/20">
                {user?.username ? user.username.substring(0, 2).toUpperCase() : 'AD'}
              </div>
              <div className="font-extrabold text-base text-slate-900">{user?.username}</div>
              <div className="text-xs text-slate-500 font-mono">{user?.email || 'admin@octane.com'}</div>
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 uppercase tracking-wide">
                {isAdmin ? 'System Administrator' : 'POS Cashier'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Account Status:</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Active
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Role Permission:</span>
                <span className="font-bold text-slate-900">{user?.role || (isAdmin ? 'ADMIN' : 'CASHIER')}</span>
              </div>
            </div>
          </div>

          {/* Change Password Form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 lg:col-span-2">
            <h3 className="text-sm font-extrabold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
              <KeyRound size={16} className="text-orange-600" />
              <span>Change Account Password</span>
            </h3>

            {passError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{passError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Current Password *</label>
                <div className="relative">
                  <input
                    type={showOldPass ? 'text' : 'password'}
                    required
                    value={passForm.oldPassword}
                    onChange={(e) => setPassForm({ ...passForm, oldPassword: e.target.value })}
                    className="w-full px-3 py-2 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    placeholder="Enter existing password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showOldPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">New Password *</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={passForm.newPassword}
                      onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                      className="w-full px-3 py-2 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                      placeholder="Minimum 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Confirm New Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passForm.confirmPassword}
                    onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    placeholder="Repeat new password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={passLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-md shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {passLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={14} />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <UserPlus size={18} className="text-orange-600" />
                <span>Create New User Account</span>
              </h3>
            </div>

            {addUserError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{addUserError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Username *</label>
                <input
                  type="text"
                  required
                  value={addUserForm.username}
                  onChange={(e) => setAddUserForm({ ...addUserForm, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="e.g. cashier1"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={addUserForm.email}
                  onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="cashier1@octane.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Initial Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={addUserForm.password}
                  onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Role / Access Level *</label>
                <select
                  value={addUserForm.role}
                  onChange={(e) => setAddUserForm({ ...addUserForm, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="CASHIER">Cashier (POS Billing &amp; Customers Only)</option>
                  <option value="ADMIN">Administrator (Full ERP System Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingUser}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-md shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {addingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDeleteUser}
        loading={deleteUserLoading}
        title="Delete User Account?"
        message={`Are you sure you want to delete user account "${userToDelete?.username}"? They will lose access to the system immediately.`}
        confirmLabel="Delete User"
        variant="danger"
      />
    </div>
  );
};

export default SystemSettings;
