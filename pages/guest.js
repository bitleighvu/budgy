import Dashboard from '../components/Dashboard';
import { getGuestAppState } from '../lib/getGuestAppState';

export async function getServerSideProps() {
  try {
    const initialState = await getGuestAppState();
    return { props: { initialState, isGuest: true } };
  } catch (err) {
    console.error('[guest] failed to preload state:', err);
    return { props: { initialState: null, isGuest: true } };
  }
}

export default function Guest(props) {
  return <Dashboard {...props} />;
}