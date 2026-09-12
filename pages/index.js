import Dashboard from '../components/Dashboard';
import { getAppState } from '../lib/getAppState';

// Fetches directly from Postgres at render time — no HTTP round-trip to
// /api/state needed for the very first paint, which is what was causing
// the "everything disappears then reappears" flash on reload: previously
// the page always shipped with an empty shell and only fetched real data
// client-side after mount, guaranteeing a blank window on every load
// while that request was in flight. If this fails (e.g. DB hiccup), fall
// back to null and let the client-side fetch handle it as before, rather
// than failing the whole page.
export async function getServerSideProps() {
  try {
    const initialState = await getAppState();
    return { props: { initialState } };
  } catch (err) {
    console.error('[getServerSideProps] failed to preload state:', err);
    return { props: { initialState: null } };
  }
}

export default function Home(props) {
  return <Dashboard {...props} />;
}