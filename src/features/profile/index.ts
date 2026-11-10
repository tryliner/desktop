import { lazy } from "react";

export {
  default as ProfileModal,
  type ProfileModalProps,
} from "./ui/ProfileModal";
export type {
  ProfileCard,
  ProfileFriends,
  ProfileLinks,
  ProfileModule,
  ProfileNameFont,
  ProfilePerson,
} from "./model/types";

export const ProfileModalTestButton = import.meta.env.DEV
  ? lazy(() => import("./ui/ProfileModalTestButton"))
  : null;
