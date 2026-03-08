import bgDashboard from '../assets/mascot-calling.png';
import bgVote from '../assets/mascot-dab.png';
import bgLoading from '../assets/mascot-searching.png';
import bgCreate from '../assets/mascot-lifting.png';

const VIEW_IMAGE_MAP = {
  dashboard: bgDashboard,
  vote: bgVote,
  create: bgCreate,
};

export default function CenterpieceArt({ view, isLoading }) {
  const activeImage = isLoading ? bgLoading : (VIEW_IMAGE_MAP[view] || bgDashboard);

  return (
    <div className="pointer-events-none fixed inset-0 -z-0 flex w-full h-full items-center justify-center bg-[#0a0a0a]">
      
      <img 
        src={activeImage} 
        alt={`System Background for ${view || 'dashboard'} view`} 
        className="w-full h-full p-8 md:w-2/3 md:h-2/3 md:p-0 object-contain opacity-50 mix-blend-screen transition-opacity duration-0"
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a0a_75%)]" />
    </div>
  );
}