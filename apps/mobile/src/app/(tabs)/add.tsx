import { Redirect } from 'expo-router';

/**
 * The "+" tab never navigates here: its button starts a game instead (see
 * (tabs)/_layout). This route only exists so the tab has a slot; anyone
 * reaching /add by link is sent Home.
 */
export default function AddRoute() {
  return <Redirect href="/" />;
}
