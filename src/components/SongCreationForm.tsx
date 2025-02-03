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
    <Card className="w-full max-w-2xl mx-auto p-6 glass-card space-y-8 relative z-10">
      <form onSubmit={handleSubmit} className="space-y-6">
        {!isAuthenticated ? (
          <div className="space-y-4 text-center">
            <p className="text-muted-foreground">Sign in to create your personalized song</p>
            <Button
              type="button"
              className="w-full max-w-sm mx-auto"
              onClick={handleGoogleLogin}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2 text-center">
              <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">Create Your Song</h2>
              <p className="text-muted-foreground">
                Fill in the details and let AI create a unique song just for you
              </p>
            </div>

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
          </>
        )}
      </form>
    </Card>
    <PremiumPlanModal 
      open={showPremiumModal} 
      onOpenChange={setShowPremiumModal} 
    />
  </>);
};

export default SongCreationForm;