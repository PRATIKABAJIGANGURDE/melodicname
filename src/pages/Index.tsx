import SongCreationForm from "@/components/SongCreationForm";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-background -z-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-3xl -z-10" />
      
      <div className="space-y-12 relative z-10">
        <div className="flex justify-end px-4">
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-primary hover:bg-primary/90"
          >
            Dashboard
          </Button>
        </div>
        <div className="text-center space-y-6 -mt-10">
          <h1 className="text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600  min-h-[10vh]">
            Song Creation Portal
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your emotions into beautiful melodies with our personalized song creation service
          </p>
        </div>
        <SongCreationForm />
      </div>
    </div>
  );
};

export default Index;
