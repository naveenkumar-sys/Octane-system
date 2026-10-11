import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const BusinessProfileContext = createContext({
  businessProfile: null,
  loading: true,
  refreshBusinessProfile: async () => {},
  updateBusinessProfile: async () => {},
});

export const BusinessProfileProvider = ({ children }) => {
  const [businessProfile, setBusinessProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('octane_business_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!businessProfile);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.getBusinessProfile();
      if (data) {
        setBusinessProfile(data);
        try {
          localStorage.setItem('octane_business_profile', JSON.stringify(data));
        } catch (_) {}
      }
      return data;
    } catch (err) {
      console.warn('Failed to fetch business profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    const handleProfileUpdate = (e) => {
      if (e.detail) {
        setBusinessProfile(e.detail);
        try {
          localStorage.setItem('octane_business_profile', JSON.stringify(e.detail));
        } catch (_) {}
      } else {
        fetchProfile();
      }
    };

    window.addEventListener('business-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('business-profile-updated', handleProfileUpdate);
  }, [fetchProfile]);

  const updateProfile = useCallback(async (formData) => {
    const updated = await api.updateBusinessProfile(formData);
    setBusinessProfile(updated);
    try {
      localStorage.setItem('octane_business_profile', JSON.stringify(updated));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('business-profile-updated', { detail: updated }));
    return updated;
  }, []);

  useEffect(() => {
    if (businessProfile?.company_name) {
      document.title = `${businessProfile.company_name} • Octane POS ERP`;
    }
  }, [businessProfile?.company_name]);

  return (
    <BusinessProfileContext.Provider
      value={{
        businessProfile,
        loading,
        refreshBusinessProfile: fetchProfile,
        updateBusinessProfile: updateProfile,
      }}
    >
      {children}
    </BusinessProfileContext.Provider>
  );
};

export const useBusinessProfile = () => useContext(BusinessProfileContext);
export default BusinessProfileContext;
