// 1. Import your generated images at the top of App.jsx
import bgDashboard from '../assets/mascot-calling.png';
import bgVote from '../assets/mascot-dab.png';
import bgLoading from '../assets/mascot-searching.png';
import bgCreate from '../assets/mascot-lifting.png';

// 2. Replace the old CenterpieceArt component with this:
export default function CenterpieceArt ({ view, isLoading }) {
  // Determine which image to load based on the system state
  let activeImage = bgDashboard;
  
  if (isLoading) {
    activeImage = bgLoading;
  } else if (view === 'vote') {
    activeImage = bgVote;
  } else if (view === 'create') {
    activeImage = bgCreate
  }

  return (
    // We use fixed inset-0 to perfectly pin it to all 4 corners of the viewport
    <div className="fixed inset-0 w-full h-full justify-self-center self-center -z-0 pointer-events-none bg-[#0a0a0a] flex items-center justify-center">
      
      {/* The actual image. 
        - opacity-40 ensures it doesn't overpower the glass panels.
        - mix-blend-screen drops all the black pixels from the image and only renders the white/grey pixels.
        - object-cover ensures it fills the center without stretching.
      */}
      <img 
        src={activeImage} 
        alt="System Background" 
        className="w-2/3 h-2/3 object-contain opacity-50 mix-blend-screen transition-opacity duration-0"
      />

      {/* The Vignette / Void Fade. 
        This is crucial. It overlays a gradient that is transparent in the center 
        and solid black at the edges, ensuring the image doesn't clash with the 
        UI elements pinned to the corners of the screen.
      */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a0a_75%)]"></div>
    </div>
  );
};