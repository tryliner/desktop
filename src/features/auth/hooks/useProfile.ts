import { useProfileViewModel } from "@/features/profile/hooks/useProfileViewModel";

export function useProfile() {
  const { profile, isLoading, error, saveProfile } = useProfileViewModel();
  return {
    data: profile,
    isLoading,
    error,
    updateProfile: saveProfile,
  };
}
