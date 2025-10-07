import Hero from '@components/Hero';
import MeetDaneel from '@components/MeetDaneel';
import Invite from '@components/Invite';
import Services from '@components/Services';
import Arete from '@components/Arete';
import OpenAccountable from '@components/OpenAccountable';
import EthicsNote from '@components/EthicsNote';
import Footer from '@components/Footer';

// The App component stitches together the landing page sections in their intended scroll order.
const App = (): JSX.Element => (
  <div className="app-shell">
    <main>
      <Hero />
      <MeetDaneel />
      <Invite />
      <Services />
      <Arete />
      <OpenAccountable />
      <EthicsNote />
      <Footer />
    </main>
  </div>
);

export default App;
