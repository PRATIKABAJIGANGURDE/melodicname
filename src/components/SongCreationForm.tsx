import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import PremiumPlanModal from "./PremiumPlanModal";

const genres = [
  "Romantic",
  "Motivational",
  "Pop",
  "Rock",
  "Hip Hop",
  "Classical",
  "Jazz",
  "Folk",
  "Electronic",
];

const SongCreationForm = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [userProfile, setUserProfile] = useState<{ free_songs_remaining: number; is_premium: boolean } | null>(null);
  const [formData, setFormData] = useState({
    artistName: "",
    recipient: "",
    songName: "",
    whatsapp: "",
    email: "",
    additional: "",
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    checkAuth();
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('free_songs_remaining, is_premium')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(profile);

      // Show premium modal if no free songs remaining and not premium
      if (profile && profile.free_songs_remaining <= 0 && !profile.is_premium) {
        setShowPremiumModal(true);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Error",
        description: "Failed to load user profile",
        variant: "destructive",
      });
    }
  };

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const redirectUrl = process.env.NODE_ENV === 'production' 
        ? 'https://melodicname.vercel.app/auth'
        : `${window.location.origin}/auth`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error:', error.message);
      toast({
        title: "Error",
        description: "Failed to sign in with Google",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create a song",
        variant: "destructive",
      });
      return;
    }

    if (!selectedGenre) {
      toast({
        title: "Error",
        description: "Please select a genre",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check user's free songs remaining
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('free_songs_remaining, is_premium')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      if (!profile.is_premium && profile.free_songs_remaining <= 0) {
        setShowPremiumModal(true);
        return;
      }

      let photoUrl = null;
      
      // Upload photo if exists
      if (imagePreview) {
        const file = await fetch(imagePreview).then(r => r.blob());
        const fileExt = file.type.split('/')[1];
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('song-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;
        
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('song-photos')
            .getPublicUrl(fileName);
          photoUrl = publicUrl;
        }
      }

      // Insert song request into database
      const { error: insertError } = await supabase
        .from('song_requests')
        .insert([
          {
            user_id: user.id,
            artist_name: formData.artistName,
            recipient: formData.recipient,
            genre: selectedGenre,
            song_name: formData.songName,
            whatsapp: formData.whatsapp,
            email: formData.email,
            photo_url: photoUrl,
            additional_notes: formData.additional,
            status: 'pending'
          }
        ]);

      if (insertError) throw insertError;

      // Update free songs remaining if not premium
      if (!profile.is_premium) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ free_songs_remaining: profile.free_songs_remaining - 1 })
          .eq('id', user.id);

        if (updateError) throw updateError;

        // Update local state
        setUserProfile(prev => prev ? {
          ...prev,
          free_songs_remaining: prev.free_songs_remaining - 1
        } : null);
      }

      toast({
        title: "Request Submitted Successfully",
        description: "We'll start creating your song right away!",
      });

      // Reset form
      setFormData({
        artistName: "",
        recipient: "",
        songName: "",
        whatsapp: "",
        email: "",
        additional: "",
      });
      setSelectedGenre("");
      setImagePreview(null);

      // Redirect to home page after successful submission
      navigate('/dashboard');
      
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: "There was an error submitting your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Simple Header */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src="/favicon.ico" alt="Logo" className="h-8 w-8 mr-2" />
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                MelodicName
              </span>
            </div>
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-8">
        <Card className="w-full max-w-2xl mx-auto p-6 glass-card space-y-8 relative z-10">
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">Create Your Song</h2>
            <p className="text-muted-foreground">
              Fill in the details and let AI create a unique song just for you
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="artistName">Song Creator Name</Label>
                <Input
                  id="artistName"
                  placeholder="Enter your name"
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary"
                  required
                  value={formData.artistName}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient">For Whom</Label>
                <Input
                  id="recipient"
                  placeholder="Who is this song for?"
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary"
                  required
                  value={formData.recipient}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label>Genre</Label>
                <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map((genre) => (
                      <SelectItem key={genre} value={genre}>
                        {genre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="songName">Suggested Song Name</Label>
                <Input
                  id="songName"
                  placeholder="Enter a name for your song"
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary"
                  required
                  value={formData.songName}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp Number</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  placeholder="Enter your WhatsApp number"
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary"
                  required
                  value={formData.whatsapp}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo">Photo (Optional)</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary"
                />
                {imagePreview && (
                  <div className="mt-2 relative w-32 h-32">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional">Additional Notes (Optional)</Label>
                <Textarea
                  id="additional"
                  placeholder="Any specific requirements or details you'd like to add?"
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary"
                  value={formData.additional}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 transition-all duration-200"
              disabled={isSubmitting || (userProfile && !userProfile.is_premium && userProfile.free_songs_remaining <= 0)}
            >
              {isSubmitting ? "Submitting..." : userProfile && !userProfile.is_premium && userProfile.free_songs_remaining <= 0 
                ? "No Free Songs Remaining" 
                : "Create My Song"}
            </Button>
          </form>
        </Card>
      </div>
      <PremiumPlanModal 
        open={showPremiumModal}
        onOpenChange={setShowPremiumModal}
      />
    </>
  );
};

export default SongCreationForm;