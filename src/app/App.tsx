import { useEffect } from 'react';
import { useRoute } from './lib/router';
import { useLiveBoard } from './lib/live';
import { Home } from './components/Home';
import { Donate } from './components/Donate';
import { Thanks } from './components/Thanks';
import { Board } from './components/Board';
import { Admin } from './components/Admin';
import { LiveToast } from './components/LiveToast';

export function App() {
  const { route, navigate } = useRoute();
  const live = useLiveBoard();

  useEffect(() => {
    document.title = route.name === 'board' ? "Growing City Greens '26 · Live Board" : "Growing City Greens '26 · Give";
  }, [route.name]);

  if (route.name === 'board') return <Board live={live} />;
  if (route.name === 'admin') return <Admin navigate={navigate} />;

  return (
    <div className="deco-bg min-h-dvh">
      {route.name === 'home' && <Home live={live} navigate={navigate} />}
      {route.name === 'donate' && <Donate live={live} navigate={navigate} presetCents={route.amountCents} />}
      {route.name === 'thanks' && <Thanks id={route.id} live={live} navigate={navigate} />}
      <LiveToast live={live} />
    </div>
  );
}
