import { Routes, Route } from 'react-router-dom';
import Hero from '@components/Hero';
import MeetArete from '@components/MeetArete';
import Invite from '@components/Invite';
import Services from '@components/Services';
import Arete from '@components/Arete';
import OpenAccountable from '@components/OpenAccountable';
import Footer from '@components/Footer';
import TracePage from '@pages/TracePage';

// The App component stitches together the landing page sections in their intended scroll order.
const App = (): JSX.Element => (
  <div className="app-shell">
    <Routes>
      <Route
        path="/"
        element={(
          <main>
            <Hero />
            <MeetArete />
            <Services />
            <OpenAccountable />
            <Invite />
            <Arete />
            <Footer />
          </main>
        )}
      />
      <Route path="/trace/:responseId" element={<TracePage />} />
    </Routes>
  </div>
);

export default App;
